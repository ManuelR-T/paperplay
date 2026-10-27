import { z } from 'zod';

export const META_BASE_URL = 'https://api.meta.ai/v1';
export const DEFAULT_META_MODEL = 'muse-spark-1.3';

const environmentSchema = z.object({
  MODEL_API_KEY: z.string().trim().min(1).max(1024).optional(),
  META_MODEL: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._/-]+$/).default(DEFAULT_META_MODEL),
  META_ANALYSIS_ENABLED: z.enum(['true', 'false']).default('true'),
  META_CREDITS_EXPIRE_AT: z.string().datetime({ offset: true }).optional(),
});

export function readMetaConfig(environment: Record<string, string | undefined>, now = Date.now()) {
  // Empty optional keys mean unconfigured, while invalid overrides fail explicitly.
  const parsed = environmentSchema.safeParse({
    MODEL_API_KEY: environment.MODEL_API_KEY?.trim() || undefined,
    META_MODEL: environment.META_MODEL,
    META_ANALYSIS_ENABLED: environment.META_ANALYSIS_ENABLED,
    META_CREDITS_EXPIRE_AT: environment.META_CREDITS_EXPIRE_AT?.trim() || undefined,
  });
  if (!parsed.success) throw new Error('Invalid Meta server configuration. Check .env.example.');
  const expired = !!parsed.data.META_CREDITS_EXPIRE_AT && Date.parse(parsed.data.META_CREDITS_EXPIRE_AT) <= now;
  const inferenceEnabled = parsed.data.META_ANALYSIS_ENABLED === 'true' && !expired;
  const disabledReason = inferenceEnabled ? undefined : expired ? 'The configured Meta creation cutoff has passed. Existing sources and results remain readable.' : 'New Meta requests are disabled by the operator. Existing sources and results remain readable.';
  return { baseURL: META_BASE_URL, model: parsed.data.META_MODEL, apiKey: parsed.data.MODEL_API_KEY, inferenceEnabled, disabledReason };
}

export type MetaConfig = ReturnType<typeof readMetaConfig>;

export function publicMetaStatus(config: MetaConfig) {
  return { configured: Boolean(config.apiKey) && config.inferenceEnabled, model: config.model, ...(config.disabledReason ? { disabledReason: config.disabledReason } : {}) };
}
