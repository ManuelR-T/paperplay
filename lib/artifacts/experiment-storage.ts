import { validateArtifactCacheRecord, type ArtifactCacheRecord } from '../../shared/artifact-experiment';

export interface ArtifactExperimentStorage {
  get(key: string): Promise<ArtifactCacheRecord | undefined>;
  put(record: ArtifactCacheRecord, owner: string, options?: { accepted?: boolean }): Promise<void>;
  /** Most recently written/accessed first. Invalid originals remain stored and exportable. */
  list(owner?: string, options?: { acceptedOnly?: boolean }): Promise<ArtifactCacheRecord[]>;
  removeRecord(id: string, owner?: string): Promise<void>;
  removeOwner(owner: string): Promise<void>;
  exportOriginal(key: string): Promise<string | undefined>;
  readonly warning: string | null;
}
export class ArtifactExperimentStorageError extends Error { constructor(message: string) { super(message); this.name = 'ArtifactExperimentStorageError'; } }
type Stored = { id: string; record: unknown; owners: string[]; accepted: boolean; bytes: number; touched: number };
type Pointer = { key: string; id: string };
function error(value: unknown) {
  if (value instanceof ArtifactExperimentStorageError) return value;
  const name = value && typeof value === 'object' && 'name' in value ? value.name : '';
  return new ArtifactExperimentStorageError(name === 'VersionError' ? 'A newer artifact database exists. It was not reset; use a compatible application to export it.' : name === 'QuotaExceededError' ? 'Local artifact storage is full. Original accepted figures were retained; export them or explicitly remove records.' : 'Local artifact storage is unavailable. Original stored data was not reset.');
}
export function createArtifactExperimentStorage(options: { name?: string; indexedDB?: IDBFactory; maxEntries?: number; maxBytes?: number; now?: () => number } = {}): ArtifactExperimentStorage {
  const name = options.name ?? 'paperplay-artifact-experiments', maxEntries = options.maxEntries ?? 128, maxBytes = options.maxBytes ?? 20*1024*1024, now = options.now ?? Date.now;
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new ArtifactExperimentStorageError('Invalid artifact cache limits.');
  let warning: string | null = null;
  async function open(): Promise<IDBDatabase> {
    try { const factory = options.indexedDB ?? globalThis.indexedDB; if (!factory) throw Error();
      return await new Promise((resolve, reject) => { const request = factory.open(name, 1); let settled = false;
        request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' }); if (!db.objectStoreNames.contains('pointers')) db.createObjectStore('pointers', { keyPath: 'key' }); };
        request.onerror = () => { settled = true; reject(error(request.error)); };
        request.onblocked = () => { settled = true; reject(new ArtifactExperimentStorageError('Another tab blocks artifact storage. Close that tab and retry; no records were reset.')); };
        request.onsuccess = () => { if (settled) { request.result.close(); return; } settled = true; const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
      });
    } catch (cause) { throw error(cause); }
  }
  async function transaction<T>(mode: IDBTransactionMode, work: (records: Stored[], pointers: Pointer[], recordStore: IDBObjectStore, pointerStore: IDBObjectStore) => T): Promise<T> {
    const db = await open();
    try { return await new Promise<T>((resolve, reject) => { const tx = db.transaction(['records','pointers'], mode), records = tx.objectStore('records'), pointers = tx.objectStore('pointers'), a = records.getAll(), b = pointers.getAll(); let count = 0, result: T, failure: unknown;
      const ready = () => { if (++count !== 2) return; try { result = work(a.result, b.result, records, pointers); } catch (cause) { failure = cause; tx.abort(); } };
      a.onsuccess = ready; b.onsuccess = ready; tx.oncomplete = () => resolve(result); tx.onabort = () => reject(error(failure ?? tx.error)); tx.onerror = () => { failure ??= tx.error; };
    }); } catch (cause) { throw error(cause); } finally { db.close(); }
  }
  const validOwner = (owner: string) => { if (!owner || owner.length > 300) throw new ArtifactExperimentStorageError('Invalid artifact owner.'); };
  const find = (all: Stored[], pointers: Pointer[], key: string) => all.find(row => row.id === (pointers.find(pointer => pointer.key === key)?.id ?? key));
  return {
    get warning() { return warning; },
    async get(key) {
      const row = await transaction('readonly', (all, pointers) => find(all, pointers, key)); if (!row) return undefined;
      let checked: ArtifactCacheRecord; try { checked = await validateArtifactCacheRecord(row.record); } catch { throw new ArtifactExperimentStorageError('Artifact cache data is invalid or incompatible. The original record was retained and can be exported.'); }
      try { await transaction('readwrite', (all, _pointers, records) => { const current = all.find(item => item.id === row.id); if (current) records.put({ ...current, touched: Math.max(now(), ...all.map(item => item.touched + 1)) }); }); } catch { warning = 'The artifact was read, but its recent-use metadata could not be saved.'; } return checked;
    },
    async put(input, owner, settings = {}) {
      validOwner(owner); const record = await validateArtifactCacheRecord(input); const bytes = new TextEncoder().encode(JSON.stringify(record)).length;
      // Hash and purpose validation are asynchronous. Snapshot candidates before
      // the write transaction, then only evict the exact verified bytes below.
      const evictableSnapshots = new Map<string,string>();
      const candidates = await transaction('readonly', all => all.filter(item => item.id !== record.id && item.accepted === false));
      for (const item of candidates) { try { const checked = await validateArtifactCacheRecord(item.record); if (checked.id === item.id) evictableSnapshots.set(item.id,JSON.stringify(item.record)); } catch { /* corrupt/unknown originals remain available for recovery */ } }
      const replacements = new Set<string>();
      if (settings.accepted && record.kind === 'plan') {
        const prior = await transaction('readonly', all => all.filter(item => item.id !== record.id && item.accepted && item.owners?.includes(owner)));
        for (const item of prior) { try { const old = await validateArtifactCacheRecord(item.record); if (old.kind === 'plan' && old.key === record.key && old.identity.artifactSha256 === record.identity.artifactSha256) replacements.add(item.id); } catch { /* unknown/corrupt originals are never replaced */ } }
      }
      await transaction('readwrite', (all, pointers, records, pointerStore) => {
        const existing = all.find(item => item.id === record.id);
        const row: Stored = { id: record.id, record, owners: Array.from(new Set([...(existing?.owners ?? []), owner])), accepted: !!settings.accepted || !!existing?.accepted, bytes, touched: Math.max(now(), ...all.map(item => item.touched + 1)) };
        if (row.owners.length > 64) throw new ArtifactExperimentStorageError('Too many document references to one artifact record.');
        const retained = all.filter(item => item.id !== row.id).flatMap(item => { if (!replacements.has(item.id)) return [item]; const owners = item.owners.filter(value => value !== owner); return owners.length ? [{...item,owners}] : []; }); retained.push(row);
        let total = retained.reduce((sum,item) => sum + (Number.isSafeInteger(item.bytes) ? item.bytes : maxBytes), 0);
        const evictable = retained.filter(item => item.id !== row.id && item.accepted === false && Array.isArray(item.owners) && evictableSnapshots.has(item.id) && evictableSnapshots.get(item.id) === JSON.stringify(item.record)).sort((a,b) => a.touched - b.touched);
        const evicted: string[] = [];
        while (retained.length > maxEntries || total > maxBytes) { const oldest = evictable.shift(); if (!oldest) throw new ArtifactExperimentStorageError('Artifact cache limits reached. Accepted originals were retained; export or explicitly remove them.'); const index = retained.findIndex(item => item.id === oldest.id); retained.splice(index, 1); total -= oldest.bytes; evicted.push(oldest.id); }
        for (const id of evicted) { records.delete(id); for (const pointer of pointers) if (pointer.id === id) pointerStore.delete(pointer.key); }
        for (const id of replacements) { const replacement = retained.find(item => item.id === id); if (replacement) records.put(replacement); else records.delete(id); }
        records.put(row); pointerStore.put({ key: record.key, id: record.id });
      });
    },
    async list(owner, settings = {}) {
      if (owner !== undefined) validOwner(owner);
      const rows = await transaction('readonly', all => all.filter(item => (!settings.acceptedOnly || item.accepted === true) && (owner === undefined || item.owners?.includes(owner))).sort((a,b) => b.touched - a.touched));
      const result: ArtifactCacheRecord[] = []; let invalid = 0;
      for (const row of rows) { try { result.push(await validateArtifactCacheRecord(row.record)); } catch { invalid++; } }
      warning = invalid ? `${invalid} invalid or incompatible artifact records were retained for export.` : null; return result;
    },
    async removeRecord(id, owner) { if(owner!==undefined)validOwner(owner);await transaction('readwrite', (all, pointers, records, pointerStore) => { const row=all.find(item=>item.id===id);if(owner!==undefined&&row){if(!row.owners.includes(owner))return;const owners=row.owners.filter(value=>value!==owner);if(owners.length){records.put({...row,owners});return;}}records.delete(id); for (const pointer of pointers) if (pointer.id === id) pointerStore.delete(pointer.key); }); },
    async removeOwner(owner) { validOwner(owner); await transaction('readwrite', (all, pointers, records, pointerStore) => { for (const item of all) { if (!item.owners?.includes(owner)) continue; const owners = item.owners.filter(value => value !== owner); if (owners.length) records.put({ ...item, owners }); else { records.delete(item.id); for (const pointer of pointers) if (pointer.id === item.id) pointerStore.delete(pointer.key); } } }); },
    async exportOriginal(key) { const row = await transaction('readonly', (all, pointers) => find(all, pointers, key)); return row ? JSON.stringify(row.record) : undefined; },
  };
}
