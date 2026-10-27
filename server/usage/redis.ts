import { AnalysisHttpError } from '../analysis/security';
import { type UsageStore, type UsageLimits, type UsageRequest, type UsageRecord, type UsageUpdate, DEFAULT_USAGE_LIMITS, validateLimits, validateUsageRequest, validateUsageUpdate, summarize, unavailableStore } from './store';

// One EVAL is the reservation transaction. No pipeline/check-then-increment race.
export const RESERVE_LUA = `
local input = cjson.decode(ARGV[1]); local limits = cjson.decode(ARGV[2]);
local now = tonumber(ARGV[3]); local start = math.floor(now / 86400000) * 86400000;
local old = redis.call('HGET', KEYS[1], input.id);
if old then
 local r = cjson.decode(old);
 if r.sessionId ~= input.sessionId or r.kind ~= input.kind or r.model ~= input.model or r.fingerprint ~= input.fingerprint or r.inputCharacters ~= input.inputCharacters or r.maxOutputTokens ~= input.maxOutputTokens then return cjson.encode({error='conflict'}) end
 return cjson.encode({created=false, record=r});
end
local rows = redis.call('HGETALL', KEYS[1]); local hourly=0; local session=0; local daily=0; local tokens=0;
for i=1,#rows,2 do
 local r = cjson.decode(rows[i+1]);
 if r.createdAt < now - 2592000000 then redis.call('HDEL', KEYS[1], rows[i]);
 else
  if r.createdAt > now - 3600000 then hourly=hourly+1 end
  if r.sessionId == input.sessionId and r.createdAt > now - 600000 then session=session+1 end
  if r.createdAt >= start then
   daily=daily+1;
   if r.status == 'reserved' or r.status == 'accepted' or r.status == 'uncertain' then
    local measured=0; if r.usage then measured=r.usage.totalTokens end
    tokens=tokens+math.max(r.reservedTokens,measured);
   elseif r.usage then tokens=tokens+r.usage.totalTokens elseif r.status ~= 'rejected' then tokens=tokens+r.reservedTokens end
  end
 end
end
local reserved=input.inputCharacters*4+16000+input.maxOutputTokens;
if hourly >= limits.globalHourlyRequests or session >= limits.sessionTenMinuteRequests or daily >= limits.dailyRequests or tokens+reserved > limits.dailyTokens then return cjson.encode({error='quota'}) end
input.createdAt=now; input.updatedAt=now; input.status='reserved'; input.reservedTokens=reserved;
redis.call('HSET', KEYS[1], input.id, cjson.encode(input));
return cjson.encode({created=true,record=input});
`;
export const SETTLE_LUA = `
local stored=redis.call('HGET', KEYS[1], ARGV[1]); if not stored then return 0 end
local r=cjson.decode(stored); local u=cjson.decode(ARGV[2]);
local terminal={completed=true,cancelled=true,failed=true,incomplete=true,validation_failed=true,rejected=true};
local stale=terminal[r.status] and (u.status == 'accepted' or u.status == 'uncertain');
if not stale then r.status=u.status end
if not stale and u.usage then r.usage=u.usage end
if u.providerId then r.providerId=u.providerId end
r.updatedAt=tonumber(ARGV[3]); redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(r)); return 1;
`;
export function createRedisUsageStore(options: { url: string; token: string; namespace?: string; limits?: UsageLimits; now?: () => number; fetch?: typeof fetch }): UsageStore {
  const limits = options.limits ?? DEFAULT_USAGE_LIMITS; validateLimits(limits);
  const now = options.now ?? Date.now;
  let url: URL;
  try { url = new URL(options.url); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !options.token.trim()) throw Error(); }
  catch { return unavailableStore(); }
  const key = `${options.namespace ?? 'paperplay'}:usage:v1`;
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(key)) return unavailableStore();
  async function command(args: unknown[]) {
    try {
      const response = await (options.fetch ?? fetch)(url, { method: 'POST', headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!response.ok) throw Error();
      const body = await response.json() as { result?: unknown; error?: unknown };
      if (body.error || !('result' in body)) throw Error();
      return body.result;
    } catch { return unavailableStore(); }
  }
  return {
    async reserve(input: UsageRequest) {
      validateUsageRequest(input);
      const raw = await command(['EVAL', RESERVE_LUA, 1, key, JSON.stringify(input), JSON.stringify(limits), now()]);
      let parsed: { created: boolean; record: UsageRecord; error?: string };
      try { parsed = JSON.parse(String(raw)); } catch { return unavailableStore(); }
      if (parsed.error === 'quota') throw new AnalysisHttpError(429, 'The shared analysis/question allowance is reached. Existing analyses can still be retrieved; no new paid request was started.');
      if (parsed.error === 'conflict') throw new AnalysisHttpError(409, 'This request reference already belongs to different input.');
      if (typeof parsed.created !== 'boolean' || parsed.record?.id !== input.id) return unavailableStore();
      return { created: parsed.created, record: parsed.record };
    },
    async settle(id: string, update: UsageUpdate) { validateUsageUpdate(update); await command(['EVAL', SETTLE_LUA, 1, key, id, JSON.stringify(update), now()]); },
    async summary() {
      const result = await command(['HVALS', key]);
      try { if (!Array.isArray(result)) throw Error(); return summarize(result.map(item => JSON.parse(String(item)) as UsageRecord), limits, now(), 'redis'); }
      catch { return unavailableStore(); }
    },
  };
}
