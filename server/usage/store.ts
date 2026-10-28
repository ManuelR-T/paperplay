import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AnalysisHttpError } from '../analysis/security';
import { type UsageStore, type UsageLimits, type UsageRecord, DEFAULT_USAGE_LIMITS, validateLimits, validateUsageRequest, validateUsageUpdate, compatibleReservation, checkLimits, reservedTokensFor, updatedRecord, summarize, unavailableStore, dayStart } from './model';
export * from './model';

/** SQLite serializes all processes sharing the same persistent local volume. */
export function createSqliteUsageStore(options: { path: string; limits?: UsageLimits; enforceLimits?: boolean; now?: () => number }): UsageStore {
  const limits = options.limits ?? DEFAULT_USAGE_LIMITS; validateLimits(limits);
  const now = options.now ?? Date.now;const enforceLimits=options.enforceLimits!==false;
  let db: DatabaseSync;
  try {
    if (options.path !== ':memory:') mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(options.path); db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS usage_records (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, record TEXT NOT NULL); CREATE INDEX IF NOT EXISTS usage_created ON usage_records(created_at);');
  } catch { return unavailableStore(); }
  const all = (since: number) => (db.prepare('SELECT record FROM usage_records WHERE created_at >= ?').all(since) as Array<{ record: string }>).map(row => JSON.parse(row.record) as UsageRecord);
  function transaction<T>(work: () => T): T {
    let begun = false;
    try { db.exec('BEGIN IMMEDIATE'); begun = true; const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { if (begun) db.exec('ROLLBACK'); if (error instanceof AnalysisHttpError) throw error; return unavailableStore(); }
  }
  return {
    async reserve(input) {
      validateUsageRequest(input);
      return transaction(() => {
        const existing = db.prepare('SELECT record FROM usage_records WHERE id = ?').get(input.id) as { record: string } | undefined;
        if (existing) { const record = JSON.parse(existing.record) as UsageRecord; compatibleReservation(record, input); return { created: false, record }; }
        const time = now(); if(enforceLimits)checkLimits(all(time - 86_400_000), input, limits, time);
        const record: UsageRecord = { ...input, status: 'reserved', createdAt: time, updatedAt: time, reservedTokens: reservedTokensFor(input) };
        db.prepare('INSERT INTO usage_records(id, created_at, record) VALUES (?, ?, ?)').run(input.id, time, JSON.stringify(record));
        db.prepare('DELETE FROM usage_records WHERE created_at < ?').run(time - 30 * 86_400_000);
        return { created: true, record };
      });
    },
    async settle(id, update) {
      validateUsageUpdate(update);
      transaction(() => {
        const stored = db.prepare('SELECT record FROM usage_records WHERE id = ?').get(id) as { record: string } | undefined;
        if (!stored) return; // Pre-M3 jobs remain recoverable without inventing historical usage.
        const record = updatedRecord(JSON.parse(stored.record) as UsageRecord, update, now());
        db.prepare('UPDATE usage_records SET record = ? WHERE id = ?').run(JSON.stringify(record), id);
      });
    },
    async summary() { try { return summarize(all(dayStart(now())), limits, now(), 'sqlite',enforceLimits); } catch { return unavailableStore(); } },
    close() { db.close(); },
  };
}
