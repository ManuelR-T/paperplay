import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createSqliteUsageStore, type UsageRequest, DEFAULT_USAGE_LIMITS } from '../server/usage/store';
import { createRedisUsageStore, RESERVE_LUA, SETTLE_LUA } from '../server/usage/redis';
import { createUsageStore } from '../server/usage/service';
import { createAnalysisHandlers } from '../server/analysis/handlers';
import { analysisSource, analysisPlan } from './analysis-fixtures';
import { readMetaConfig } from '../server/meta/config';

const request = (id = 'request-one', sessionId = 'session-one'): UsageRequest => ({ id, sessionId, kind: 'analysis', maxOutputTokens: 6000, inputCharacters: 500, model: 'test-model', fingerprint: 'source-one' });
const origin = 'http://localhost:3000';
function apiRequest(body: unknown, cookie?: string) { return new Request(origin + '/api/analysis/start', { method: 'POST', headers: { origin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }

test('durable SQLite reservations survive independent store instances and preserve unknown usage', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paperplay-usage-'));
  try {
    const path = join(dir, 'quota.sqlite'); let now = Date.UTC(2026, 9, 27, 10);
    const a = createSqliteUsageStore({ path, now: () => now });
    await a.reserve(request()); await a.settle('request-one', { status: 'uncertain' }); a.close?.();
    const b = createSqliteUsageStore({ path, now: () => now });
    assert.equal((await b.reserve(request())).created, false);
    await assert.rejects(b.reserve({ ...request(), sessionId: 'different-owner' }), /different input/);
    let summary = await b.summary(); assert.equal(summary.requests, 1); assert.equal(summary.measuredRequests, 0); assert.equal(summary.accountedTokens, 24_000);
    await b.settle('request-one', { status: 'completed', providerId: 'resp_completed', usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 } });
    await b.settle('request-one', { status: 'accepted' });
    summary = await b.summary(); assert.equal(summary.byStatus.completed, 1); assert.equal(summary.accountedTokens, 50); assert.equal(summary.measuredRequests, 1);
    now += 86_400_000; assert.equal((await b.summary()).requests, 0); b.close?.();
    assert.equal(readFileSync(path).includes(Buffer.from('API_KEY')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('analysis and questions share a session allowance and token ceiling before new paid work', async () => {
  const limits = { ...DEFAULT_USAGE_LIMITS, sessionTenMinuteRequests: 2, dailyTokens: 100_000 };
  const store = createSqliteUsageStore({ path: ':memory:', limits, now: () => 1_000_000 });
  await store.reserve(request('analysis'));
  await store.reserve({ ...request('question'), kind: 'question' });
  await assert.rejects(store.reserve(request('excess')), /allowance/);
  assert.equal((await store.summary()).requests, 2);
  const tokens = createSqliteUsageStore({ path: ':memory:', limits: { ...limits, dailyTokens: 23_999 } });
  await assert.rejects(tokens.reserve(request()), /allowance/);
  assert.equal((await tokens.summary()).requests, 0);
  store.close?.(); tokens.close?.();
});

test('partial running usage cannot release the reservation before inference is terminal', async () => {
  const store = createSqliteUsageStore({ path: ':memory:', limits: { ...DEFAULT_USAGE_LIMITS, dailyTokens: 40_000 } });
  try {
    await store.reserve(request('running'));
    await store.settle('running', { status: 'accepted', providerId: 'resp_running', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
    assert.equal((await store.summary()).accountedTokens, 24_000);
    assert.equal((await store.summary()).reservedUnmeasuredTokens, 24_000);
    await assert.rejects(store.reserve(request('second')), /allowance/);
    await store.settle('running', { status: 'completed', providerId: 'resp_running', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });
    await store.settle('running', { status: 'accepted', providerId: 'resp_running', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
    await store.settle('running', { status: 'uncertain' });
    assert.equal((await store.summary()).accountedTokens, 150);
    assert.equal((await store.summary()).byStatus.completed, 1);
    assert.equal((await store.summary()).reservedUnmeasuredTokens, 0);
    assert.equal((await store.reserve(request('second'))).created, true);
  } finally { store.close?.(); }
});

test('simultaneous Node server processes cannot oversubscribe a shared SQLite volume', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paperplay-concurrency-'));
  try {
    const path = join(dir, 'quota.sqlite');
    const initialize = createSqliteUsageStore({ path }); initialize.close?.();
    const workers = await Promise.all(Array.from({ length: 4 }, (_, index) => new Promise<number>((resolveWorker, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', resolve('tests/usage-worker.ts'), path, String(index)], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; let error = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { error += chunk; });
      child.on('error', reject); child.on('exit', code => { if (code !== 0) reject(new Error(error)); else { try { resolveWorker(JSON.parse(output).accepted); } catch (e) { reject(e); } } });
    })));
    assert.equal(workers.reduce((sum, count) => sum + count, 0), 5);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hosted configuration fails closed without shared Redis and quota storage failure starts no analysis', async () => {
  assert.throws(() => createUsageStore({ PAPERPLAY_DEPLOYMENT: 'distributed' }), /shared durable/);
  assert.throws(() => createUsageStore({ VERCEL: '1' }), /shared durable/);
  assert.throws(() => createUsageStore({ USAGE_DAILY_TOKENS: 'invalid' }), /positive whole/);
  const source = analysisSource(); let paid = 0;
  const broken = createRedisUsageStore({ url: 'https://redis.example', token: 'never-public', fetch: async () => { throw Error('transport failure'); } });
  const handlers = createAnalysisHandlers({ getConfig: () => readMetaConfig({ MODEL_API_KEY: 'server-key' }), usage: broken, provider: () => ({ async start() { paid++; return { id: 'resp_new', status: 'queued' }; }, async retrieve() { throw Error(); }, async cancel() { throw Error(); } }) });
  const response = await handlers.start(apiRequest({ source, requestId: 'request-identifier-00001' }));
  assert.equal(response.status, 503); assert.equal(paid, 0);
  assert.equal((await response.text()).includes('never-public'), false);
});

test('independent analysis handlers recover accepted jobs from durable reservations, without recreating provider work', async () => {
  const source = analysisSource(); let paid = 0;
  const store = createSqliteUsageStore({ path: ':memory:', limits: { ...DEFAULT_USAGE_LIMITS, globalHourlyRequests: 1 } });
  const provider = () => ({ async start() { paid++; return { id: 'resp_persisted', status: 'queued' }; }, async retrieve() { return { id: 'resp_persisted', status: 'completed', output_text: JSON.stringify(analysisPlan(source)) }; }, async cancel() { return { id: 'resp_persisted', status: 'cancelled' }; } });
  const dependencies = { getConfig: () => readMetaConfig({ MODEL_API_KEY: 'server-key' }), usage: store, provider };
  const body = { source, requestId: 'request-identifier-00001' };
  const initial = await createAnalysisHandlers(dependencies).start(apiRequest(body)); const accepted = await initial.json();
  const cookie = initial.headers.get('set-cookie')!.split(';')[0];
  const recovered = await createAnalysisHandlers(dependencies).start(apiRequest(body, cookie));
  assert.equal(recovered.status, 200); assert.equal((await recovered.json()).job.token, accepted.job.token); assert.equal(paid, 1);
  const excess = await createAnalysisHandlers(dependencies).start(apiRequest({ ...body, requestId: 'request-identifier-00002' }, cookie));
  assert.equal(excess.status, 429); assert.equal(paid, 1); store.close?.();
});

test('Redis REST adapter submits atomic EVAL commands and fails closed on unsafe or malformed responses', async () => {
  const commands: unknown[][] = [];
  const record = { ...request(), status: 'reserved', reservedTokens: 24_000, createdAt: 1, updatedAt: 1 };
  const store = createRedisUsageStore({ url: 'https://redis.example', token: 'secret-not-logged', now: () => 1, fetch: (async (_url, init) => {
    const command = JSON.parse(String(init?.body)); commands.push(command);
    return Response.json({ result: command[1] === RESERVE_LUA ? JSON.stringify({ created: true, record }) : 1 });
  }) as typeof fetch });
  assert.equal((await store.reserve(request())).created, true);
  await store.settle('request-one', { status: 'uncertain' });
  assert.equal(commands[0][0], 'EVAL'); assert.equal(commands[0][1], RESERVE_LUA); assert.equal(commands[1][1], SETTLE_LUA);
  assert.throws(() => createRedisUsageStore({ url: 'http://redis.example', token: 'secret' }), /unavailable/);
  const broken = createRedisUsageStore({ url: 'https://redis.example', token: 'secret', fetch: async () => Response.json({ error: 'raw server details' }) });
  await assert.rejects(broken.reserve(request()), /durable usage store is unavailable/);
});
