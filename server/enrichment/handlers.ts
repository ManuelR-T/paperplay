import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sourceDocumentSchema, validateDocument, type SourceDocument } from '../../shared/schema';
import { widgetEnvelopeSchema, validateWidgetEnvelope, type WidgetEnvelope, type WidgetKind } from '../../shared/widgets';
import { widgetCatalog, WIDGET_CATALOG_VERSION } from '../../lib/widgets/catalog';
import { compileEnrichmentPlan, type CustomWidgetReview, type EnrichmentAction, type EnrichmentJob, type EnrichmentReply } from '../../lib/enrichment/contracts';
import { sectionContext } from '../../lib/enrichment/sections';
import { getUsageStore } from '../usage/service';
import { usageIdFor, reservedTokensFor, type UsageStore } from '../usage/model';
import { AnalysisHttpError, requireSameOrigin, sessionFor, signingKey, signToken, verifyToken } from '../analysis/security';
import { safeProviderError, type ProviderResponse } from '../analysis/provider';
import type { MetaConfig } from '../meta/config';
import { createMetaEnrichmentProvider, providerInput, ENRICHMENT_MAX_OUTPUT_TOKENS, type EnrichmentInput, type EnrichmentProvider } from './provider';
import { getEnrichmentStore, type EnrichmentStore, type EnrichmentRecord } from './store';

const actionSchema = z.enum(['plan','repair','edit']);
const contextFields = { source: sourceDocumentSchema, sectionId: z.string().min(1).max(100), action: actionSchema, feedback: z.string().max(1200).default(''), target: widgetEnvelopeSchema.optional() };
const startSchema = z.strictObject({ ...contextFields, requestId: z.string().regex(/^[a-zA-Z0-9-]{16,100}$/) });
const jobSchema = z.strictObject({ token: z.string().max(5000), createdAt: z.number().finite(), action: actionSchema, sectionId: z.string().min(1).max(100), model: z.string().max(120) });
const statusSchema = z.strictObject({ ...contextFields, job: jobSchema });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function readEnrichmentJson(request: Request) {
  const max = 2_500_000;
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AnalysisHttpError(415, 'Enrichment requests require JSON.');
  if (Number(request.headers.get('content-length') || 0) > max || !request.body) throw new AnalysisHttpError(413, 'The complete source request exceeds the 2.5 MB enrichment transport limit. The saved source is retained.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done,value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw new AnalysisHttpError(413, 'The complete source request exceeds the 2.5 MB enrichment transport limit.'); } chunks.push(value); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { throw new AnalysisHttpError(400, 'The enrichment request contains invalid JSON.'); }
  } finally { reader.releaseLock(); }
}
type Dependencies = { reviewCustom?: CustomWidgetReview; getConfig: () => MetaConfig; usage?: UsageStore; store?: EnrichmentStore; provider?: (config: MetaConfig) => EnrichmentProvider; signingSecret?: string; allowedOrigin?: string; now?: () => number };

