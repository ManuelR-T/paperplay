import OpenAI from 'openai';
import { z } from 'zod';
import { QUESTION_INSTRUCTIONS, questionAnswerSchema } from '../../lib/questions';
import type { MetaConfig } from '../meta/config';

function metaSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(metaSchema);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$schema').map(([key, child]) => key === 'const' ? ['enum', [child]] : [key, metaSchema(child)]));
  return value;
}
export type QuestionProviderResponse = { id: string; status?: string; output_text?: string; usage?: { input_tokens: number; output_tokens: number; total_tokens: number } | null };
export type QuestionProvider = (context: string, question: string) => Promise<QuestionProviderResponse>;
export function createQuestionProvider(config: MetaConfig): QuestionProvider {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0, timeout: 25_000 });
  return async (context, question) => client.responses.create({ model: config.model, max_output_tokens: 1_200, reasoning: { effort: 'low' },
    instructions: QUESTION_INSTRUCTIONS, input: JSON.stringify({ context: JSON.parse(context), question }),
    text: { format: { type: 'json_schema', name: 'paperplay_contextual_answer', strict: true, schema: metaSchema(z.toJSONSchema(questionAnswerSchema)) as Record<string, unknown> } },
  });
}
