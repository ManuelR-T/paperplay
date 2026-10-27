import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AnalysisHttpError } from '../analysis/security';
import type { EnrichmentAction, EnrichmentBudget } from '../../lib/enrichment/contracts';

export const DOCUMENT_LIMITS = { maxRequests: 8, maxTokens: 1_000_000 } as const;
export type EnrichmentRecord = { id: string; owner: string; documentHash: string; contextHash: string; action: EnrichmentAction; sectionId: string; createdAt: number; reservedTokens: number; status: 'reserved' | 'accepted' | 'completed' | 'cancelled' | 'failed' | 'incomplete' | 'validation_failed' | 'uncertain' | 'rejected'; providerId?: string; actualTokens?: number };
export type EnrichmentStore = {
  reserve(input: Omit<EnrichmentRecord, 'status' | 'createdAt'>): { created: boolean; record: EnrichmentRecord };
  settle(id: string, update: { status: EnrichmentRecord['status']; providerId?: string; actualTokens?: number }): void;
  budget(owner: string, documentHash: string): EnrichmentBudget;
  close(): void;
};
function unavailable(): never { throw new AnalysisHttpError(503, 'The durable per-paper allowance is unavailable. No new paid enrichment was started.'); }
function tokens(r: EnrichmentRecord) { return r.status === 'rejected' ? 0 : ['reserved','accepted','uncertain'].includes(r.status) ? Math.max(r.reservedTokens, r.actualTokens ?? 0) : r.actualTokens ?? r.reservedTokens; }

/** Durable metadata only: no paper text, feedback, generated content, cookie or signed capability. */
export function createEnrichmentStore(options: { path: string; now?: () => number; limits?: { maxRequests: number; maxTokens: number } }): EnrichmentStore {
  const limits = options.limits ?? DOCUMENT_LIMITS; const now = options.now ?? Date.now;
  if (!Object.values(limits).every(v => Number.isSafeInteger(v) && v > 0)) return unavailable();
  let db: DatabaseSync;
  try {
    if (options.path !== ':memory:') mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(options.path); db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS enrichment_records(id TEXT PRIMARY KEY,owner TEXT NOT NULL,document_hash TEXT NOT NULL,record TEXT NOT NULL); CREATE INDEX IF NOT EXISTS enrichment_document ON enrichment_records(owner,document_hash);');
  } catch { return unavailable(); }
  const records = (owner: string, documentHash: string) => (db.prepare('SELECT record FROM enrichment_records WHERE owner=? AND document_hash=?').all(owner, documentHash) as { record: string }[]).map(r => JSON.parse(r.record) as EnrichmentRecord);
  function budget(owner: string, documentHash: string): EnrichmentBudget { const all = records(owner, documentHash).filter(r => r.status !== 'rejected'); return { requests: all.length, maxRequests: limits.maxRequests, accountedTokens: all.reduce((sum,r) => sum + tokens(r),0), maxTokens: limits.maxTokens }; }
  function transaction<T>(work: () => T): T { let began = false; try { db.exec('BEGIN IMMEDIATE'); began = true; const result = work(); db.exec('COMMIT'); return result; } catch (error) { if (began) db.exec('ROLLBACK'); if (error instanceof AnalysisHttpError) throw error; return unavailable(); } }
  return {
    reserve(input) {
      if (!/^[a-f0-9]{64}$/.test(input.id) || !/^[a-f0-9]{48}$/.test(input.owner) || !/^[a-f0-9]{64}$/.test(input.documentHash) || !/^[a-f0-9]{64}$/.test(input.contextHash) || !Number.isSafeInteger(input.reservedTokens) || input.reservedTokens < 1 || input.reservedTokens > limits.maxTokens) throw new AnalysisHttpError(400, 'Invalid bounded paper reservation.');
      return transaction(() => {
        const existing = db.prepare('SELECT record FROM enrichment_records WHERE id=?').get(input.id) as { record: string } | undefined;
        if (existing) {
          const record = JSON.parse(existing.record) as EnrichmentRecord;
          if (record.owner !== input.owner || record.documentHash !== input.documentHash || record.contextHash !== input.contextHash || record.action !== input.action || record.sectionId !== input.sectionId) throw new AnalysisHttpError(409, 'This enrichment request already belongs to different context.');
          return { created: false, record };
        }
        const available = budget(input.owner, input.documentHash);
        if (available.requests >= limits.maxRequests || available.accountedTokens + input.reservedTokens > limits.maxTokens) throw new AnalysisHttpError(429, 'The per-paper enrichment request/token allowance is reached. Existing results and accepted jobs remain available.');
        const record: EnrichmentRecord = { ...input, createdAt: now(), status: 'reserved' };
        db.prepare('INSERT INTO enrichment_records(id,owner,document_hash,record) VALUES(?,?,?,?)').run(record.id, record.owner, record.documentHash, JSON.stringify(record));
        return { created: true, record };
      });
    },
    settle(id, update) {
      if (update.actualTokens !== undefined && (!Number.isSafeInteger(update.actualTokens) || update.actualTokens < 0)) throw new AnalysisHttpError(400, 'Invalid measured enrichment usage.');
      if (update.providerId !== undefined && !/^resp_[a-zA-Z0-9_-]{1,250}$/.test(update.providerId)) throw new AnalysisHttpError(400, 'Invalid provider reference.');
      transaction(() => {
        const stored = db.prepare('SELECT record FROM enrichment_records WHERE id=?').get(id) as { record: string } | undefined; if (!stored) return;
        const previous = JSON.parse(stored.record) as EnrichmentRecord;
        const terminal = !['reserved','accepted','uncertain'].includes(previous.status);
        if (terminal && ['reserved','accepted','uncertain'].includes(update.status)) return;
        db.prepare('UPDATE enrichment_records SET record=? WHERE id=?').run(JSON.stringify({ ...previous, ...update }), id);
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
  return store ??= createEnrichmentStore({ path: resolve(/* turbopackIgnore: true */ path) });
}
