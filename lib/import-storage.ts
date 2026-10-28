import { validateExtractionEvidenceManifest } from './extraction/model';
import { ANALYSIS_PIPELINE_VERSION, type ImportRecord, type ImportStage } from '../shared/import-types';
import { validateDocument } from '../shared/schema';
import { bundleAttributionSchema } from './snapshots';
import { validateAnalysisResult } from './analysis';

const STAGES: ImportStage[] = ['extracting', 'preparing', 'ready', 'submitting', 'queued', 'analyzing', 'validating', 'complete', 'cancelled', 'failed', 'uncertain', 'expired'];
export class ImportStorageError extends Error {
  constructor(message: string) { super(message); this.name = 'ImportStorageError'; }
}
export interface ImportStorage {
  list(): Promise<ImportRecord[]>;
  get(id: string): Promise<ImportRecord | undefined>;
  put(record: ImportRecord): Promise<void>;
  remove(id: string): Promise<void>;
  readonly warning?: string | null;
}

/** Storage is a boundary: corrupted records never become executable figures. */
export function validateImportRecord(value: unknown): ImportRecord {
  if (!value || typeof value !== 'object') throw new ImportStorageError('A saved import is invalid.');
  const record = value as ImportRecord;
  const source = validateDocument(record.source);
  if (record.id !== source.id || record.pipelineVersion !== ANALYSIS_PIPELINE_VERSION || !STAGES.includes(record.stage)
    || !Number.isFinite(record.updatedAt) || record.updatedAt < 0) throw new ImportStorageError('A saved import uses an invalid or unsupported format.');
  if (record.original !== undefined && !(record.original instanceof Blob)) throw new ImportStorageError('A saved PDF is invalid.');
  if (record.originalName !== undefined && (typeof record.originalName !== 'string' || record.originalName.length > 500)) throw new ImportStorageError('A saved file name is invalid.');
  if (record.originalUrl !== undefined && (typeof record.originalUrl !== 'string' || record.originalUrl.length > 2_000 || !/^https?:\/\//.test(record.originalUrl))) throw new ImportStorageError('A saved source link is invalid.');
  if (record.error !== undefined && (typeof record.error !== 'string' || record.error.length > 8_000)) throw new ImportStorageError('A saved error message is invalid.');
  if (record.requestId !== undefined && (typeof record.requestId !== 'string' || record.requestId.length > 200)) throw new ImportStorageError('A saved request reference is invalid.');
  if (record.job && (typeof record.job.token !== 'string' || !record.job.token || record.job.token.length > 16_384
    || typeof record.job.model !== 'string' || record.job.model.length > 120 || record.job.sourceId !== source.id || record.job.sourceVersion !== source.sourceVersion
    || !Number.isFinite(record.job.createdAt) || record.job.createdAt < 0)) throw new ImportStorageError('The saved analysis reference does not match its source.');
  if (record.attribution) bundleAttributionSchema.parse(record.attribution);
  const analysis = record.analysis ? validateAnalysisResult(record.analysis, source) : undefined;
  if (record.stage === 'complete' && !record.analysis) throw new ImportStorageError('A completed import has no validated result.');
  const rawRecovery=record.extractionEvidenceRecovery as unknown;
  const recovery=rawRecovery===undefined?undefined:rawRecovery&&typeof rawRecovery==='object'&&!Array.isArray(rawRecovery)&&'original'in rawRecovery&&'reason'in rawRecovery&&typeof rawRecovery.reason==='string'
    ?{original:rawRecovery.original,reason:rawRecovery.reason.slice(0,1000)}
    :{original:rawRecovery,reason:'The saved extraction recovery metadata is incompatible. Its original object remains available for explicit recovery.'};
  return { ...record, source, ...(analysis ? { analysis } : {}),...(recovery?{extractionEvidenceRecovery:recovery}:{}) };
}

async function validateStoredImport(value:unknown):Promise<ImportRecord>{
  const record=validateImportRecord(value);
  if(record.extractionEvidence!==undefined){
    try{return {...record,extractionEvidence:await validateExtractionEvidenceManifest(record.extractionEvidence,record.source)};}
    catch{return {...record,extractionEvidence:undefined,extractionEvidenceRecovery:{original:record.extractionEvidence,reason:'The saved extraction evidence is invalid, incompatible or belongs to different source content. Its original record is retained separately; the source and PDF remain readable.'}};}
  }
  return record;
}

function storageError(error: unknown): ImportStorageError {
  const name = error instanceof Error || (error && typeof error === 'object' && 'name' in error) ? String(error.name) : '';
  if (name === 'QuotaExceededError') return new ImportStorageError('Local storage is full. Free space or remove an imported paper; this change was not saved.');
  if (name === 'VersionError') return new ImportStorageError('This browser has a newer Paperplay database. Use a compatible application version; your data was not reset.');
  return error instanceof ImportStorageError ? error : new ImportStorageError('Local storage is unavailable. This change was not saved; reloading may lose it.');
}

export function createImportStorage(options: { name?: string; indexedDB?: IDBFactory } = {}): ImportStorage {
  const name = options.name ?? 'paperplay-imports';
  let warning: string | null = null;
  const factory = () => options.indexedDB ?? globalThis.indexedDB;
  async function open(): Promise<IDBDatabase> {
    const indexedDB = factory();
    if (!indexedDB) throw new ImportStorageError('Local storage is unavailable. Imported documents cannot survive a reload.');
    return new Promise((resolve, reject) => {
      let settled = false;
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('imports')) request.result.createObjectStore('imports', { keyPath: 'id' });
      };
      request.onerror = () => { settled = true; reject(storageError(request.error)); };
      request.onblocked = () => { settled = true; reject(new ImportStorageError('Local storage upgrade is blocked by another Paperplay tab. Close that tab and retry.')); };
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }
  async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    let db: IDBDatabase | undefined;
    try {
      db = await open();
      const tx = db.transaction('imports', mode);
      const request = action(tx.objectStore('imports'));
      return await new Promise<T>((resolve, reject) => {
        let result: T;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(storageError(request.error));
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(storageError(tx.error));
        tx.onerror = () => reject(storageError(tx.error));
      });
    } catch (error) { throw storageError(error); }
    finally { db?.close(); }
  }
  return {
    get warning() { return warning; },
    async list() {
      const raw = await transaction<unknown[]>('readonly', store => store.getAll());
      const records: ImportRecord[] = [];
      let invalid = 0;
      for (const item of raw) {
        try { records.push(await validateStoredImport(item)); } catch { invalid++; }
      }
      warning = invalid ? `${invalid} saved import${invalid === 1 ? ' was' : 's were'} invalid or incompatible and could not be opened. Other saved papers are available; no data was deleted.` : null;
      return records.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) {
      const raw = await transaction<unknown>('readonly', store => store.get(id));
      return raw === undefined ? undefined : validateStoredImport(raw);
    },
    async put(record) { const checked=await validateStoredImport(record);await transaction('readwrite', store => store.put(checked)); },
    async remove(id) { await transaction('readwrite', store => store.delete(id)); },
  };
}
