import { AnalysisHttpError } from '../analysis/security';
import { type UsageStore, type UsageLimits, type UsageRecord, DEFAULT_USAGE_LIMITS, validateLimits, validateUsageRequest, validateUsageUpdate, compatibleReservation, reservedTokensFor, updatedRecord, summarize, unavailableStore, dayStart, checkLimits, UsageQuotaError } from './model';

/** Structural subset of the Cloudflare D1 binding; no platform SDK is required. */
export interface D1UsageStatement {
  bind(...values: unknown[]): D1UsageStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success?: boolean }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}
export interface D1UsageDatabase { prepare(sql: string): D1UsageStatement }

// D1 serializes this one SQL statement. Counts and insertion are inseparable:
// independent Workers cannot all pass a read/check phase before inserting.
export const D1_RESERVE_SQL = `INSERT OR IGNORE INTO usage_records (id, created_at, record)
SELECT ?, ?, ?
WHERE (SELECT COUNT(*) FROM usage_records WHERE created_at > ?) < ?
AND (SELECT COUNT(*) FROM usage_records WHERE json_extract(record, '$.sessionId') = ? AND created_at > ?) < ?
AND (SELECT COUNT(*) FROM usage_records WHERE created_at >= ?) < ?
AND COALESCE((SELECT SUM(
  CASE
    WHEN json_extract(record, '$.status') IN ('reserved', 'accepted', 'uncertain')
      THEN MAX(json_extract(record, '$.reservedTokens'), COALESCE(json_extract(record, '$.usage.totalTokens'), 0))
    WHEN json_extract(record, '$.usage.totalTokens') IS NOT NULL THEN json_extract(record, '$.usage.totalTokens')
    WHEN json_extract(record, '$.status') = 'rejected' THEN 0
    ELSE json_extract(record, '$.reservedTokens')
  END
) FROM usage_records WHERE created_at >= ?), 0) + ? <= ?`;

export function createD1UsageStore(options: { db: D1UsageDatabase; limits?: UsageLimits; enforceLimits?:boolean; now?: () => number }): UsageStore {
  const limits = options.limits ?? DEFAULT_USAGE_LIMITS; validateLimits(limits);
  const now = options.now ?? Date.now;const enforceLimits=options.enforceLimits!==false;
  const { db } = options;
  async function row(id: string) { return db.prepare('SELECT record FROM usage_records WHERE id = ?').bind(id).first<{ record: string }>(); }
  return {
    async reserve(input) {
      validateUsageRequest(input);
      try {
        const time = now(); const today = dayStart(time);
        const record: UsageRecord = { ...input, createdAt: time, updatedAt: time, status: 'reserved', reservedTokens: reservedTokensFor(input) };
        const result = enforceLimits?await db.prepare(D1_RESERVE_SQL).bind(input.id, time, JSON.stringify(record),
          time - 3_600_000, limits.globalHourlyRequests, input.sessionId, time - 600_000, limits.sessionTenMinuteRequests,
          today, limits.dailyRequests, today, record.reservedTokens, limits.dailyTokens).run():await db.prepare('INSERT OR IGNORE INTO usage_records (id, created_at, record) VALUES (?, ?, ?)').bind(input.id,time,JSON.stringify(record)).run();
        if (result.success === false || !Number.isInteger(result.meta?.changes) || ![0, 1].includes(result.meta!.changes!)) return unavailableStore();
        const stored = await row(input.id);
        if (!stored) {const observed=await db.prepare('SELECT record FROM usage_records WHERE created_at >= ?').bind(time-86_400_000).all<{record:string}>();if(observed.success===false||!Array.isArray(observed.results))return unavailableStore();checkLimits(observed.results.map(row=>JSON.parse(row.record)),input,limits,time);throw new UsageQuotaError('global-rate',time+60_000);}
        const accepted = JSON.parse(stored.record) as UsageRecord;
        compatibleReservation(accepted, input);
        // Retention is housekeeping, not a reason to lose a successfully reserved slot.
        try { await db.prepare('DELETE FROM usage_records WHERE created_at < ?').bind(time - 30 * 86_400_000).run(); } catch { /* retry on a later creation */ }
        return { created: result.meta!.changes === 1, record: accepted };
      } catch (error) { if (error instanceof AnalysisHttpError) throw error; return unavailableStore(); }
    },
    async settle(id, update) {
      validateUsageUpdate(update);
      try {
        // A compare-and-swap preserves measured terminal usage if a delayed poll
        // or another replica updates the same job between this read and write.
        for (let attempt = 0; attempt < 8; attempt++) {
          const stored = await row(id);
          if (!stored) return; // M2 capabilities may predate the ledger.
          const next = updatedRecord(JSON.parse(stored.record) as UsageRecord, update, now());
          const result = await db.prepare('UPDATE usage_records SET record = ? WHERE id = ? AND record = ?').bind(JSON.stringify(next), id, stored.record).run();
          if (result.success === false || !Number.isInteger(result.meta?.changes)) return unavailableStore();
          if (result.meta!.changes === 1) return;
        }
        return unavailableStore();
      } catch (error) { if (error instanceof AnalysisHttpError) throw error; return unavailableStore(); }
    },
    async summary() {
      try {
        const time = now();
        const result = await db.prepare('SELECT record FROM usage_records WHERE created_at >= ?').bind(dayStart(time)).all<{ record: string }>();
        if (result.success === false || !Array.isArray(result.results)) return unavailableStore();
        return summarize(result.results.map(item => JSON.parse(item.record) as UsageRecord), limits, time, 'd1',enforceLimits);
      } catch { return unavailableStore(); }
    },
  };
}
