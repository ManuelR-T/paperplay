import { z } from 'zod';
import { compileAnalysisPlan, prepareAnalysisContext, sourceFingerprint } from '../../lib/analysis';
import { sourceDocumentSchema } from '../../shared/schema';
import type { AnalysisJob, AnalysisReply } from '../../shared/import-types';
import type { MetaConfig } from '../meta/config';
import { getUsageStore } from '../usage/service';
import { usageIdFor, type UsageStore } from '../usage/store';
import { AnalysisHttpError, readBoundedJson, requireSameOrigin, sessionFor, signingKey, signToken, verifyToken } from './security';
import { createMetaAnalysisProvider, safeProviderError, type AnalysisProvider, type ProviderResponse } from './provider';

const startSchema = z.strictObject({ source: sourceDocumentSchema, requestId: z.string().regex(/^[a-zA-Z0-9-]{16,100}$/) });
const jobSchema = z.strictObject({ token: z.string().max(5000), model: z.string().max(120), sourceId: z.string().max(100), sourceVersion: z.string().max(100), createdAt: z.number().finite() });
const statusSchema = z.strictObject({ source: sourceDocumentSchema, job: jobSchema });
type Dependencies = { getConfig: () => MetaConfig; provider?: (config: MetaConfig) => AnalysisProvider; now?: () => number; signingSecret?: string; allowedOrigin?: string; usage?: UsageStore };

