import { AnalysisHttpError } from '../analysis/security';
export const SHORT_LINK_TTL = 7 * 86_400_000;
export type StoredShortLink = { id: string; payload: string; deleteHash: string; sessionId: string; createdAt: number; expiresAt: number };
export interface ShortLinkStore {
  create(record: StoredShortLink): Promise<void>;
  get(id: string, now: number): Promise<{ payload: string; expiresAt: number } | undefined>;
  remove(id: string, deleteHash: string, now: number): Promise<boolean>;
}
export const SHORT_LINK_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS short_links (
 id TEXT PRIMARY KEY, payload TEXT, delete_hash TEXT, session_id TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, deleted_at INTEGER
); CREATE INDEX IF NOT EXISTS short_links_created ON short_links(created_at);
CREATE INDEX IF NOT EXISTS short_links_session ON short_links(session_id, created_at);`;
export const SHORT_LINK_INSERT_SQL = `INSERT INTO short_links (id,payload,delete_hash,session_id,created_at,expires_at)
 SELECT ?,?,?,?,?,?
 WHERE (SELECT COUNT(*) FROM short_links WHERE session_id=? AND created_at>?) < 10
 AND (SELECT COUNT(*) FROM short_links WHERE created_at>=?) < 100`;
export function validateStoredShortLink(record: StoredShortLink) {
  if (!/^[a-f0-9]{32}$/.test(record.id) || !/^[a-f0-9]{64}$/.test(record.deleteHash) || !/^[a-f0-9]{48}$/.test(record.sessionId)
    || !/^[A-Za-z0-9_-]{1,12000}$/.test(record.payload) || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 || record.expiresAt !== record.createdAt + SHORT_LINK_TTL) throw new AnalysisHttpError(400, 'Invalid bounded public snapshot record.');
}
export function shortLinkStorageError(): never { throw new AnalysisHttpError(503, 'Durable public links are unavailable. The experiment remains local; use its full URL or export a bundle.'); }
export function shortLinkQuotaError(): never { throw new AnalysisHttpError(429, 'The public-link allowance is reached. Use the full snapshot URL or export instead.'); }
