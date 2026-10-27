import { resolve } from 'node:path';
import { AnalysisHttpError } from '../analysis/security';
import { createSqliteUsageStore, DEFAULT_USAGE_LIMITS, type UsageStore, type UsageLimits } from './store';
import { createRedisUsageStore } from './redis';

export function createUsageStore(environment: Record<string, string | undefined> = process.env): UsageStore {
  const limits: UsageLimits = { ...DEFAULT_USAGE_LIMITS };
  for (const [key, variable] of Object.entries({ globalHourlyRequests: 'USAGE_HOURLY_REQUESTS', sessionTenMinuteRequests: 'USAGE_SESSION_REQUESTS', dailyRequests: 'USAGE_DAILY_REQUESTS', dailyTokens: 'USAGE_DAILY_TOKENS' })) {
    if (environment[variable] !== undefined) limits[key as keyof UsageLimits] = Number(environment[variable]);
  }
  const hosted = environment.PAPERPLAY_DEPLOYMENT === 'distributed' || Boolean(environment.VERCEL || environment.AWS_LAMBDA_FUNCTION_NAME || environment.CF_PAGES);
  if (environment.UPSTASH_REDIS_REST_URL || environment.UPSTASH_REDIS_REST_TOKEN) {
    return createRedisUsageStore({ url: environment.UPSTASH_REDIS_REST_URL ?? '', token: environment.UPSTASH_REDIS_REST_TOKEN ?? '', namespace: environment.USAGE_NAMESPACE, limits });
  }
  if (hosted) throw new AnalysisHttpError(503, 'Hosted analysis requires a shared durable usage store. Configure Redis before enabling paid requests.');
  // This is a runtime writable ledger, never an asset to copy into deployment output.
  return createSqliteUsageStore({ path: resolve(/* turbopackIgnore: true */ environment.USAGE_SQLITE_PATH ?? '.paperplay/usage.sqlite'), limits });
}
let store: UsageStore | undefined;
export function getUsageStore() { return store ??= createUsageStore(); }