/** Durable reservations guard paid creation; signed capabilities guard accepted job access. */
export function createAnalysisHandlers(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const starts = new Map<string, { fingerprint: string; created: number; promise: Promise<AnalysisReply> }>();
  const usage = () => dependencies.usage ?? getUsageStore();
  const provider = dependencies.provider ?? createMetaAnalysisProvider;
  function json(body: unknown, status = 200, cookie?: string) {
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
  }
  function fail(error: unknown, cookie?: string) {
    const e = error instanceof AnalysisHttpError ? error : new AnalysisHttpError(400, 'The source, generated result or analysis request could not be validated.');
    return json({ error: e.message, uncertain: e.uncertain }, e.status, cookie);
  }
  async function mapResult(response: ProviderResponse, source: z.infer<typeof sourceDocumentSchema>, model: string): Promise<AnalysisReply> {
    if (response.status === 'completed') {
      try {
        const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } : undefined;
        return { status: 'complete', result: compileAnalysisPlan(JSON.parse(response.output_text || ''), source, model, usage) };
      } catch (error) {
        return { status: 'failed', error: error instanceof Error ? error.message : 'The completed analysis did not pass source validation.' };
      }
    }
    if (response.status === 'queued') return { status: 'queued' };
    if (response.status === 'cancelled') return { status: 'cancelled' };
    if (response.status === 'failed') return { status: 'failed', error: 'Meta could not complete this analysis. Your source is retained.' };
    if (response.status === 'incomplete') return { status: 'incomplete', error: 'Meta reached its analysis limit before producing a complete result. No partial figure is activated.' };
    return { status: 'analyzing' };
  }
  async function recordUsage(id: string, update: Parameters<UsageStore['settle']>[1]) {
    // A reserved ceiling remains charged if recording fails. Never lose an accepted
    // job capability merely because reporting is temporarily unavailable.
    try { await usage().settle(id, update); } catch { /* retrieve/cancel remains available */ }
  }
  async function recordResponse(id: string, response: ProviderResponse, reply: AnalysisReply) {
    const status = reply.status === 'complete' ? 'completed' : reply.status === 'failed' && response.status === 'completed' ? 'validation_failed'
      : ['failed', 'cancelled', 'incomplete'].includes(reply.status) ? reply.status as 'failed' | 'cancelled' | 'incomplete' : 'accepted';
    await recordUsage(id, { status, providerId: response.id, ...(response.usage ? { usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } } : {}) });
  }

  return {
    async start(request: Request) {
      let cookie: string | undefined;
      try {
        requireSameOrigin(request, dependencies.allowedOrigin);
        const parsed = startSchema.safeParse(await readBoundedJson(request));
        if (!parsed.success) throw new AnalysisHttpError(400, 'Invalid source or request identifier.');
        const { source, requestId } = parsed.data;
        try { prepareAnalysisContext(source); } catch (error) { throw new AnalysisHttpError(400, error instanceof Error ? error.message : 'Invalid source.'); }
        const config = dependencies.getConfig();
        if (!config.inferenceEnabled) throw new AnalysisHttpError(503, config.disabledReason ?? 'New Meta requests are disabled.');
        if (!config.apiKey) throw new AnalysisHttpError(503, 'Meta analysis is not configured. Read the source or use a prepared paper.');
        const key = signingKey(config.apiKey, dependencies.signingSecret);
        const session = sessionFor(request, key, now(), true); cookie = session.cookie;
        const fingerprint = await sourceFingerprint(source);
        const requestKey = `${session.sid}:${requestId}`;
        for (const [id, item] of starts) if (now() - item.created > 60 * 60 * 1000) starts.delete(id);
        const existing = starts.get(requestKey);
        if (existing) {
          if (existing.fingerprint !== fingerprint) throw new AnalysisHttpError(409, 'This request identifier already belongs to a different source.');
          return json(await existing.promise, 200, cookie);
        }
        const usageId = usageIdFor(session.sid, requestId);
        const reservation = await usage().reserve({ id: usageId, sessionId: session.sid, kind: 'analysis', maxOutputTokens: 6000,
          inputCharacters: prepareAnalysisContext(source).characters, model: config.model, fingerprint });
        const jobFor = (responseId: string, createdAt: number): AnalysisJob => ({ model: config.model, sourceId: source.id, sourceVersion: source.sourceVersion, createdAt,
          token: signToken({ kind: 'job', responseId, sid: session.sid, fingerprint, model: config.model, sourceId: source.id, sourceVersion: source.sourceVersion, createdAt, usageId, exp: createdAt + 24 * 60 * 60 * 1000 }, key) });
        if (!reservation.created) {
          if (reservation.record.providerId) return json({ status: reservation.record.status === 'cancelled' ? 'cancelled' : 'queued', job: jobFor(reservation.record.providerId, reservation.record.createdAt) }, 200, cookie);
          if (reservation.record.status === 'rejected') throw new AnalysisHttpError(409, 'This request was rejected previously. Start a new explicit analysis to retry.');
          throw new AnalysisHttpError(409, 'This submission may already exist at Meta. No replacement request was started.', true);
        }
        const work = (async (): Promise<AnalysisReply> => {
          let started: ProviderResponse;
          try { started = await provider(config).start(source); } catch (error) {
            const safe = safeProviderError(error, true);
            await recordUsage(usageId, { status: safe.uncertain ? 'uncertain' : 'rejected' });
            throw safe;
          }
          if (!started.id) {
            await recordUsage(usageId, { status: 'uncertain' });
            throw new AnalysisHttpError(504, 'Meta may have accepted the analysis, but no recoverable reference was returned.', true);
          }
          const job = jobFor(started.id, reservation.record.createdAt);
          const reply = await mapResult(started, source, config.model);
          await recordResponse(usageId, started, reply);
          return { ...reply, job };
        })();
        starts.set(requestKey, { fingerprint, created: now(), promise: work });
        return json(await work, 200, cookie);
      } catch (error) { return fail(error, cookie); }
    },
    async status(request: Request, cancel = false) {
      try {
        requireSameOrigin(request, dependencies.allowedOrigin);
        const parsed = statusSchema.safeParse(await readBoundedJson(request));
        if (!parsed.success) throw new AnalysisHttpError(400, 'Invalid saved analysis reference or source.');
        const { source, job } = parsed.data;
        const config = dependencies.getConfig();
        if (!config.apiKey) throw new AnalysisHttpError(503, 'Meta analysis is not configured; the saved reference and source are retained.');
        const key = signingKey(config.apiKey, dependencies.signingSecret);
        const session = sessionFor(request, key, now(), false);
        const capability = verifyToken(job.token, key);
        if (capability.kind !== 'job' || capability.sid !== session.sid || capability.sourceId !== source.id || capability.sourceVersion !== source.sourceVersion || capability.model !== job.model || typeof capability.responseId !== 'string' || !/^resp_[a-zA-Z0-9_-]+$/.test(capability.responseId)) throw new AnalysisHttpError(403, 'This saved analysis does not belong to this browser session or source.');
        if (typeof capability.exp !== 'number' || capability.exp <= now()) return json({ status: 'expired', error: 'The saved analysis access expired. The source is retained; no new paid analysis has been started.' });
        if (capability.fingerprint !== await sourceFingerprint(source)) throw new AnalysisHttpError(403, 'The source changed since this analysis was submitted.');
        let result: ProviderResponse;
        try { result = cancel ? await provider(config).cancel(capability.responseId) : await provider(config).retrieve(capability.responseId); }
        catch (error) { const safe = safeProviderError(error, false); if (safe.status === 410) return json({ status: 'expired', error: safe.message }); throw safe; }
        // Cancellation responses can have an empty output array even when already completed.
        if (cancel && result.status === 'completed') {
          try { result = await provider(config).retrieve(capability.responseId); } catch (error) { throw safeProviderError(error, false); }
        }
        const reply = await mapResult(result, source, job.model);
        if (typeof capability.usageId === 'string') await recordResponse(capability.usageId, result, reply);
        return json({ ...reply, job });
      } catch (error) { return fail(error); }
    },
  };
}
