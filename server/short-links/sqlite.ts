import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AnalysisHttpError } from '../analysis/security';
import { SHORT_LINK_SCHEMA_SQL, SHORT_LINK_INSERT_SQL, type ShortLinkStore, validateStoredShortLink, shortLinkQuotaError, shortLinkStorageError } from './model';
export function createSqliteShortLinkStore(options: { path: string }): ShortLinkStore & { close(): void } {
  let db: DatabaseSync;
  try {
    if (options.path !== ':memory:') mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(options.path); db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;'); db.exec(SHORT_LINK_SCHEMA_SQL);
  } catch { return shortLinkStorageError(); }
  return {
    async create(record) {
      validateStoredShortLink(record);
      try {
        const day = Math.floor(record.createdAt / 86_400_000) * 86_400_000;
        const result = db.prepare(SHORT_LINK_INSERT_SQL).run(record.id, record.payload, record.deleteHash, record.sessionId, record.createdAt, record.expiresAt, record.sessionId, record.createdAt - 3_600_000, day);
        if (Number(result.changes) !== 1) return shortLinkQuotaError();
        try { db.prepare('DELETE FROM short_links WHERE expires_at <= ?').run(record.createdAt); } catch { /* next creation retries housekeeping */ }
      } catch (error) { if (error instanceof AnalysisHttpError) throw error; return shortLinkStorageError(); }
    },
    async get(id, now) {
      try {
        const row = db.prepare('SELECT payload,expires_at FROM short_links WHERE id=? AND expires_at>? AND deleted_at IS NULL').get(id, now) as { payload: string; expires_at: number } | undefined;
        return row ? { payload: row.payload, expiresAt: row.expires_at } : undefined;
      } catch { return shortLinkStorageError(); }
    },
    async remove(id, hash, now) {
      try { return Number(db.prepare('UPDATE short_links SET payload=NULL,delete_hash=NULL,deleted_at=? WHERE id=? AND delete_hash=? AND expires_at>? AND deleted_at IS NULL').run(now, id, hash, now).changes) === 1; }
      catch { return shortLinkStorageError(); }
    },
    close() { db.close(); },
  };
}
