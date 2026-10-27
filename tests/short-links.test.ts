import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createShortLinkHandlers, shortLinkDeleteHash } from '../server/short-links/handlers';
import { createSqliteShortLinkStore } from '../server/short-links/sqlite';
import { createD1ShortLinkStore } from '../server/short-links/d1';
import { SHORT_LINK_TTL, type StoredShortLink } from '../server/short-links/model';
import type { D1UsageDatabase, D1UsageStatement } from '../server/usage/d1';
import { preparedPapers } from '../data/papers';
import { createPreparedExperiment } from '../lib/prepared-figures';
import { snapshotFromPrepared } from '../lib/reading-state';
import { decodePublicSnapshot, encodePublicSnapshot } from '../lib/snapshots';
const paper = preparedPapers[0]; const snapshot = snapshotFromPrepared(paper, createPreparedExperiment(paper));
const origin = 'http://localhost:3000';
function request(body: unknown, method = 'POST', cookie?: string, requestOrigin = origin) { return new Request(origin + '/api/short-links', { method, headers: { origin: requestOrigin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
function binding(db: DatabaseSync): D1UsageDatabase { return { prepare(sql) { let values: unknown[] = []; const s: D1UsageStatement = {
  bind(...next) { values = next; return s; }, async first<T>() { return (db.prepare(sql).get(...values as never[]) ?? null) as T | null; }, async all<T>() { return { results: db.prepare(sql).all(...values as never[]) as T[], success: true }; }, async run() { const result = db.prepare(sql).run(...values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; },
}; return s; } }; }

test('explicit public links restore canonical public settings and keep deletion capability out of public URL/storage', async () => {
  const store = createSqliteShortLinkStore({ path: ':memory:' });
  try {
    const handlers = createShortLinkHandlers({ store, signingSecret: 'fixture-signing-key', now: () => 1000 });
    const supplied = structuredClone(snapshot); supplied.figure.caption = 'PRIVATE_DESCRIPTION_SHOULD_NOT_BE_STORED';
    const response = await handlers.create(request({ snapshot: supplied })); assert.equal(response.status, 201);
    const created = await response.json(); assert.match(created.path, /^\/s\/[a-f0-9]{32}$/); assert.equal(created.expiresAt, 1000 + SHORT_LINK_TTL);
    assert.equal(created.deleteToken.length, 64); assert.ok(!created.path.includes(created.deleteToken));
    const stored = await store.get(created.id, 1001); assert.ok(stored); assert.ok(!stored.payload.includes(created.deleteToken));
    assert.equal(JSON.stringify(decodePublicSnapshot(stored.payload)).includes('PRIVATE_DESCRIPTION'), false);
    const resolved = await handlers.resolve(new Request(origin + created.path), created.id); assert.equal(resolved.status, 302);
    const location = resolved.headers.get('location')!; assert.ok(location.startsWith('/#snapshot=')); assert.ok(!location.includes(created.deleteToken));
    assert.deepEqual(decodePublicSnapshot(location.slice('/#snapshot='.length)).state, createPreparedExperiment(paper));
    assert.equal(shortLinkDeleteHash(created.deleteToken).length, 64);
  } finally { store.close(); }
});

test('deletion requires an unguessable capability and expiry leaves a useful non-redirect response', async () => {
  const store = createSqliteShortLinkStore({ path: ':memory:' }); let now = 1000;
  try {
    const handlers = createShortLinkHandlers({ store, signingSecret: 'fixture-key', now: () => now });
    const created = await (await handlers.create(request({ snapshot }))).json();
    assert.equal((await handlers.remove(request({ id: created.id, deleteToken: '0'.repeat(64) }, 'DELETE'))).status, 404);
    assert.equal((await handlers.resolve(new Request(origin + created.path), created.id)).status, 302);
    assert.equal((await handlers.remove(request({ id: created.id, deleteToken: created.deleteToken }, 'DELETE'))).status, 200);
    assert.equal(await store.get(created.id, now), undefined);
    const gone = await handlers.resolve(new Request(origin + created.path), created.id); assert.equal(gone.status, 410); assert.match(await gone.text(), /Open the Paperplay/);
    const other = await (await handlers.create(request({ snapshot }))).json(); now += SHORT_LINK_TTL;
    assert.equal((await handlers.resolve(new Request(origin + other.path), other.id)).status, 410);
  } finally { store.close(); }
});

test('origin, private sources, additional fields, stale engines and missing signing config are rejected before storage', async () => {
  const store = createSqliteShortLinkStore({ path: ':memory:' });
  try {
    const handlers = createShortLinkHandlers({ store, signingSecret: 'fixture-key' });
    assert.equal((await handlers.create(request({ snapshot }, 'POST', undefined, 'https://attacker.example'))).status, 403);
    assert.equal((await handlers.create(request({ snapshot, source: paper.document }))).status, 400);
    assert.equal((await handlers.create(request({ snapshot: { ...snapshot, documentId: 'private-source' } }))).status, 400);
    const stale = structuredClone(snapshot); if (stale.figure.kind !== 'steps' && stale.figure.kind !== 'comparison' && stale.figure.execution.mode === 'computed') stale.figure.execution.binding.engineVersion = '99.0.0';
    assert.equal((await handlers.create(request({ snapshot: stale }))).status, 400);
    assert.equal((await createShortLinkHandlers({ store, signingSecret: '' }).create(request({ snapshot }))).status, 503);
  } finally { store.close(); }
});

test('deleting payloads does not reset the ten-link anonymous hourly allowance', async () => {
  const store = createSqliteShortLinkStore({ path: ':memory:' });
  try {
    const handlers = createShortLinkHandlers({ store, signingSecret: 'fixture-key', now: () => 1000 });
    let cookie: string | undefined;
    for (let i = 0; i < 10; i++) {
      const response = await handlers.create(request({ snapshot }, 'POST', cookie)); assert.equal(response.status, 201);
      cookie ??= response.headers.get('set-cookie')!.split(';')[0]; const created = await response.json();
      assert.equal((await handlers.remove(request({ id: created.id, deleteToken: created.deleteToken }, 'DELETE', cookie))).status, 200);
    }
    assert.equal((await handlers.create(request({ snapshot }, 'POST', cookie))).status, 429);
  } finally { store.close(); }
});

test('actual D1 SQL enforces global capacity atomically across independent handlers and deletes payload but retains tombstone', async () => {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../deploy/migrations/0000_paperplay.sql', import.meta.url), 'utf8'));
  try {
    const stores = Array.from({ length: 4 }, () => createD1ShortLinkStore({ db: binding(db) }));
    const createdAt = Date.UTC(2026, 9, 27, 10); const payload = encodePublicSnapshot(snapshot);
    const record = (i: number): StoredShortLink => ({ id: i.toString(16).padStart(32, '0'), deleteHash: 'f'.repeat(64), sessionId: i.toString(16).padStart(48, '0'), payload, createdAt, expiresAt: createdAt + SHORT_LINK_TTL });
    const attempts = await Promise.allSettled(Array.from({ length: 120 }, (_, i) => stores[i % stores.length].create(record(i))));
    assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 100);
    assert.equal(attempts.filter(item => item.status === 'rejected' && item.reason.status === 429).length, 20);
    assert.ok(await stores[0].get(record(0).id, createdAt));
    assert.equal(await stores[1].remove(record(0).id, '0'.repeat(64), createdAt), false);
    assert.equal(await stores[1].remove(record(0).id, record(0).deleteHash, createdAt), true);
    assert.equal(await stores[0].get(record(0).id, createdAt), undefined);
    const tombstone = db.prepare('SELECT payload,delete_hash FROM short_links WHERE id=?').get(record(0).id) as { payload: unknown; delete_hash: unknown };
    assert.deepEqual(tombstone.payload, null); assert.equal(tombstone.delete_hash, null);
    await assert.rejects(stores[0].create(record(121)), /allowance/);
  } finally { db.close(); }
});

test('database failure never produces a fake public link or leaks raw storage errors', async () => {
  const broken = createD1ShortLinkStore({ db: { prepare() { throw new Error('private database details'); } } });
  const handlers = createShortLinkHandlers({ store: broken, signingSecret: 'fixture-key' });
  const response = await handlers.create(request({ snapshot })); assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private database details'), false);
});
