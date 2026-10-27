import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisHandlers } from '../server/analysis/handlers';
import { verifyToken, signToken, requireSameOrigin } from '../server/analysis/security';
import type { AnalysisProvider } from '../server/analysis/provider';
import { readMetaConfig } from '../server/meta/config';
import { createSqliteUsageStore } from '../server/usage/store';
import { analysisSource, analysisPlan } from './analysis-fixtures';

const origin = 'http://localhost:3000';
test('origin validation uses the HTTP host when Next listens on all interfaces', () => {
  const headers = { host: 'localhost:3000', origin, 'sec-fetch-site': 'same-origin' };
  assert.doesNotThrow(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/analysis/start', { headers })));
  assert.throws(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/analysis/start', { headers: { ...headers, origin: 'https://attacker.example' } })));
  assert.throws(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/analysis/start', { headers: { ...headers, host: 'attacker.example:3000', origin: 'http://attacker.example:3000' } })));
});
function request(path: string, body: unknown, cookie?: string, headers: Record<string, string> = {}) {
  return new Request(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body) });
}
function fixture() {
  let creates = 0; let retrieves = 0; let cancels = 0; let clock = 1000;
  const source = analysisSource();
  const provider: AnalysisProvider = {
    async start() { creates++; return { id: `resp_test_${creates}`, status: 'queued' }; },
    async retrieve() { retrieves++; return { id: 'resp_test', status: 'completed', output_text: JSON.stringify(analysisPlan(source)), usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 } }; },
    async cancel() { cancels++; return { id: 'resp_test', status: 'cancelled' }; },
  };
  const handlers = createAnalysisHandlers({ usage: createSqliteUsageStore({ path: ':memory:', now: () => clock }), getConfig: () => readMetaConfig({ MODEL_API_KEY: 'test-not-real' }), signingSecret: 'fixture-signing-key', provider: () => provider, now: () => clock });
  return { handlers, source, provider, counts: () => ({ creates, retrieves, cancels }), advance: (ms: number) => { clock += ms; } };
}

test('accepted background jobs resume without creating or paying for a second analysis', async () => {
  const f = fixture(); const body = { source: f.source, requestId: 'request-identifier-00001' };
  const start = await f.handlers.start(request('/api/analysis/start', body));
  assert.equal(start.status, 200);
  const cookie = start.headers.get('set-cookie')!.split(';')[0];
  const started = await start.json(); assert.equal(started.status, 'queued');
  const duplicate = await f.handlers.start(request('/api/analysis/start', body, cookie));
  assert.equal(duplicate.status, 200); assert.equal(f.counts().creates, 1);
  const result = await f.handlers.status(request('/api/analysis/status', { source: f.source, job: started.job }, cookie));
  const completed = await result.json(); assert.equal(completed.status, 'complete'); assert.equal(completed.result.usage.totalTokens, 50);
  assert.equal(f.counts().creates, 1); assert.equal(f.counts().retrieves, 1);
});

test('anonymous job capabilities reject other sessions, edited sources and expired references', async () => {
  const f = fixture();
  const a = await f.handlers.start(request('/api/analysis/start', { source: f.source, requestId: 'request-identifier-00001' }));
  const aCookie = a.headers.get('set-cookie')!.split(';')[0]; const { job } = await a.json();
  const b = await f.handlers.start(request('/api/analysis/start', { source: f.source, requestId: 'request-identifier-00002' }));
  const bCookie = b.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await f.handlers.status(request('/api/analysis/status', { source: f.source, job }, bCookie))).status, 403);
  const changed = structuredClone(f.source); changed.title = 'Other source';
  assert.equal((await f.handlers.status(request('/api/analysis/status', { source: changed, job }, aCookie))).status, 403);
  assert.equal(f.counts().retrieves, 0);
  f.advance(24 * 60 * 60 * 1000 + 1);
  assert.equal((await f.handlers.status(request('/api/analysis/status', { source: f.source, job }, aCookie))).status, 403);
});

test('cancellation uses the existing job and never starts another model response', async () => {
  const f = fixture(); const response = await f.handlers.start(request('/api/analysis/start', { source: f.source, requestId: 'request-identifier-00001' }));
  const cookie = response.headers.get('set-cookie')!.split(';')[0]; const { job } = await response.json();
  const cancelled = await f.handlers.status(request('/api/analysis/cancel', { source: f.source, job }, cookie), true);
  assert.equal((await cancelled.json()).status, 'cancelled'); assert.deepEqual(f.counts(), { creates: 1, retrieves: 0, cancels: 1 });
});

test('starting a later job renews session access without changing its ownership', async () => {
  const f = fixture();
  const first = await f.handlers.start(request('/api/analysis/start', { source: f.source, requestId: 'request-identifier-00001' }));
  const cookie = first.headers.get('set-cookie')!.split(';')[0];
  const firstJob = (await first.json()).job;
  f.advance(23 * 60 * 60 * 1000);
  const later = await f.handlers.start(request('/api/analysis/start', { source: f.source, requestId: 'request-identifier-00002' }, cookie));
  const renewed = later.headers.get('set-cookie')!.split(';')[0];
  const laterJob = (await later.json()).job;
  assert.equal((await f.handlers.status(request('/api/analysis/status', { source: f.source, job: firstJob }, renewed))).status, 200);
  f.advance(2 * 60 * 60 * 1000);
  const retrieved = await f.handlers.status(request('/api/analysis/status', { source: f.source, job: laterJob }, renewed));
  assert.equal((await retrieved.json()).status, 'complete');
});

test('cross-origin, missing configuration and oversized input fail before any paid request', async () => {
  const f = fixture(); const body = { source: f.source, requestId: 'request-identifier-00001' };
  assert.equal((await f.handlers.start(request('/api/analysis/start', body, undefined, { origin: 'https://untrusted.example' }))).status, 403);
  assert.equal((await f.handlers.start(request('/api/analysis/start', body, undefined, { 'content-length': '800000' }))).status, 413);
  const missing = createAnalysisHandlers({ getConfig: () => readMetaConfig({}), provider: () => f.provider });
  assert.equal((await missing.start(request('/api/analysis/start', body))).status, 503);
  assert.equal(f.counts().creates, 0);
});

test('uncertain submission is explicit and never automatically retried', async () => {
  const f = fixture(); let attempts = 0;
  f.provider.start = async () => { attempts++; throw new TypeError('Connection dropped'); };
  const result = await f.handlers.start(request('/api/analysis/start', { source: f.source, requestId: 'request-identifier-00001' }));
  const body = await result.json(); assert.equal(result.status, 504); assert.equal(body.uncertain, true); assert.equal(attempts, 1);
  assert.equal(JSON.stringify(body).includes('test-not-real'), false);
});

test('job tokens are signed and cannot be altered without detection', () => {
  const token = signToken({ kind: 'job', responseId: 'resp_1' }, 'test-signing-key');
  assert.equal(verifyToken(token, 'test-signing-key').responseId, 'resp_1');
  assert.throws(() => verifyToken(token + 'x', 'test-signing-key'), /Invalid/);
  assert.throws(() => verifyToken(token, 'different-key'), /Invalid/);
});
