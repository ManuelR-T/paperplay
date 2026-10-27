import OpenAI from 'openai';
import { z } from 'zod';
import { ANALYSIS_CATALOG, ANALYSIS_INSTRUCTIONS, generatedPlanSchema, prepareAnalysisContext } from '../../lib/analysis';
import type { SourceDocument } from '../../shared/schema';
import type { MetaConfig } from '../meta/config';
import { AnalysisHttpError } from './security';

export type ProviderResponse = {
  id: string; status?: string; output_text?: string; model?: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number } | null;
};
export type AnalysisProvider = {
  start(source: SourceDocument): Promise<ProviderResponse>;
  retrieve(id: string): Promise<ProviderResponse>;
  cancel(id: string): Promise<ProviderResponse>;
};
function compatibleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compatibleSchema);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '$schema') continue;
      if (key === 'const') result.enum = [child];
      else result[key] = compatibleSchema(child);
    }
    return result;
  }
  return value;
}
export const analysisJsonSchema = compatibleSchema(z.toJSONSchema(generatedPlanSchema)) as Record<string, unknown>;

export function createMetaAnalysisProvider(config: MetaConfig): AnalysisProvider {
  if (!config.apiKey) throw new AnalysisHttpError(503, 'Meta analysis is not configured. The source and prepared papers remain available.');
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0, timeout: 25_000 });
  return {
    async start(source) {
      if (!config.inferenceEnabled) throw new AnalysisHttpError(503, config.disabledReason ?? 'New Meta requests are disabled.');
      const context = prepareAnalysisContext(source);
      return await client.responses.create({ model: config.model, background: true, max_output_tokens: 6000,
        instructions: `${ANALYSIS_INSTRUCTIONS}\nSupported catalog: ${JSON.stringify(ANALYSIS_CATALOG)}`,
        input: context.text,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_schema', name: 'paperplay_figure_plan', strict: true, schema: analysisJsonSchema } },
      });
    },
    async retrieve(id) { return await client.responses.retrieve(id); },
    async cancel(id) { return await client.responses.cancel(id); },
  };
}

export function safeProviderError(error: unknown, submitting: boolean): AnalysisHttpError {
  if (error instanceof AnalysisHttpError) return error;
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status === 401 || status === 403) return new AnalysisHttpError(502, 'Meta rejected the server credentials or model access. Check the project configuration.');
    if (status === 402) return new AnalysisHttpError(502, 'Meta credits or billing are unavailable. Check the Meta dashboard.');
    if (status === 429) return new AnalysisHttpError(429, 'Meta is rate-limited. Wait before resuming; no automatic paid retry was made.');
    if (status === 404 && !submitting) return new AnalysisHttpError(410, 'This Meta analysis is unavailable or expired. The local source is retained.');
    if (status && status >= 400 && status < 500) return new AnalysisHttpError(502, 'Meta could not accept this bounded analysis request. No automatic paid retry was made.');
  }
  return new AnalysisHttpError(504, submitting
    ? 'The submission outcome is uncertain. Do not automatically start another paid analysis; an accepted job may still exist at Meta.'
    : 'The analysis status could not be retrieved. Its reference is retained; resume the existing analysis later.', submitting);
}
