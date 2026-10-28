import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createD1UsageStore, D1_RESERVE_SQL, type D1UsageDatabase, type D1UsageStatement } from '../server/usage/d1';
import { DEFAULT_USAGE_LIMITS, type UsageRequest, type UsageRecord } from '../server/usage/model';

const migration = readFileSync(new URL('../deploy/migrations/0000_paperplay.sql', import.meta.url), 'utf8');
const request = (id: string, sessionId = 'browser-one'): UsageRequest => ({ id, sessionId, kind: 'analysis', maxOutputTokens: 6000, inputCharacters: 500, model: 'fixture-model', fingerprint: 'source-fixture' });
/** Execute exactly the D1 adapter's SQL using real SQLite/JSON1, not a SQL mock. */
function binding(db: DatabaseSync, beforeRun?: (sql: string, values: unknown[]) => Promise<void>): D1UsageDatabase {
  return { prepare(sql) {
    let values: unknown[] = [];
    const statement: D1UsageStatement = {
      bind(...next) { values = next; return statement; },
      async first<T>() { return (db.prepare(sql).get(...values as never[]) ?? null) as T | null; },
      async all<T>() { return { results: db.prepare(sql).all(...values as never[]) as T[], success: true }; },
      async run() { await beforeRun?.(sql, values); const result = db.prepare(sql).run(...values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; },
    }; return statement;
  } };
}
function memory() { const db = new DatabaseSync(':memory:'); db.exec(migration); return db; }

test('D1 single-statement reservation admits exactly five of sixteen concurrent requests across instances', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paperplay-d1-'));
  const connections: DatabaseSync[] = [];
  try {
    const path = join(directory, 'd1.sqlite'); const first = new DatabaseSync(path); connections.push(first); first.exec(migration);
    for (let i = 0; i < 3; i++) { const connection = new DatabaseSync(path); connection.exec('PRAGMA busy_timeout=5000'); connections.push(connection); }
    const limits = { ...DEFAULT_USAGE_LIMITS, globalHourlyRequests: 5, sessionTenMinuteRequests: 5 };
    const stores = connections.map(db => createD1UsageStore({ db: binding(db), limits }));
    const results = await Promise.allSettled(Array.from({ length: 16 }, (_, index) => stores[index % stores.length].reserve(request(`parallel-${index}`, `browser-${index}`))));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 5);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.status === 429).length, 11);
    assert.equal((await stores[0].summary()).requests, 5);
    assert.equal((await stores[0].summary()).backend, 'd1');
    assert.match(D1_RESERVE_SQL, /^INSERT OR IGNORE/); assert.match(D1_RESERVE_SQL, /SELECT SUM/);
  } finally { connections.forEach(db => db.close()); rmSync(directory, { recursive: true, force: true }); }
});

test('D1 durable request identity rejects changed owners/context and shares analysis/question allowance', async () => {
  const db = memory();
  try {
    const store = createD1UsageStore({ db: binding(db), limits: { ...DEFAULT_USAGE_LIMITS, sessionTenMinuteRequests: 2 } });
    assert.equal((await store.reserve(request('same-id'))).created, true);
    const reopened = createD1UsageStore({ db: binding(db), limits: { ...DEFAULT_USAGE_LIMITS, sessionTenMinuteRequests: 2 } });
    assert.equal((await reopened.reserve(request('same-id'))).created, false);
    await assert.rejects(reopened.reserve(request('same-id', 'other-owner')), /different input/);
    await assert.rejects(reopened.reserve({ ...request('same-id'), fingerprint: 'different-source' }), /different input/);
    await reopened.reserve({ ...request('question-id'), kind: 'question' });
    await assert.rejects(reopened.reserve(request('excess')), /allowance/);
    assert.deepEqual((await reopened.summary()).byKind, { analysis: 1, question: 1 });
  } finally { db.close(); }
});

