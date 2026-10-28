import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AnalysisHttpError } from '../analysis/security';
import {applicationQuotasEnabled} from '../usage/model';
import {capabilitySelectionReceiptSchema,modelRequestMetricsSchema,type CapabilitySelectionReceipt,type ModelRequestMetrics} from '../../shared/capability-retrieval';
import type { EnrichmentAction, EnrichmentBudget } from '../../lib/enrichment/contracts';

export const DOCUMENT_LIMITS = { maxRequests: 8, maxTokens: 1_000_000 } as const;
export type EnrichmentRecord = { id: string; owner: string; documentHash: string; contextHash: string; action: EnrichmentAction | 'artifact'; sectionId: string; createdAt: number; reservedTokens: number; status: 'reserved' | 'accepted' | 'completed' | 'cancelled' | 'failed' | 'incomplete' | 'validation_failed' | 'uncertain' | 'rejected'; providerId?: string; actualTokens?: number;actualUsage?:{inputTokens:number;outputTokens:number;totalTokens:number};retrieval?:CapabilitySelectionReceipt;requestMetrics?:ModelRequestMetrics;requestSha256?:string };
export type GenerationRunRecord = { runId: string; owner: string; documentHash: string; contextHash: string; model: string; sectionId: string; maxAttempts: number; createdAt: number; deadlineAt: number; reservedTokens: number; closed: boolean; retrieval?:CapabilitySelectionReceipt;previewMetrics?:ModelRequestMetrics;promptContractSha256?:string;sdkSha256?:string; attempts: Array<{ id: string; fingerprint: string; candidateSha256?: string }> };
export type EnrichmentStore = {
  record(id:string,owner:string):EnrichmentRecord|undefined;
  reserve(input: Omit<EnrichmentRecord, 'status' | 'createdAt'>): { created: boolean; record: EnrichmentRecord };
  settle(id: string, update: { status: EnrichmentRecord['status']; providerId?: string; actualTokens?: number;actualUsage?:{inputTokens:number;outputTokens:number;totalTokens:number} }): void;
  budget(owner: string, documentHash: string): EnrichmentBudget;
  prepareGenerationRun(input: Omit<GenerationRunRecord, 'createdAt' | 'deadlineAt' | 'reservedTokens' | 'closed' | 'attempts'>): GenerationRunRecord;
  generationRun(runId: string, owner: string): GenerationRunRecord;
  generationAttempt(runId: string, owner: string, attempt: number): EnrichmentRecord;
  claimGenerationAttempt(runId: string, owner: string, attempt: number, input: Omit<EnrichmentRecord, 'status' | 'createdAt'>): { created: boolean; record: EnrichmentRecord };
  recordGenerationCandidate(runId: string, owner: string, attempt: number, sha256: string): void;
  closeGenerationRun(runId: string, owner: string): GenerationRunRecord;
  close(): void;
};
function unavailable(): never { throw new AnalysisHttpError(503, 'The durable per-paper allowance is unavailable. No new paid enrichment was started.'); }
function tokens(r: EnrichmentRecord) { return r.status === 'rejected' ? 0 : ['reserved','accepted','uncertain'].includes(r.status) ? Math.max(r.reservedTokens, r.actualTokens ?? 0) : r.actualTokens ?? r.reservedTokens; }

