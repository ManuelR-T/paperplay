import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createImportStorage } from '../lib/import-storage';
import { ANALYSIS_PIPELINE_VERSION, type ImportRecord } from '../shared/import-types';
import { sourceFixture } from '../shared/fixtures';

function record(): ImportRecord {
  return { id: sourceFixture.id, source: structuredClone(sourceFixture), stage: 'queued', updatedAt: 1,
    pipelineVersion: ANALYSIS_PIPELINE_VERSION, original: new Blob(['%PDF local source']), originalName: 'source.pdf',
    job: { token: 'signed-test-handle', model: 'fixture-model', sourceId: sourceFixture.id, sourceVersion: sourceFixture.sourceVersion, createdAt: 1 } };
}
function rawPut(factory: IDBFactory, name: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('imports', 'readwrite'); tx.objectStore('imports').put(value);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

test('IndexedDB saves original blobs and accepted-job checkpoints across store instances and deletion', async () => {
  const indexedDB = new IDBFactory();
  const first = createImportStorage({ indexedDB, name: 'durable-imports' });
  await first.put(record());
  const reopened = createImportStorage({ indexedDB, name: 'durable-imports' });
  const saved = await reopened.get(sourceFixture.id);
  assert.equal(saved?.stage, 'queued');
  assert.equal(saved?.job?.token, 'signed-test-handle');
  assert.equal(await saved?.original?.text(), '%PDF local source');
  assert.equal((await reopened.list()).length, 1);
  await reopened.remove(sourceFixture.id);
  assert.equal((await first.list()).length, 0);
});

test('corrupt or incompatible records cannot hide other valid papers or silently execute', async () => {
  const indexedDB = new IDBFactory(); const name = 'corrupt-imports';
  const storage = createImportStorage({ indexedDB, name });
  await storage.put(record());
  await rawPut(indexedDB, name, { id: 'broken', stage: 'complete', pipelineVersion: 'future-version' });
  const records = await storage.list();
  assert.equal(records.length, 1);
  assert.match(storage.warning!, /invalid or incompatible/);
  await assert.rejects(storage.get('broken'));
  await assert.rejects(storage.put({ ...record(), job: { ...record().job!, sourceVersion: 'wrong-source' } }), /does not match/);
});

test('a newer database is not reset or downgraded to make an old app appear successful', async () => {
  const indexedDB = new IDBFactory();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('future-imports', 2);
    request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error);
  });
  const storage = createImportStorage({ indexedDB, name: 'future-imports' });
  await assert.rejects(storage.list(), /newer Paperplay database/);
  const deniedFactory = { open() { throw new DOMException('Access denied', 'SecurityError'); } } as unknown as IDBFactory;
  await assert.rejects(createImportStorage({ indexedDB: deniedFactory }).put(record()), /unavailable/);
});
