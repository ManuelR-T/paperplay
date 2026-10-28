import { createAnalysisHandlers } from '../server/analysis/handlers';
import { createQuestionHandler } from '../server/questions/handler';
import { readMetaConfig, publicMetaStatus } from '../server/meta/config';
import { signingKey } from '../server/analysis/security';
import { createD1UsageStore, type D1UsageDatabase } from '../server/usage/d1';
import { DEFAULT_USAGE_LIMITS, applicationQuotasEnabled, type UsageLimits } from '../server/usage/model';
import { createShortLinkHandlers } from '../server/short-links/handlers';
import { createD1ShortLinkStore } from '../server/short-links/d1';
import { GET as importArxiv } from '../app/api/arxiv/route';

type AssetBinding = { fetch(request: Request): Promise<Response> };
export type HostedEnvironment = {
  ASSETS: AssetBinding; DB?: D1UsageDatabase;
  PAPERPLAY_QUOTAS_ENABLED?: string; MODEL_API_KEY?: string; META_MODEL?: string; META_ANALYSIS_ENABLED?: string; META_CREDITS_EXPIRE_AT?: string;
  ANALYSIS_SIGNING_SECRET?: string; SHORT_LINKS_SIGNING_SECRET?: string; ANALYSIS_APP_ORIGIN?: string;
  USAGE_HOURLY_REQUESTS?: string; USAGE_SESSION_REQUESTS?: string; USAGE_DAILY_REQUESTS?: string; USAGE_DAILY_TOKENS?: string;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function readLimits(env: HostedEnvironment): UsageLimits {
  const limits = { ...DEFAULT_USAGE_LIMITS };
  for (const [key, variable] of Object.entries({ globalHourlyRequests: 'USAGE_HOURLY_REQUESTS', sessionTenMinuteRequests: 'USAGE_SESSION_REQUESTS', dailyRequests: 'USAGE_DAILY_REQUESTS', dailyTokens: 'USAGE_DAILY_TOKENS' })) {
    const value = env[variable as keyof HostedEnvironment];
    if (value !== undefined) limits[key as keyof UsageLimits] = Number(value);
  }
  return limits;
}
function configured(env: HostedEnvironment) {
  return readMetaConfig({ MODEL_API_KEY: env.MODEL_API_KEY, META_MODEL: env.META_MODEL,
    META_ANALYSIS_ENABLED: env.META_ANALYSIS_ENABLED, META_CREDITS_EXPIRE_AT: env.META_CREDITS_EXPIRE_AT });
}
export default {
  async fetch(request: Request, env: HostedEnvironment): Promise<Response> {
    const url = new URL(request.url); const path = url.pathname;
    try {
      if (path === '/api/health') return request.method === 'GET'
        ? json({ status: 'ok', stage: 'M5', meta: publicMetaStatus(configured(env)), hosting: { runtime: 'cloudflare-worker', quotaStore: env.DB ? 'd1' : 'unavailable' } })
        : json({ error: 'Use GET for this route.' }, 405);
      if (path === '/api/arxiv') return request.method === 'GET' ? importArxiv(request) : json({ error: 'Use GET for this route.' }, 405);
      // Signed accepted jobs remain recoverable when quota reporting/storage is
      // unavailable. Retrieval/cancellation create no new inference work.
      if (path === '/api/analysis/status' || path === '/api/analysis/cancel') {
        if (request.method !== 'POST') return json({ error: 'Use POST for this route.' }, 405);
        const handlers = createAnalysisHandlers({ getConfig: () => configured(env), signingSecret: env.ANALYSIS_SIGNING_SECRET,
          allowedOrigin: env.ANALYSIS_APP_ORIGIN, ...(env.DB ? { usage: createD1UsageStore({ db: env.DB,enforceLimits:applicationQuotasEnabled({PAPERPLAY_QUOTAS_ENABLED:env.PAPERPLAY_QUOTAS_ENABLED}) }) } : {}) });
        return handlers.status(request, path.endsWith('/cancel'));
      }
      if (path.startsWith('/api/analysis/') || path === '/api/questions' || path === '/api/short-links' || path.startsWith('/s/')) {
        if (!env.DB) return json({ error: 'The shared D1 store is unavailable. New paid work and public-link storage are disabled.', uncertain: false }, 503);
        const config = configured(env);
        const usage = createD1UsageStore({ db: env.DB, limits: readLimits(env),enforceLimits:applicationQuotasEnabled({PAPERPLAY_QUOTAS_ENABLED:env.PAPERPLAY_QUOTAS_ENABLED}) });
        const shared = { getConfig: () => config, usage, signingSecret: env.ANALYSIS_SIGNING_SECRET, allowedOrigin: env.ANALYSIS_APP_ORIGIN };
        if (path === '/api/questions') return request.method === 'POST' ? createQuestionHandler(shared)(request) : json({ error: 'Use POST for this route.' }, 405);
        if (path.startsWith('/api/analysis/')) {
          if (request.method !== 'POST') return json({ error: 'Use POST for this route.' }, 405);
          const handlers = createAnalysisHandlers(shared);
          if (path === '/api/analysis/start') return handlers.start(request);
          if (path === '/api/analysis/status') return handlers.status(request);
          if (path === '/api/analysis/cancel') return handlers.status(request, true);
          return json({ error: 'Unknown analysis route.' }, 404);
        }
        const secret = env.ANALYSIS_SIGNING_SECRET || config.apiKey
          ? signingKey(config.apiKey ?? '', env.ANALYSIS_SIGNING_SECRET) : env.SHORT_LINKS_SIGNING_SECRET ?? '';
        const links = createShortLinkHandlers({ store: createD1ShortLinkStore({ db: env.DB }), signingSecret: secret, allowedOrigin: env.ANALYSIS_APP_ORIGIN });
        if (path === '/api/short-links') {
          if (request.method === 'POST') return links.create(request);
          if (request.method === 'DELETE') return links.remove(request);
          return json({ error: 'Use POST or DELETE for this route.' }, 405);
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Use GET for a public snapshot link.' }, 405);
        return links.resolve(request, path.slice('/s/'.length));
      }
      if (path.startsWith('/api/')) return json({ error: 'Unknown API route.' }, 404);
      return env.ASSETS.fetch(request);
    } catch {
      // No provider body, SQL statement, source content or credential is exposed.
      return json({ error: 'This hosted operation is temporarily unavailable. The prepared reading workspace remains available.', uncertain: false }, 503);
    }
  },
};