/** Durable metadata only: no paper text, feedback, generated content, cookie or signed capability. */
export function createEnrichmentStore(options: { path: string; now?: () => number; limits?: { maxRequests: number; maxTokens: number };enforceLimits?:boolean }): EnrichmentStore {
  const limits = options.limits ?? DOCUMENT_LIMITS;const enforceLimits=options.enforceLimits!==false; const now = options.now ?? Date.now;
  if (!Object.values(limits).every(v => Number.isSafeInteger(v) && v > 0)) return unavailable();
  let db: DatabaseSync;
  try {
    if (options.path !== ':memory:') mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(options.path); db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS enrichment_records(id TEXT PRIMARY KEY,owner TEXT NOT NULL,document_hash TEXT NOT NULL,record TEXT NOT NULL); CREATE INDEX IF NOT EXISTS enrichment_document ON enrichment_records(owner,document_hash); CREATE TABLE IF NOT EXISTS artifact_generation_runs(id TEXT PRIMARY KEY,record TEXT NOT NULL);');
  } catch { return unavailable(); }
  const records = (owner: string, documentHash: string) => (db.prepare('SELECT record FROM enrichment_records WHERE owner=? AND document_hash=?').all(owner, documentHash) as { record: string }[]).map(r => JSON.parse(r.record) as EnrichmentRecord);
  function budget(owner: string, documentHash: string): EnrichmentBudget { const all = records(owner, documentHash).filter(r => r.status !== 'rejected'); return { requests: all.length, maxRequests: enforceLimits?limits.maxRequests:Number.MAX_SAFE_INTEGER, accountedTokens: all.reduce((sum,r) => sum + tokens(r),0), maxTokens: enforceLimits?limits.maxTokens:Number.MAX_SAFE_INTEGER }; }
  function transaction<T>(work: () => T): T { let began = false; try { db.exec('BEGIN IMMEDIATE'); began = true; const result = work(); db.exec('COMMIT'); return result; } catch (error) { if (began) db.exec('ROLLBACK'); if (error instanceof AnalysisHttpError) throw error; return unavailable(); } }
  function readRun(runId: string, owner: string): GenerationRunRecord {
    const row = db.prepare('SELECT record FROM artifact_generation_runs WHERE id=?').get(runId) as { record: string } | undefined;
    if (!row) throw new AnalysisHttpError(404, 'The generation run is unavailable. No replacement was created.');
    const run = JSON.parse(row.record) as GenerationRunRecord;
    if (run.owner !== owner) throw new AnalysisHttpError(403, 'This generation run belongs to another session.');
    return run;
  }
  function writeRun(run: GenerationRunRecord) { db.prepare('UPDATE artifact_generation_runs SET record=? WHERE id=?').run(JSON.stringify(run), run.runId); }
  function readAttempt(run: GenerationRunRecord, attempt: number): EnrichmentRecord {
    const item = run.attempts[attempt - 1];
    if (!item) throw new AnalysisHttpError(409, 'This generation attempt has not been claimed.');
    const row = db.prepare('SELECT record FROM enrichment_records WHERE id=?').get(item.id) as { record: string } | undefined;
    if (!row) return unavailable();
    return JSON.parse(row.record) as EnrichmentRecord;
  }
  function reserve(input: Omit<EnrichmentRecord, 'status' | 'createdAt'>) {
      if(input.retrieval)capabilitySelectionReceiptSchema.parse(input.retrieval);if(input.requestMetrics){modelRequestMetricsSchema.parse(input.requestMetrics);if(input.requestMetrics.reservedTokens!==input.reservedTokens)throw new AnalysisHttpError(400,'Prompt accounting differs from the durable token reservation.');}if(input.requestSha256&&!/^[a-f0-9]{64}$/.test(input.requestSha256))throw new AnalysisHttpError(400,'Invalid prompt digest.');
      if (!/^[a-f0-9]{64}$/.test(input.id) || !/^[a-f0-9]{48}$/.test(input.owner) || !/^[a-f0-9]{64}$/.test(input.documentHash) || !/^[a-f0-9]{64}$/.test(input.contextHash) || !Number.isSafeInteger(input.reservedTokens) || input.reservedTokens < 1 || (enforceLimits&&input.reservedTokens > limits.maxTokens)) throw new AnalysisHttpError(400, 'Invalid bounded paper reservation.');
        const existing = db.prepare('SELECT record FROM enrichment_records WHERE id=?').get(input.id) as { record: string } | undefined;
        if (existing) {
          const record = JSON.parse(existing.record) as EnrichmentRecord;
          if (record.owner !== input.owner || record.documentHash !== input.documentHash || record.contextHash !== input.contextHash || record.action !== input.action || record.sectionId !== input.sectionId) throw new AnalysisHttpError(409, 'This enrichment request already belongs to different context.');
          if(record.status!=='rejected'||record.actualTokens!==0||record.providerId)return { created: false, record };
          // Only a definitive zero-provider rejection can re-enter admission. The global
          // reservation still must be newly created before any provider submission.
          const available=budget(input.owner,input.documentHash);
          if(enforceLimits&&(available.requests>=limits.maxRequests||available.accountedTokens+input.reservedTokens>limits.maxTokens))throw new AnalysisHttpError(429,'The per-paper enrichment request/token allowance is reached.');
          const retry={...record,status:'reserved' as const,actualTokens:undefined,actualUsage:undefined};
          db.prepare('UPDATE enrichment_records SET record=? WHERE id=?').run(JSON.stringify(retry),record.id);
          return {created:true,record:retry};
        }
        const available = budget(input.owner, input.documentHash);
        if (enforceLimits&&(available.requests >= limits.maxRequests || available.accountedTokens + input.reservedTokens > limits.maxTokens)) throw new AnalysisHttpError(429, 'The per-paper enrichment request/token allowance is reached. Existing results and accepted jobs remain available.');
        const record: EnrichmentRecord = { ...input, createdAt: now(), status: 'reserved' };
        db.prepare('INSERT INTO enrichment_records(id,owner,document_hash,record) VALUES(?,?,?,?)').run(record.id, record.owner, record.documentHash, JSON.stringify(record));
        return { created: true, record };
  }
  return {
    record(id,owner){const row=db.prepare('SELECT record FROM enrichment_records WHERE id=? AND owner=?').get(id,owner) as {record:string}|undefined;return row?JSON.parse(row.record) as EnrichmentRecord:undefined;},
    reserve(input) { return transaction(() => reserve(input)); },
    prepareGenerationRun(input) {
      if(input.retrieval)capabilitySelectionReceiptSchema.parse(input.retrieval);if(input.previewMetrics)modelRequestMetricsSchema.parse(input.previewMetrics);
      if (!/^[a-f0-9-]{36}$/i.test(input.runId) || !/^[a-f0-9]{48}$/.test(input.owner) || !/^[a-f0-9]{64}$/.test(input.documentHash) || !/^[a-f0-9]{64}$/.test(input.contextHash) || !Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 3) throw new AnalysisHttpError(400, 'Invalid generation run.');
      return transaction(() => {
        const existing = db.prepare('SELECT record FROM artifact_generation_runs WHERE id=?').get(input.runId);
        if (existing) { const run = readRun(input.runId, input.owner); if (run.contextHash !== input.contextHash || run.documentHash !== input.documentHash || run.maxAttempts !== input.maxAttempts || run.model !== input.model || run.sectionId !== input.sectionId||run.retrieval?.receiptSha256!==input.retrieval?.receiptSha256) throw new AnalysisHttpError(409, 'The run identifier belongs to different frozen context.'); return run; }
        const createdAt = now(); const run: GenerationRunRecord = { ...input, createdAt, deadlineAt: createdAt + 300_000, reservedTokens: 0, closed: false, attempts: [] };
        db.prepare('INSERT INTO artifact_generation_runs(id,record) VALUES(?,?)').run(run.runId, JSON.stringify(run)); return run;
      });
    },
    generationRun(runId, owner) { return readRun(runId, owner); },
    generationAttempt(runId, owner, attempt) { return readAttempt(readRun(runId, owner), attempt); },
    claimGenerationAttempt(runId, owner, attempt, input) {
      return transaction(() => {
        const run = readRun(runId, owner);
        if (!Number.isInteger(attempt) || attempt < 1 || attempt > run.maxAttempts || input.owner !== owner || input.documentHash !== run.documentHash || input.sectionId !== run.sectionId || input.action !== 'artifact') throw new AnalysisHttpError(409, 'Invalid generation attempt scope.');
        if(run.retrieval&&input.retrieval?.receiptSha256!==run.retrieval.receiptSha256)throw new AnalysisHttpError(409,'The attempt capability selection differs from the frozen run.');
        const existing = run.attempts[attempt - 1];
        if(existing){if(existing.id!==input.id||existing.fingerprint!==input.contextHash)throw new AnalysisHttpError(409,'This attempt already belongs to different input.');const prior=readAttempt(run,attempt);if(prior.status!=='rejected'||prior.actualTokens!==0||prior.providerId)return {created:false,record:prior};if(run.closed||now()>=run.deadlineAt)throw new AnalysisHttpError(410,'The original custom-figure creation window expired while waiting for allowance. Existing source and figures remain available.');return reserve(input);}
        if (run.closed || now() >= run.deadlineAt) throw new AnalysisHttpError(410, 'The generation run is closed or its five-minute creation budget expired.');
        if (attempt !== run.attempts.length + 1) throw new AnalysisHttpError(409, 'Generation attempts must be sequential.');
        if (attempt > 1 && ['reserved','accepted','uncertain'].includes(readAttempt(run, attempt - 1).status)) throw new AnalysisHttpError(409, 'Resolve the previous accepted or uncertain attempt before repairing.', true);
        if (enforceLimits&&run.reservedTokens + input.reservedTokens > 666_000) throw new AnalysisHttpError(429, 'The generation token budget is exhausted.');
        const result = reserve(input); if (!result.created) throw new AnalysisHttpError(409, 'This attempt reference already exists.', true);
        run.attempts.push({ id: input.id, fingerprint: input.contextHash }); run.reservedTokens += input.reservedTokens; writeRun(run); return result;
      });
    },
    recordGenerationCandidate(runId, owner, attempt, sha256) {
      if (!/^[a-f0-9]{64}$/.test(sha256)) throw new AnalysisHttpError(400, 'Invalid candidate digest.');
      transaction(() => { const run = readRun(runId, owner); const item = run.attempts[attempt - 1]; if (!item) throw new AnalysisHttpError(409, 'Unknown attempt.'); if (item.candidateSha256 && item.candidateSha256 !== sha256) throw new AnalysisHttpError(409, 'The accepted response candidate changed.'); item.candidateSha256 = sha256; writeRun(run); });
    },
    closeGenerationRun(runId, owner) { return transaction(() => { const run = readRun(runId, owner); run.closed = true; writeRun(run); return run; }); },
    settle(id, update) {
      if(update.actualUsage&&(!Object.values(update.actualUsage).every(value=>Number.isSafeInteger(value)&&value>=0)||update.actualUsage.totalTokens!==update.actualUsage.inputTokens+update.actualUsage.outputTokens))throw new AnalysisHttpError(400,'Invalid measured provider usage.');
      if (update.actualTokens !== undefined && (!Number.isSafeInteger(update.actualTokens) || update.actualTokens < 0)) throw new AnalysisHttpError(400, 'Invalid measured enrichment usage.');
      if (update.providerId !== undefined && !/^resp_[a-zA-Z0-9_-]{1,250}$/.test(update.providerId)) throw new AnalysisHttpError(400, 'Invalid provider reference.');
      transaction(() => {
        const stored = db.prepare('SELECT record FROM enrichment_records WHERE id=?').get(id) as { record: string } | undefined; if (!stored) return;
        const previous = JSON.parse(stored.record) as EnrichmentRecord;
        const terminal = !['reserved','accepted','uncertain'].includes(previous.status);
        if (terminal && ['reserved','accepted','uncertain'].includes(update.status)) return;
        // Provider cancellation/late polls must not rewrite a final artifact outcome
        // or reduce already measured spend. Existing catalog settlement stays compatible.
        const artifactTerminal = terminal && previous.action === 'artifact';
        const actualTokens = update.actualTokens === undefined ? previous.actualTokens : Math.max(previous.actualTokens ?? 0, update.actualTokens);
        db.prepare('UPDATE enrichment_records SET record=? WHERE id=?').run(JSON.stringify({ ...previous, ...update, ...(artifactTerminal ? { status: previous.status } : {}), ...(actualTokens === undefined ? {} : { actualTokens }),...((previous.actualUsage?.totalTokens??-1)>(update.actualUsage?.totalTokens??-1)?{actualUsage:previous.actualUsage}:{}) }), id);
      });
    },
    budget(owner, documentHash) { try { return budget(owner, documentHash); } catch { return unavailable(); } },
    close() { db.close(); },
  };
}

let store: EnrichmentStore | undefined;
export function getEnrichmentStore() {
  if (process.env.PAPERPLAY_DEPLOYMENT === 'distributed' || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.CF_PAGES) throw new AnalysisHttpError(503, 'New enrichment requires a shared per-paper ledger; this Node feature is configured for one persistent host.');
  const path = process.env.ENRICHMENT_BUDGET_PATH ?? process.env.ENRICHMENT_SQLITE_PATH ?? (process.env.USAGE_SQLITE_PATH ? resolve(dirname(process.env.USAGE_SQLITE_PATH), 'enrichment-budget.sqlite') : '.paperplay/enrichment-budget.sqlite');
  return store ??= createEnrichmentStore({ path: resolve(/* turbopackIgnore: true */ path),enforceLimits:applicationQuotasEnabled(process.env) });
}
