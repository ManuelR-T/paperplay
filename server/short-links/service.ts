import 'server-only';
import { resolve } from 'node:path';
import { serverMetaConfig } from '../meta/environment';
import { signingKey } from '../analysis/security';
import { createSqliteShortLinkStore } from './sqlite';
import { createShortLinkHandlers } from './handlers';
let handlers: ReturnType<typeof createShortLinkHandlers> | undefined;
export function shortLinkHandlers() {
  if (handlers) return handlers;
  const config = serverMetaConfig();
  const secret = config.apiKey || process.env.ANALYSIS_SIGNING_SECRET ? signingKey(config.apiKey ?? '', process.env.ANALYSIS_SIGNING_SECRET) : process.env.SHORT_LINKS_SIGNING_SECRET?.trim() ?? '';
  const hosted = process.env.PAPERPLAY_DEPLOYMENT === 'distributed' || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.CF_PAGES;
  if (hosted) throw new Error('Distributed public links need the hosting D1 handler.');
  handlers = createShortLinkHandlers({ store: createSqliteShortLinkStore({ path: resolve(/* turbopackIgnore: true */ process.env.SHORT_LINKS_SQLITE_PATH ?? '.paperplay/short-links.sqlite') }), signingSecret: secret });
  return handlers;
}
export function unavailableShortLinks() { return Response.json({ error: 'Durable public links are unavailable on this installation. Use the full snapshot URL or export instead.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
