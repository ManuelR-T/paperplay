import { createHash } from 'node:crypto';
import { AnalysisHttpError } from '../analysis/security';

export type MeasuredUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type UsageStatus = 'reserved' | 'accepted' | 'completed' | 'cancelled' | 'failed' | 'incomplete' | 'uncertain' | 'rejected' | 'validation_failed';
export type UsageRequest = { id: string; sessionId: string; kind: 'analysis' | 'question'; maxOutputTokens: number; inputCharacters: number; model: string; fingerprint?: string };
export type UsageRecord = UsageRequest & { createdAt: number; updatedAt: number; status: UsageStatus; reservedTokens: number; providerId?: string; usage?: MeasuredUsage };
export type UsageUpdate = { status: Exclude<UsageStatus, 'reserved'>; providerId?: string; usage?: MeasuredUsage };
export type UsageLimits = { globalHourlyRequests: number; sessionTenMinuteRequests: number; dailyRequests: number; dailyTokens: number };
export const DEFAULT_USAGE_LIMITS: UsageLimits = { globalHourlyRequests: 60, sessionTenMinuteRequests: 15, dailyRequests: 100, dailyTokens: 2_000_000 };
export type UsageSummary = { day: string; requests: number; byKind: Record<'analysis' | 'question', number>; byStatus: Partial<Record<UsageStatus, number>>; measured: MeasuredUsage; measuredRequests: number; unavailableRequests: number; reservedUnmeasuredTokens: number; accountedTokens: number; limits: UsageLimits; backend: 'sqlite' | 'redis' | 'd1' };
export interface UsageStore {
  reserve(input: UsageRequest): Promise<{ created: boolean; record: UsageRecord }>;
  settle(id: string, update: UsageUpdate): Promise<void>;
  summary(): Promise<UsageSummary>;
  close?(): void;
}
export const usageIdFor = (sessionId: string, requestId: string) => createHash('sha256').update(`${sessionId}:${requestId}`).digest('hex');
export function validateUsageRequest(input: UsageRequest) {
  if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(input.id) || !/^[a-zA-Z0-9_-]{1,200}$/.test(input.sessionId) || !['analysis', 'question'].includes(input.kind)
    || !Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 || input.maxOutputTokens > 6000
    || !Number.isInteger(input.inputCharacters) || input.inputCharacters < 1 || input.inputCharacters > 100_000
    || !/^[a-zA-Z0-9._/-]{1,120}$/.test(input.model) || (input.fingerprint !== undefined && !/^[a-zA-Z0-9:_-]{1,200}$/.test(input.fingerprint))) throw new AnalysisHttpError(400, 'Invalid bounded usage reservation.');
}
export function validateUsageUpdate(update: UsageUpdate) {
  if (!['accepted', 'completed', 'cancelled', 'failed', 'incomplete', 'uncertain', 'rejected', 'validation_failed'].includes(update.status)
    || (update.providerId !== undefined && !/^resp_[a-zA-Z0-9_-]{1,250}$/.test(update.providerId))
    || (update.usage && (!Object.values(update.usage).every(value => Number.isSafeInteger(value) && value >= 0) || update.usage.totalTokens !== update.usage.inputTokens + update.usage.outputTokens))) throw new AnalysisHttpError(400, 'Invalid measured usage metadata.');
}
export function validateLimits(limits: UsageLimits) {
  if (!Object.values(limits).every(value => Number.isSafeInteger(value) && value > 0)) throw new AnalysisHttpError(503, 'Usage limits must be positive whole numbers.');
}
export const reservedTokensFor = (input: UsageRequest) => input.inputCharacters * 4 + 16_000 + input.maxOutputTokens;
export const accountedTokensFor = (record: UsageRecord) => {
  // Queued/running usage can be partial (including zero). It must not release the
  // capacity reserved for work that may still consume its complete allowance.
  if (['reserved', 'accepted', 'uncertain'].includes(record.status)) return Math.max(record.reservedTokens, record.usage?.totalTokens ?? 0);
  return record.usage?.totalTokens ?? (record.status === 'rejected' ? 0 : record.reservedTokens);
};
export function compatibleReservation(record: UsageRecord, input: UsageRequest) {
  if (record.sessionId !== input.sessionId || record.kind !== input.kind || record.model !== input.model || record.fingerprint !== input.fingerprint || record.inputCharacters !== input.inputCharacters || record.maxOutputTokens !== input.maxOutputTokens) throw new AnalysisHttpError(409, 'This request reference already belongs to different input.');
}
export function dayStart(now: number) { return Math.floor(now / 86_400_000) * 86_400_000; }
export type UsageQuotaReason='session-rate'|'global-rate'|'daily-requests'|'daily-tokens';
export class UsageQuotaError extends AnalysisHttpError {
 constructor(readonly quotaReason:UsageQuotaReason,readonly retryAt:number){super(429,({
  'session-rate':'Your recent papers are still using the short-term preparation allowance. Illustrations will resume automatically.',
  'global-rate':'The shared preparation allowance is temporarily busy. Illustrations will resume automatically.',
  'daily-requests':'Today’s shared preparation allowance is reached. Saved figures remain available.',
  'daily-tokens':'Today’s shared model allowance is reached or reserved by running papers. Saved figures remain available.',
 })[quotaReason]);}
}
export function usageQuotaResponse(error:unknown){return error instanceof UsageQuotaError?{quota:{reason:error.quotaReason,retryAt:error.retryAt},headers:{'Retry-After':String(Math.max(1,Math.ceil((error.retryAt-Date.now())/1000)))}}:undefined;}
export function checkLimits(records: UsageRecord[], input: UsageRequest, limits: UsageLimits, now: number) {
 const today=records.filter(record=>record.createdAt>=dayStart(now));
 const hourly=records.filter(record=>record.createdAt>now-3_600_000),session=records.filter(record=>record.sessionId===input.sessionId&&record.createdAt>now-600_000);
 const release=(rows:UsageRecord[],limit:number,window:number)=>rows.map(r=>r.createdAt).sort((a,b)=>a-b)[rows.length-limit]+window+1;
 // Financial/day limits take precedence over burst limits: do not promise an earlier retry than allowed.
 if(today.length>=limits.dailyRequests)throw new UsageQuotaError('daily-requests',dayStart(now)+86_400_000);
 if(today.reduce((sum,r)=>sum+accountedTokensFor(r),0)+reservedTokensFor(input)>limits.dailyTokens)throw new UsageQuotaError('daily-tokens',today.some(r=>['reserved','accepted'].includes(r.status))?now+60_000:dayStart(now)+86_400_000);
 if(hourly.length>=limits.globalHourlyRequests)throw new UsageQuotaError('global-rate',Math.max(release(hourly,limits.globalHourlyRequests,3_600_000),session.length>=limits.sessionTenMinuteRequests?release(session,limits.sessionTenMinuteRequests,600_000):0));
 if(session.length>=limits.sessionTenMinuteRequests)throw new UsageQuotaError('session-rate',release(session,limits.sessionTenMinuteRequests,600_000));
}
export function summarize(records: UsageRecord[], limits: UsageLimits, now: number, backend: UsageSummary['backend']): UsageSummary {
  const today = records.filter(record => record.createdAt >= dayStart(now));
  const summary: UsageSummary = { day: new Date(now).toISOString().slice(0, 10), requests: today.length, byKind: { analysis: 0, question: 0 }, byStatus: {}, measured: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, measuredRequests: 0, unavailableRequests: 0, reservedUnmeasuredTokens: 0, accountedTokens: 0, limits, backend };
  for (const record of today) {
    summary.byKind[record.kind]++; summary.byStatus[record.status] = (summary.byStatus[record.status] ?? 0) + 1;
    summary.accountedTokens += accountedTokensFor(record);
    if (record.usage) { summary.measuredRequests++; for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) summary.measured[key] += record.usage[key]; }
    else if (record.status !== 'rejected') summary.unavailableRequests++;
    summary.reservedUnmeasuredTokens += Math.max(0, accountedTokensFor(record) - (record.usage?.totalTokens ?? 0));
  }
  return summary;
}
export function updatedRecord(record: UsageRecord, update: UsageUpdate, now: number): UsageRecord {
  // Delayed polls must never erase measured usage or replace a final result with queued status.
  const terminal = ['completed', 'cancelled', 'failed', 'incomplete', 'validation_failed', 'rejected'].includes(record.status);
  const stale = terminal && ['accepted', 'uncertain'].includes(update.status);
  const status = stale ? record.status : update.status;
  return { ...record, status, updatedAt: now, ...(update.providerId ? { providerId: update.providerId } : {}), ...(!stale && update.usage ? { usage: update.usage } : {}) };
}
export function unavailableStore(): never { throw new AnalysisHttpError(503, 'The durable usage store is unavailable. No new paid request was started.'); }
