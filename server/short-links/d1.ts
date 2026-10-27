import type { D1UsageDatabase } from '../usage/d1';
import { AnalysisHttpError } from '../analysis/security';
import { SHORT_LINK_INSERT_SQL, type ShortLinkStore, validateStoredShortLink, shortLinkQuotaError, shortLinkStorageError } from './model';
export function createD1ShortLinkStore(options: { db: D1UsageDatabase }): ShortLinkStore {
  const { db } = options;
  return {
    async create(record) {
      validateStoredShortLink(record);
      try {
        const day = Math.floor(record.createdAt / 86_400_000) * 86_400_000;
        const result = await db.prepare(SHORT_LINK_INSERT_SQL).bind(record.id, record.payload, record.deleteHash, record.sessionId, record.createdAt, record.expiresAt, record.sessionId, record.createdAt - 3_600_000, day).run();
        if (result.success === false || !Number.isInteger(result.meta?.changes)) return shortLinkStorageError();
        if (result.meta!.changes !== 1) return shortLinkQuotaError();
        try { await db.prepare('DELETE FROM short_links WHERE expires_at <= ?').bind(record.createdAt).run(); } catch { /* no live payload is removed early */ }
      } catch (error) { if (error instanceof AnalysisHttpError) throw error; return shortLinkStorageError(); }
    },
    async get(id, now) {
      try {
        const row = await db.prepare('SELECT payload,expires_at FROM short_links WHERE id=? AND expires_at>? AND deleted_at IS NULL').bind(id, now).first<{ payload: string; expires_at: number }>();
        return row ? { payload: row.payload, expiresAt: row.expires_at } : undefined;
      } catch { return shortLinkStorageError(); }
    },
    async remove(id, hash, now) {
      try {
        const result = await db.prepare('UPDATE short_links SET payload=NULL,delete_hash=NULL,deleted_at=? WHERE id=? AND delete_hash=? AND expires_at>? AND deleted_at IS NULL').bind(now, id, hash, now).run();
        if (result.success === false || !Number.isInteger(result.meta?.changes)) return shortLinkStorageError();
        return result.meta!.changes === 1;
      } catch { return shortLinkStorageError(); }
    },
  };
}
