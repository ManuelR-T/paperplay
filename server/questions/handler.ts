import { createHash } from 'node:crypto';
import { prepareQuestionContext, questionRequestSchema, validateQuestionAnswer, type QuestionResult } from '../../lib/questions';
import type { MetaConfig } from '../meta/config';
import { AnalysisHttpError, readBoundedJson, requireSameOrigin, sessionFor, signingKey } from '../analysis/security';
import { safeProviderError } from '../analysis/provider';
import { createQuestionProvider, type QuestionProvider, type QuestionProviderResponse } from './provider';
import { usageIdFor, type UsageStore, type UsageUpdate } from '../usage/store';

type Dependencies = { getConfig: () => MetaConfig; usage: UsageStore; provider?: (config: MetaConfig) => QuestionProvider; signingSecret?: string; allowedOrigin?: string; now?: () => number };
export function createQuestionHandler(dependencies: Dependencies) {
  return async function answerQuestion(request: Request) {
    let cookie: string | undefined;
    let reservation: string | undefined;
    let response: QuestionProviderResponse | undefined;
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
    const reportUsage = async (id: string, update: UsageUpdate) => {
      try { await dependencies.usage.settle(id, update); }
      catch { /* Keep the durable conservative reservation; reporting cannot erase a valid answer or obscure an uncertain submission. */ }
    };
    try {
      requireSameOrigin(request, dependencies.allowedOrigin);
      const parsed = questionRequestSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AnalysisHttpError(400, 'Choose a valid passage or figure and ask a question of 3–1,000 characters.');
      const { context, question, requestId } = parsed.data;
      let prepared: ReturnType<typeof prepareQuestionContext>;
      try { prepared = prepareQuestionContext(context); }
      catch (error) { throw new AnalysisHttpError(400, error instanceof Error ? error.message : 'The selected question context is invalid.'); }
      const config = dependencies.getConfig();
      if (!config.inferenceEnabled) throw new AnalysisHttpError(503, config.disabledReason ?? 'New Meta requests are disabled.');
      if (!config.apiKey) throw new AnalysisHttpError(503, 'Meta questions are not configured. The source and figures remain available.');
      const session = sessionFor(request, signingKey(config.apiKey, dependencies.signingSecret), (dependencies.now ?? Date.now)(), true); cookie = session.cookie;
      const id = usageIdFor(session.sid, requestId);
      const fingerprint = createHash('sha256').update(prepared.text).update(question).digest('hex');
      const reserved = await dependencies.usage.reserve({ id, sessionId: session.sid, kind: 'question', inputCharacters: prepared.text.length + question.length,
        maxOutputTokens: 1_200, model: config.model, fingerprint });
      if (!reserved.created) throw new AnalysisHttpError(409, 'This question request was already submitted. No duplicate model request was made. Its earlier answer may be unavailable; submitting a new question is a separate paid request.');
      reservation = id;
      try { response = await (dependencies.provider ?? createQuestionProvider)(config)(prepared.text, question); }
      catch (error) {
        const safe = safeProviderError(error, true);
        await reportUsage(id, { status: safe.uncertain ? 'uncertain' : 'rejected' });
        reservation = undefined;
        throw safe;
      }
      const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } : undefined;
      if (response.status && response.status !== 'completed') {
        await reportUsage(id, { status: response.status === 'incomplete' ? 'incomplete' : 'failed', providerId: response.id, usage });
        reservation = undefined;
        throw new AnalysisHttpError(502, 'Meta did not finish a complete contextual answer. No partial answer was activated.');
      }
      let answer: ReturnType<typeof validateQuestionAnswer>;
      try { answer = validateQuestionAnswer(JSON.parse(response.output_text || ''), prepared); }
      catch {
        await reportUsage(id, { status: 'validation_failed', providerId: response.id, usage });
        reservation = undefined;
        throw new AnalysisHttpError(502, 'The contextual answer failed citation or output validation. It was not displayed; the source and figures are retained.');
      }
      await reportUsage(id, { status: 'completed', providerId: response.id, usage });
      reservation = undefined;
      const result: QuestionResult = { ...answer, model: config.model, ...(usage ? { usage } : {}), contextKey: prepared.contextKey };
      return json({ result });
    } catch (error) {
      if (reservation) {
        // If accounting could not be committed, retain the reservation conservatively.
        await reportUsage(reservation, { status: response ? 'validation_failed' : 'uncertain' });
      }
      const safe = error instanceof AnalysisHttpError ? error : new AnalysisHttpError(503, 'Contextual questions are temporarily unavailable. No automatic retry was made.');
      return json({ error: safe.message, uncertain: safe.uncertain }, safe.status);
    }
  };
}
