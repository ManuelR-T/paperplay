import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { experimentSnapshotSchema } from '../../shared/schema';
import { decodePublicSnapshot, encodePublicSnapshot } from '../../lib/snapshots';
import { snapshotFromPrepared } from '../../lib/reading-state';
import { AnalysisHttpError, readBoundedJson, requireSameOrigin, sessionFor } from '../analysis/security';
import { SHORT_LINK_TTL, type ShortLinkStore } from './model';
const createSchema = z.strictObject({ snapshot: experimentSnapshotSchema });
const deleteSchema = z.strictObject({ id: z.string().regex(/^[a-f0-9]{32}$/), deleteToken: z.string().regex(/^[a-f0-9]{64}$/) });
export const shortLinkDeleteHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function createShortLinkHandlers(dependencies: { store: ShortLinkStore; signingSecret: string; allowedOrigin?: string; now?: () => number }) {
  const now = dependencies.now ?? Date.now;
  const response = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
  const fail = (error: unknown) => {
    const safe = error instanceof AnalysisHttpError ? error : new AnalysisHttpError(400, 'This public snapshot is invalid, incompatible or too large. Use the full URL or an experiment bundle.');
    return response({ error: safe.message }, safe.status);
  };
  return {
    async create(request: Request) {
      try {
        requireSameOrigin(request, dependencies.allowedOrigin);
        if (!dependencies.signingSecret) throw new AnalysisHttpError(503, 'Public links need stable server signing configuration. The full snapshot URL and export remain available.');
        const body = createSchema.safeParse(await readBoundedJson(request));
        if (!body.success) throw new AnalysisHttpError(400, 'Choose a valid prepared public mechanism snapshot. Private papers and PDFs cannot be uploaded through this endpoint.');
        const decoded = decodePublicSnapshot(encodePublicSnapshot(body.data.snapshot));
        // Discard client-supplied descriptive strings. Store canonical public
        // source metadata plus the explicitly shared input/seed/engine settings.
        const snapshot = snapshotFromPrepared(decoded.paper, decoded.state);
        const payload = encodePublicSnapshot(snapshot);
        const session = sessionFor(request, dependencies.signingSecret, now(), true);
        const id = randomBytes(16).toString('hex'); const deleteToken = randomBytes(32).toString('hex');
        const createdAt = now(); const expiresAt = createdAt + SHORT_LINK_TTL;
        await dependencies.store.create({ id, payload, deleteHash: shortLinkDeleteHash(deleteToken), sessionId: session.sid, createdAt, expiresAt });
        return response({ id, path: `/s/${id}`, expiresAt, deleteToken }, 201, session.cookie);
      } catch (error) { return fail(error); }
    },
    async remove(request: Request) {
      try {
        requireSameOrigin(request, dependencies.allowedOrigin);
        const body = deleteSchema.safeParse(await readBoundedJson(request));
        if (!body.success) throw new AnalysisHttpError(400, 'The public link deletion capability is invalid.');
        const removed = await dependencies.store.remove(body.data.id, shortLinkDeleteHash(body.data.deleteToken), now());
        if (!removed) throw new AnalysisHttpError(404, 'The public link is absent, expired, deleted, or this deletion capability is invalid.');
        return response({ deleted: true });
      } catch (error) { return fail(error); }
    },
    async resolve(_request: Request, id: string) {
      try {
        if (!/^[a-f0-9]{32}$/.test(id)) throw new AnalysisHttpError(404, 'This public snapshot link is invalid.');
        const stored = await dependencies.store.get(id, now());
        if (!stored) throw new AnalysisHttpError(410, 'This public snapshot expired or was deleted.');
        try { decodePublicSnapshot(stored.payload); }
        catch { throw new AnalysisHttpError(410, 'This snapshot uses a source or engine version that is no longer available.'); }
        return new Response(null, { status: 302, headers: { Location: `/#snapshot=${stored.payload}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
      } catch (error) {
        const safe = error instanceof AnalysisHttpError ? error : new AnalysisHttpError(503, 'Public snapshot storage is temporarily unavailable.');
        return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paperplay public snapshot</title><body style="font:18px/1.7 system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:24px;background:#faf9f5;color:#252b27"><h1>Snapshot unavailable</h1><p>${safe.message}</p><p><a href="/">Open the Paperplay reading workspace</a></p></body></html>`, { status: safe.status, headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' } });
      }
    },
  };
}
