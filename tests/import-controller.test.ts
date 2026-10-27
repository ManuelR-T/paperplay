import test from 'node:test';
import assert from 'node:assert/strict';
import { ImportController } from '../lib/import-controller';
import { type ImportStorage } from '../lib/import-storage';
import { ANALYSIS_PIPELINE_VERSION, type ImportRecord, type AnalysisResult } from '../shared/import-types';
import { sourceFixture, walkthroughFixture } from '../shared/fixtures';

const source = structuredClone(sourceFixture);
// Source is sufficiently long for real preparation validation; its cited passages stay unchanged.
source.blocks.push({ id: 'source-body', kind: 'paragraph', page: 2, text: 'This paper describes a synthetic illustrative method with source-linked steps. '.repeat(12) });
const job = { token: 'signed-test-handle', model: 'fixture-model', sourceId: source.id, sourceVersion: source.sourceVersion, createdAt: 1 };
const result: AnalysisResult = { pipelineVersion: ANALYSIS_PIPELINE_VERSION, document: source,
  summary: 'A source-grounded illustrative reading.', figures: [{ figure: walkthroughFixture, explanation: 'Inspect the array values in the cited passage.', sourceQuote: source.anchors[1].quote, sourcePage: 2 }], warnings: [], model: 'fixture-model' };
const ready = (): ImportRecord => ({ id: source.id, source: structuredClone(source), stage: 'ready', updatedAt: 1, pipelineVersion: ANALYSIS_PIPELINE_VERSION });
function memoryStore(initial: ImportRecord[] = []) {
  const values = new Map(initial.map(record => [record.id, structuredClone(record)]));
  const writes: string[] = [];
  const storage: ImportStorage = {
    async list() { return [...values.values()].map(record => structuredClone(record)); },
    async get(id) { return values.has(id) ? structuredClone(values.get(id)) : undefined; },
    async put(record) { writes.push(record.stage); values.set(record.id, structuredClone(record)); },
    async remove(id) { values.delete(id); },
  };
  return { storage, values, writes };
}
function controller(store: ReturnType<typeof memoryStore>, fetcher: typeof fetch, extra = {}) {
  return new ImportController({ storage: store.storage, extractPdf: async () => ({ source }), importArxiv: async () => ({ source }),
    fetch: fetcher, wait: async () => {}, pollAttempts: 2, requestId: () => 'fixture-request-id', now: () => 10, ...extra });
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('opening an exploration result imports the pinned arXiv source without starting Meta', async () => {
  const store = memoryStore(); const imported: string[] = []; const requests: string[] = [];
  const instance = controller(store, (async (url) => { requests.push(String(url)); throw new Error('No model request expected'); }) as typeof fetch,
    { importArxiv: async (input: string) => { imported.push(input); return { source }; } });
  await instance.refresh();
  const id = await instance.importArxiv('1706.03762v7', { analyze: false });
  assert.deepEqual(imported, ['1706.03762v7']); assert.deepEqual(requests, []);
  assert.equal(id, source.id); assert.equal(store.values.get(source.id)?.stage, 'ready');
  assert.equal(store.values.get(source.id)?.job, undefined);
});

test('durable source and submitting checkpoints precede a single paid creation; final output is validated and cached', async () => {
  const store = memoryStore([ready()]); const calls: string[] = [];
  const instance = controller(store, (async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/start')) {
      assert.deepEqual(store.writes.slice(0, 2), ['ready', 'submitting']);
      return reply({ status: 'queued', job });
    }
    return reply({ status: 'complete', job, result });
  }) as typeof fetch);
  await instance.refresh(); instance.select(source.id); await instance.analyze();
  assert.equal(calls.filter(url => url.endsWith('/start')).length, 1);
  assert.equal(instance.getSnapshot().records[0].stage, 'complete');
  assert.ok(instance.getSnapshot().records[0].analysis);
  await instance.analyze();
  assert.equal(calls.length, 2, 'reopening a completed analysis must not create or poll a job');
});

test('confirmed provider rejection remains explicitly retryable while an unknown gateway failure is uncertain', async () => {
  for (const confirmed of [true, false]) {
    const instance = controller(memoryStore([ready()]), (async () => reply({ error: 'Provider unavailable.', ...(confirmed ? { uncertain: false } : {}) }, 502)) as typeof fetch);
    await instance.refresh(); instance.select(source.id); await instance.analyze();
    assert.equal(instance.getSnapshot().records[0].stage, confirmed ? 'failed' : 'uncertain');
  }
});

test('lost submission responses become uncertain and cannot be automatically resubmitted', async () => {
  const store = memoryStore([ready()]); let starts = 0;
  const instance = controller(store, (async () => { starts++; throw new TypeError('Network interrupted'); }) as typeof fetch);
  await instance.refresh(); instance.select(source.id); await instance.analyze();
  assert.equal(instance.getSnapshot().records[0].stage, 'uncertain');
  await instance.analyze();
  assert.equal(starts, 1);
  const reopened = controller(store, (async () => { throw Error('No automatic API call allowed'); }) as typeof fetch);
  await reopened.refresh(); await settle();
  assert.equal(reopened.getSnapshot().records[0].stage, 'uncertain');
  assert.equal(reopened.getSnapshot().busy, false);
});

test('refresh resumes accepted jobs through status only, and submitting without a handle recovers as uncertain', async () => {
  const store = memoryStore([{ ...ready(), stage: 'queued', job }]); const urls: string[] = [];
  const instance = controller(store, (async url => { urls.push(String(url)); return reply({ status: 'complete', job, result }); }) as typeof fetch);
  await instance.refresh(); await settle();
  assert.deepEqual(urls, ['/api/analysis/status']);
  assert.equal(instance.getSnapshot().records[0].stage, 'complete');
  const uncertainStore = memoryStore([{ ...ready(), stage: 'submitting', requestId: 'previous-request' }]);
  const uncertain = controller(uncertainStore, (async () => { throw Error('Creation must not restart'); }) as typeof fetch);
  await uncertain.refresh();
  assert.equal(uncertain.getSnapshot().records[0].stage, 'uncertain');
});