test('D1 keeps full capacity for partial usage and releases it only after terminal measured work', async () => {
  const db = memory();
  try {
    const store = createD1UsageStore({ db: binding(db), limits: { ...DEFAULT_USAGE_LIMITS, dailyTokens: 40_000 } });
    await store.reserve(request('running'));
    await store.settle('running', { status: 'accepted', providerId: 'resp_running', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
    assert.equal((await store.summary()).accountedTokens, 24_000);
    await assert.rejects(store.reserve(request('second')), /allowance/);
    await store.settle('running', { status: 'completed', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });
    await store.settle('running', { status: 'uncertain', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
    assert.equal((await store.summary()).accountedTokens, 150);
    assert.equal((await store.summary()).byStatus.completed, 1);
    assert.equal((await store.reserve(request('second'))).created, true);
  } finally { db.close(); }
});

test('D1 compare-and-swap prevents a delayed replica from erasing completed usage', async () => {
  const db = memory(); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const delayed = binding(db, async (sql, values) => {
    if (sql.startsWith('UPDATE') && JSON.parse(String(values[0])).status === 'accepted') await gate;
  });
  try {
    const a = createD1UsageStore({ db: delayed }); const b = createD1UsageStore({ db: binding(db) });
    await a.reserve(request('racing'));
    const stale = a.settle('racing', { status: 'accepted', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
    await new Promise(resolve => setImmediate(resolve));
    await b.settle('racing', { status: 'completed', providerId: 'resp_final', usage: { inputTokens: 300, outputTokens: 50, totalTokens: 350 } });
    release(); await stale;
    const summary = await a.summary();
    assert.equal(summary.byStatus.completed, 1); assert.equal(summary.measured.totalTokens, 350); assert.equal(summary.accountedTokens, 350);
    const row = db.prepare('SELECT record FROM usage_records WHERE id=?').get('racing') as { record: string };
    assert.equal((JSON.parse(row.record) as UsageRecord).providerId, 'resp_final');
  } finally { release(); db.close(); }
});

test('D1 quota exhaustion and failed database operations fail closed without changing allowance', async () => {
  const db = memory();
  try {
    const store = createD1UsageStore({ db: binding(db), limits: { ...DEFAULT_USAGE_LIMITS, dailyTokens: 1 } });
    await assert.rejects(store.reserve(request('denied')), /allowance/);
    assert.equal((await store.summary()).requests, 0);
    const broken = createD1UsageStore({ db: { prepare() { throw new Error('private connection details'); } } });
    await assert.rejects(broken.reserve(request('failed')), error => error instanceof Error && !error.message.includes('private') && /durable usage store/.test(error.message));
    await assert.rejects(broken.summary(), /durable usage store/);
  } finally { db.close(); }
});

test('D1 retention removes old metadata without resetting current-day quota', async () => {
  const db = memory(); let now = Date.UTC(2026, 9, 1);
  try {
    const store = createD1UsageStore({ db: binding(db), now: () => now });
    await store.reserve(request('old'));
    now += 31 * 86_400_000;
    await store.reserve(request('current'));
    assert.equal(db.prepare('SELECT record FROM usage_records WHERE id=?').get('old'), undefined);
    assert.equal((await store.summary()).requests, 1);
  } finally { db.close(); }
});

test('D1 hackathon admission bypasses optional quotas atomically without dropping metering or duplicate protection',async()=>{
 const db=memory();
 try{
  const limits={globalHourlyRequests:1,sessionTenMinuteRequests:1,dailyRequests:1,dailyTokens:1};
  const a=createD1UsageStore({db:binding(db),limits,enforceLimits:false}),b=createD1UsageStore({db:binding(db),limits,enforceLimits:false});
  const results=await Promise.all(Array.from({length:24},(_,i)=>[a,b][i%2].reserve(request(`unlimited-${i}`))));
  assert.equal(results.filter(r=>r.created).length,24);assert.equal((await b.reserve(request('unlimited-0'))).created,false);
  await assert.rejects(b.reserve(request('unlimited-0','wrong-owner')),/different input/);
  await a.settle('unlimited-0',{status:'completed',providerId:'resp_owned',usage:{inputTokens:10,outputTokens:12,totalTokens:22}});
  const summary=await b.summary();assert.equal(summary.quotasEnabled,false);assert.equal(summary.requests,24);assert.equal(summary.measured.totalTokens,22);assert.equal(summary.accountedTokens,23*24000+22);
 }finally{db.close();}
});