export function createEnrichmentHandlers(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const usage = () => dependencies.usage ?? getUsageStore(); const store = () => dependencies.store ?? getEnrichmentStore();
  const provider = dependencies.provider ?? createMetaEnrichmentProvider;
  const running = new Map<string, Promise<EnrichmentReply>>();
  const json = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
  const fail = (error: unknown, cookie?: string) => { const e = error instanceof AnalysisHttpError ? error : new AnalysisHttpError(400, 'The source, section or widget configuration could not be validated. The previous valid work is retained.'); return json({ error: e.message, uncertain: e.uncertain }, e.status, cookie); };
  function prepare(input: z.infer<typeof statusSchema> | z.infer<typeof startSchema>, config: MetaConfig) {
    const source = validateDocument(input.source);
    if ((input.action !== 'plan') !== !!input.target) throw new AnalysisHttpError(400, 'Targeted repair/edit requires exactly one valid current widget; a plan has no target.');
    if (input.action !== 'plan' && input.feedback.trim().length < 4) throw new AnalysisHttpError(400, 'Describe the requested repair or configuration change.');
    if (/```|<script|javascript:|\beval\s*\(|process\.env|\b(?:exec|spawn|require)\s*\(/i.test(input.feedback)) throw new AnalysisHttpError(400, 'This action accepts a bounded configuration request, not executable code.');
    const target = input.target ? validateWidgetEnvelope(input.target, source) : undefined;
    const context = sectionContext(source, input.sectionId, target?.source.blockId);
    const request: EnrichmentInput = { action: input.action, context: context.text, feedback: input.feedback.trim(), ...(target ? { target } : {}) };
    const inputText = providerInput(request);
    if (inputText.length > 70_000) throw new AnalysisHttpError(400, 'The selected source/configuration exceeds the enrichment context budget.');
    return { source, target, context, request, inputText, documentHash: digest({ ...source, anchors: [] }), contextHash: digest({ request, catalog: WIDGET_CATALOG_VERSION, model: config.model }) };
  }
  function jobFor(record: EnrichmentRecord, responseId: string, model: string, key: string): EnrichmentJob {
    if (record.action === 'artifact') throw new AnalysisHttpError(403, 'Generated artifact jobs use their own bounded retrieval route.');
    return { action: record.action, sectionId: record.sectionId, createdAt: record.createdAt, model,
      token: signToken({ kind: 'enrichment-job', owner: record.owner, id: record.id, documentHash: record.documentHash, contextHash: record.contextHash, responseId, model, action: record.action, sectionId: record.sectionId, createdAt: record.createdAt, exp: record.createdAt + 86_400_000 }, key) };
  }
  async function mapResponse(response: ProviderResponse, input: ReturnType<typeof prepare>, model: string): Promise<EnrichmentReply> {
    if (response.status === 'completed') {
      try {
        const measured = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } : undefined;
        const result = compileEnrichmentPlan(JSON.parse(response.output_text || ''), { source: input.source, section: input.context.section, action: input.request.action, target: input.target, model, catalogVersion: WIDGET_CATALOG_VERSION,
          reviewCustom: dependencies.reviewCustom, allowedInteractions: (kind: WidgetKind) => widgetCatalog.find(c => c.format === 'paperplay-widget' && c.kind === kind)?.controls ?? [], usage: measured });
        return { status: 'complete', result };
      } catch { return { status: 'failed', error: 'Meta output did not match the bounded plan/source contract. The previous widget is retained.' }; }
    }
    if (response.status === 'queued') return { status: 'queued' };
    if (response.status === 'cancelled') return { status: 'cancelled' };
    if (response.status === 'incomplete') return { status: 'incomplete', error: 'Meta reached the output limit; no incomplete proposal is activated.' };
    if (response.status === 'failed') return { status: 'failed', error: 'Meta could not complete this enrichment. The source and previous valid widgets are retained.' };
    return { status: 'analyzing' };
  }
  async function settle(id: string, response: ProviderResponse, reply: EnrichmentReply) {
    const status = reply.status === 'complete' ? 'completed' : reply.status === 'failed' && response.status === 'completed' ? 'validation_failed' : ['failed','incomplete','cancelled'].includes(reply.status) ? reply.status as 'failed' | 'incomplete' | 'cancelled' : 'accepted';
    const measured = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } : undefined;
    // Both reservations remain conservative if reporting becomes unavailable.
    try { store().settle(id, { status, providerId: response.id, ...(measured ? { actualTokens: measured.totalTokens } : {}) }); } catch { /* accepted-job retrieval must remain available */ }
    try { await usage().settle(id, { status, providerId: response.id, ...(measured ? { usage: measured } : {}) }); } catch { /* same conservative fallback */ }
  }
  function readBudget(owner: string, hash: string) { try { return store().budget(owner, hash); } catch { return undefined; } }
  return {
    async session(request: Request) {
      try {
        requireSameOrigin(request, dependencies.allowedOrigin); const config = dependencies.getConfig();
        if (!config.apiKey) throw new AnalysisHttpError(503, 'Meta enrichment is not configured.');
        const session = sessionFor(request, signingKey(config.apiKey, dependencies.signingSecret), now(), true);
        return json({ ready: true }, 200, session.cookie);
      } catch (error) { return fail(error); }
    },
    async start(request: Request) {
      let cookie: string | undefined;
      try {
        requireSameOrigin(request, dependencies.allowedOrigin);
        const input = startSchema.parse(await readEnrichmentJson(request)); const config = dependencies.getConfig();
        if (!config.inferenceEnabled || !config.apiKey) throw new AnalysisHttpError(503, config.disabledReason ?? 'Meta enrichment is not configured. Reading and local widgets remain available.');
        const prepared = prepare(input, config); const key = signingKey(config.apiKey, dependencies.signingSecret);
        // Establish the cookie in a separate no-inference roundtrip, so a lost
        // first creation response cannot silently change anonymous ownership.
        sessionFor(request, key, now(), false);
        const session = sessionFor(request, key, now(), true); cookie = session.cookie;
        const id = usageIdFor(session.sid, `enrichment-${input.requestId}`);
        const reservationInput = { id, sessionId: session.sid, kind: 'analysis' as const, maxOutputTokens: ENRICHMENT_MAX_OUTPUT_TOKENS, inputCharacters: prepared.inputText.length, model: config.model, fingerprint: prepared.contextHash };
        const reserved = store().reserve({ id, owner: session.sid, documentHash: prepared.documentHash, contextHash: prepared.contextHash, action: input.action, sectionId: input.sectionId, reservedTokens: reservedTokensFor(reservationInput) });
        if (!reserved.created) {
          const inProgress = running.get(id); if (inProgress) return json(await inProgress, 200, cookie);
          if (reserved.record.providerId) return json({ status: reserved.record.status === 'cancelled' ? 'cancelled' : 'queued', job: jobFor(reserved.record, reserved.record.providerId, config.model, key), budget: readBudget(session.sid, prepared.documentHash) }, 200, cookie);
          throw new AnalysisHttpError(409, 'An earlier submission with this identifier is unresolved. No replacement paid request was sent.', true);
        }
        try {
          const globalReservation = await usage().reserve(reservationInput);
          if (!globalReservation.created) throw new AnalysisHttpError(409, 'The shared request reference already exists. No replacement request was sent.', true);
        } catch (error) { store().settle(id, { status: 'rejected', actualTokens: 0 }); throw error; }
        const work = (async (): Promise<EnrichmentReply> => {
          let response: ProviderResponse;
          try { response = await provider(config).start(prepared.request); }
          catch (error) {
            const e = safeProviderError(error, true); const status = e.uncertain ? 'uncertain' : 'rejected';
            try { store().settle(id, { status, ...(e.uncertain ? {} : { actualTokens: 0 }) }); } catch { /* reservation retained */ }
            try { await usage().settle(id, { status }); } catch { /* reservation retained */ } throw e;
          }
          if (!/^resp_[a-zA-Z0-9_-]{1,250}$/.test(response.id)) { try { store().settle(id, { status: 'uncertain' }); } catch {} throw new AnalysisHttpError(504, 'Meta may have accepted the request, but returned no valid recoverable reference. Do not resubmit automatically.', true); }
          const job = jobFor(reserved.record, response.id, config.model, key);
          const reply = await mapResponse(response, prepared, config.model); await settle(id, response, reply);
          return { ...reply, job, budget: readBudget(session.sid, prepared.documentHash) };
        })();
        running.set(id, work);
        try { return json(await work, 200, cookie); } finally { running.delete(id); }
      } catch (error) { return fail(error, cookie); }
    },
    async status(request: Request, cancel = false) {
      try {
        requireSameOrigin(request, dependencies.allowedOrigin);
        const input = statusSchema.parse(await readEnrichmentJson(request)); const config = dependencies.getConfig();
        if (!config.apiKey) throw new AnalysisHttpError(503, 'The Meta key needed to retrieve this accepted job is unavailable. The saved reference is retained.');
        const key = signingKey(config.apiKey, dependencies.signingSecret); const session = sessionFor(request, key, now(), false); const token = verifyToken(input.job.token, key);
        const prepared = prepare(input, { ...config, model: input.job.model });
        const compatibleDocument = token.documentHash === prepared.documentHash || token.documentHash === digest(prepared.source);
        if (token.kind !== 'enrichment-job' || token.owner !== session.sid || !compatibleDocument || token.contextHash !== prepared.contextHash || token.action !== input.action || token.sectionId !== input.sectionId || token.model !== input.job.model || typeof token.id !== 'string' || typeof token.responseId !== 'string' || !/^resp_[a-zA-Z0-9_-]{1,250}$/.test(token.responseId)) throw new AnalysisHttpError(403, 'This saved enrichment job does not belong to this browser/source/configuration.');
        if (typeof token.exp !== 'number' || token.exp <= now()) return json({ status: 'expired', error: 'The saved enrichment access expired; no replacement request was created.' });
        let response: ProviderResponse;
        try {
          const adapter = provider({ ...config, model: input.job.model }); response = cancel ? await adapter.cancel(token.responseId) : await adapter.retrieve(token.responseId);
          if (cancel && response.status === 'completed') response = await adapter.retrieve(token.responseId);
        } catch (error) { const e = safeProviderError(error, false); if (e.status === 410) return json({ status: 'expired', error: e.message }); throw e; }
        if (response.id !== token.responseId) throw new AnalysisHttpError(502, 'The provider returned a different job reference. The saved capability was retained.');
        const reply = await mapResponse(response, prepared, input.job.model); await settle(token.id, response, reply);
        return json({ ...reply, job: input.job, budget: readBudget(session.sid, token.documentHash as string) });
      } catch (error) { return fail(error); }
    },
  };
}