test('checkpoint/quota failures prevent creation and clearly report unsaved state', async () => {
  const store = memoryStore([ready()]); let starts = 0;
  store.storage.put = async () => { throw new Error('Local storage is full.'); };
  const instance = controller(store, (async () => { starts++; return reply({ status: 'queued', job }); }) as typeof fetch);
  await instance.refresh(); instance.select(source.id); await instance.analyze();
  assert.equal(starts, 0);
  assert.match(instance.getSnapshot().warning!, /storage is full/);
  assert.equal(instance.getSnapshot().records[0].stage, 'failed');
});

test('polling is finite, retains accepted references on network loss, and resumes without replacement jobs', async () => {
  const store = memoryStore([{ ...ready(), stage: 'queued', job }]); let statusCalls = 0;
  const instance = controller(store, (async () => { statusCalls++; return reply({ status: 'analyzing', job }); }) as typeof fetch);
  await instance.refresh(); await settle();
  assert.equal(statusCalls, 2);
  assert.equal(instance.getSnapshot().busy, false);
  assert.match(instance.getSnapshot().error!, /still running/);
  assert.equal(instance.getSnapshot().records[0].job?.token, job.token);
  const interrupted = controller(store, (async () => { throw new TypeError('Offline'); }) as typeof fetch);
  await interrupted.refresh(); await settle();
  assert.equal(interrupted.getSnapshot().records[0].job?.token, job.token);
  assert.equal(interrupted.getSnapshot().records[0].stage, 'analyzing');
  assert.match(interrupted.getSnapshot().error!, /Resume/);
});

test('invalid generation is never activated, and a source can remain readable after a known creation error', async () => {
  const store = memoryStore([ready()]);
  const instance = controller(store, (async url => String(url).endsWith('/start') ? reply({ status: 'queued', job }) : reply({ status: 'complete', job, result: { ...result, document: { ...source, title: 'Rewritten source' } } })) as typeof fetch);
  await instance.refresh(); instance.select(source.id); await instance.analyze();
  assert.equal(instance.getSnapshot().records[0].stage, 'failed');
  assert.equal(instance.getSnapshot().records[0].analysis, undefined);
  assert.deepEqual(instance.getSnapshot().records[0].source, source);
  const unavailable = controller(memoryStore([ready()]), (async () => reply({ error: 'Meta is not configured.' }, 503)) as typeof fetch);
  await unavailable.refresh(); unavailable.select(source.id); await unavailable.analyze();
  assert.equal(unavailable.getSnapshot().records[0].stage, 'failed');
  assert.match(unavailable.getSnapshot().error!, /not configured/);
});

test('deleting a pending analysis first confirms cancellation, while completed records delete locally', async () => {
  const store = memoryStore([{ ...ready(), stage: 'queued', job }]); const urls: string[] = [];
  // A nonpending initial restore avoids auto polling while testing explicit deletion.
  store.values.set(source.id, { ...ready(), stage: 'failed', job });
  const instance = controller(store, (async url => { urls.push(String(url)); return reply({ status: 'cancelled', job }); }) as typeof fetch);
  await instance.refresh();
  store.values.set(source.id, { ...ready(), stage: 'queued', job });
  // Re-load with a controller whose status check remains pending; removal subsequently cancels that reference.
  const pending = controller(store, (async url => { urls.push(String(url)); return String(url).endsWith('/cancel') ? reply({ status: 'cancelled', job }) : reply({ status: 'queued', job }); }) as typeof fetch, { pollAttempts: 1 });
  await pending.refresh(); await settle();
  await pending.remove(source.id);
  assert.ok(urls.includes('/api/analysis/cancel'));
  assert.equal(pending.getSnapshot().records.length, 0);
  assert.equal(store.values.size, 0);
});

test('cancelling a new extraction does not cancel the previously selected completed paper', async () => {
  const store = memoryStore([{ ...ready(), stage: 'complete', job, analysis: result }]); let providerCalls = 0;
  const instance = controller(store, (async () => { providerCalls++; return reply({ status: 'cancelled', job }); }) as typeof fetch, {
    extractPdf: async (_file: File, options: { signal: AbortSignal }) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }),
  });
  await instance.refresh(); instance.select(source.id);
  const extracting = instance.importPdf(new File(['unused'], 'new.pdf'));
  assert.equal(instance.getSnapshot().stage, 'extracting');
  await instance.cancel(); await extracting;
  assert.equal(providerCalls, 0);
  assert.equal(instance.getSnapshot().records[0].stage, 'complete');
  assert.equal(instance.getSnapshot().stage, 'cancelled');
});

test('read-first import prepares a long source and returns its identity without any paid analysis',async()=>{
 const long=structuredClone(source);for(let i=0;i<5;i++)long.blocks.push({id:`long-${i}`,kind:'paragraph',page:2,text:'A source passage retained in full. '.repeat(500)});
 const store=memoryStore();let calls=0;const instance=controller(store,(async()=>{calls++;throw Error('No inference was requested')}) as typeof fetch,{extractPdf:async()=>({source:long})});
 await instance.refresh();const id=await instance.importPdf(new File(['unused'],'long.pdf'),{analyze:false});
 assert.equal(id,long.id);assert.equal(calls,0);assert.equal(instance.getSnapshot().stage,'ready');assert.equal(instance.getSnapshot().busy,false);assert.deepEqual(store.values.get(long.id)?.source.blocks,long.blocks);
});
