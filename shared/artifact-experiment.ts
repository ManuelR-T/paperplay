import { z } from 'zod';
import { figureArtifactSchema, validateFigureArtifact } from './figure-artifacts';
import { sdkEventSchema, sdkFrameSchema } from './figure-sdk';
import { canonicalArtifactJson } from './figure-compilation';
import { assertBoundedFigureJson } from './figure-json';
import type { SourceDocument } from './schema';
import { scientificAssetSchema, type ScientificAsset } from './scientific-assets';
import { FIGURE_QUALITY_POLICY, figureQualityFeedbackSchema } from './figure-quality';
import { generationPlanSchema } from './artifact-generation';
import { FIGURE_RUNTIME_VERSION, FIGURE_RANDOM_POLICY } from './figure-runtime';
import { FIGURE_SDK_SOURCE, sha256Text } from '../lib/artifacts/sdk-source';

export const ARTIFACT_EXPERIMENT_VERSION = 1 as const;
export const ARTIFACT_CACHE_MAX_RECORD_BYTES = 1024 * 1024;
export const ARTIFACT_PLAN_MAX_RECORD_BYTES = 2 * 1024 * 1024;
export const ARTIFACT_EXPERIMENT_RUNTIME_VERSION = FIGURE_RUNTIME_VERSION;
const sha = z.string().regex(/^[a-f0-9]{64}$/), version = z.string().min(1).max(160);
export const artifactExperimentIdentitySchema = z.strictObject({
  source: z.strictObject({ documentId: z.string().min(1).max(100), sourceVersion: z.string().min(1).max(100), fingerprint: sha }),
  artifactSha256: sha,
  sdk: z.strictObject({ id: z.literal('paperplay-figure-sdk'), version, sha256: sha }),
  compiler: version, runtime: version, randomPolicy: version, qualityPolicy: version,
  dependencies: z.array(z.strictObject({ id: version, version, sha256: sha })).max(16),
  assets: z.array(z.strictObject({ id: z.string().min(1).max(100), kind: version, sha256: sha })).max(16),
  inputSha256: sha, seed: z.number().int().min(0).max(4294967295),
});
export type ArtifactExperimentIdentity = z.infer<typeof artifactExperimentIdentitySchema>;
export const artifactCacheKindSchema = z.enum(['plan','build','execution','report']);
export type ArtifactCacheKind = z.infer<typeof artifactCacheKindSchema>;
export const artifactCacheRecordSchema = z.strictObject({ format: z.literal('paperplay-artifact-cache-record'), schemaVersion: z.literal(1), id: sha, key: sha, kind: artifactCacheKindSchema, identity: artifactExperimentIdentitySchema, payload: z.unknown() });
export type ArtifactCacheRecord = z.infer<typeof artifactCacheRecordSchema>;
export const artifactRecordedReplaySchema = z.strictObject({frame:sdkFrameSchema,seed:z.number().int().min(0).max(4294967295),inputSha256:sha,artifactSha256:sha});
export type ArtifactRecordedReplay = z.infer<typeof artifactRecordedReplaySchema>;
export const artifactPlanPayloadSchema = z.strictObject({ artifact: figureArtifactSchema, plan: generationPlanSchema.optional(), inputJson: z.string().max(256*1024).optional(), seed: z.number().int().min(0).max(4294967295).optional(), assets: z.array(scientificAssetSchema).max(16).optional(), replay:artifactRecordedReplaySchema.optional() });
export const artifactExecutionPayloadSchema = z.strictObject({ inputJson: z.string().max(256*1024), entries: z.array(z.strictObject({ key: sha, inputJson: z.string().max(256*1024), stateJson: z.string().max(64*1024), eventJson: z.string().max(2048), frame: sdkFrameSchema })).max(32), currentKey: sha.nullable() }).refine(value => value.currentKey === null || value.entries.some(entry => entry.key === value.currentKey), 'Missing current execution frame.');
const payloadSchemas = {
  plan: artifactPlanPayloadSchema,
  build: z.strictObject({ status: z.literal('admitted'), compilerVersion: version, artifactSha256: sha }),
  execution: artifactExecutionPayloadSchema,
  report: z.strictObject({ report: figureQualityFeedbackSchema, environment: z.string().max(2000), policyVersion: version, executionKey: sha.nullable() }),
};

export function artifactExperimentOwner(identity: ArtifactExperimentIdentity) { return `${identity.source.documentId}:${identity.source.fingerprint}`; }
export async function createArtifactExperimentIdentity(options: { source: SourceDocument; artifact: unknown; assets?: readonly ScientificAsset[]; input?: unknown; seed?: number; runtimeVersion?: string; qualityPolicyVersion?: string }): Promise<ArtifactExperimentIdentity> {
  const artifact = validateFigureArtifact(options.artifact, options.source), input = options.input ?? (artifact.kind === 'generated' ? artifact.initialInput ?? {} : {});
  assertBoundedFigureJson(input, 256*1024);
  return artifactExperimentIdentitySchema.parse({ source: { documentId: options.source.id, sourceVersion: options.source.sourceVersion, fingerprint: await sha256Text(JSON.stringify({ ...options.source, anchors: [] })) }, artifactSha256: await sha256Text(JSON.stringify(artifact)), sdk: { id: 'paperplay-figure-sdk', version: '1.0.0', sha256: await sha256Text(FIGURE_SDK_SOURCE) }, compiler: 'paperplay-script-admission@1.0.0/acorn@8.19.0/quickjs@0.32.0/synchronous-update-v1', runtime: options.runtimeVersion ?? ARTIFACT_EXPERIMENT_RUNTIME_VERSION, randomPolicy: FIGURE_RANDOM_POLICY, qualityPolicy: options.qualityPolicyVersion ?? FIGURE_QUALITY_POLICY.version, dependencies: artifact.kind === 'generated' ? artifact.dependencyLock.map(({id,version,sha256}) => ({id,version,sha256})) : [], assets: artifact.kind === 'generated' ? artifact.assetBindings : (options.assets ?? []).map(asset => ({ id: asset.id, kind: asset.kind, sha256: asset.checksum.value })), inputSha256: await sha256Text(JSON.stringify(input)), seed: options.seed ?? 42 });
}
/** Scope each level independently. Input changes never invalidate the inert build. */
export async function artifactCacheKey(kind: ArtifactCacheKind, identity: ArtifactExperimentIdentity, variant: unknown = null) {
  artifactExperimentIdentitySchema.parse(identity); assertBoundedFigureJson(variant, 768*1024);
  const base = { source: identity.source, artifactSha256: identity.artifactSha256 };
  const build = { ...base, sdk: identity.sdk, compiler: identity.compiler, dependencies: identity.dependencies };
  const execution = { ...build, runtime: identity.runtime, randomPolicy: identity.randomPolicy, assets: identity.assets, inputSha256: identity.inputSha256, seed: identity.seed };
  const scoped = kind === 'plan' ? base : kind === 'build' ? build : kind === 'execution' ? execution : { ...execution, qualityPolicy: identity.qualityPolicy };
  return sha256Text(canonicalArtifactJson({ format: 'paperplay-artifact-cache-key', schemaVersion: 1, kind, identity: scoped, variantSha256: await sha256Text(JSON.stringify(variant)) }));
}
export async function createArtifactCacheRecord(kind: ArtifactCacheKind, identity: ArtifactExperimentIdentity, payload: unknown, key?: string): Promise<ArtifactCacheRecord> {
  assertBoundedFigureJson(payload, (kind === 'plan' ? ARTIFACT_PLAN_MAX_RECORD_BYTES : ARTIFACT_CACHE_MAX_RECORD_BYTES) - 8192);
  const body = { format: 'paperplay-artifact-cache-record' as const, schemaVersion: 1 as const, key: key ?? await artifactCacheKey(kind, identity), kind, identity: artifactExperimentIdentitySchema.parse(identity), payload };
  const record = { ...body, id: await sha256Text(JSON.stringify(body)) };
  return validateArtifactCacheRecord(record);
}
export async function validateArtifactCacheRecord(input: unknown): Promise<ArtifactCacheRecord> {
  assertBoundedFigureJson(input, input && typeof input === 'object' && 'kind' in input && input.kind === 'plan' ? ARTIFACT_PLAN_MAX_RECORD_BYTES : ARTIFACT_CACHE_MAX_RECORD_BYTES);
  const record = artifactCacheRecordSchema.parse(input); const { id, ...body } = record;
  if (await sha256Text(JSON.stringify(body)) !== id) throw Error('Artifact cache content digest differs. Original data was retained.');
  // Strict purpose-specific envelopes exclude private jobs and executable receipts.
  // Scientific input/state may legitimately contain keys such as 'token'.
  payloadSchemas[record.kind].parse(record.payload);
  if (record.kind === 'plan') { const plan = payloadSchemas.plan.parse(record.payload); if (await sha256Text(JSON.stringify(plan.artifact)) !== record.identity.artifactSha256 || plan.artifact.source.documentId !== record.identity.source.documentId || plan.artifact.source.sourceVersion !== record.identity.source.sourceVersion) throw Error('The cached plan artifact differs from its identity.'); }
  if (record.kind === 'build') { const build = payloadSchemas.build.parse(record.payload); if (build.artifactSha256 !== record.identity.artifactSha256 || build.compilerVersion !== record.identity.compiler) throw Error('The cached build metadata differs from its identity.'); }
  if (record.kind === 'execution') { const execution = artifactExecutionPayloadSchema.parse(record.payload); for (const entry of execution.entries) { assertBoundedFigureJson(JSON.parse(entry.inputJson),256*1024); assertBoundedFigureJson(JSON.parse(entry.stateJson),64*1024); sdkEventSchema.parse(JSON.parse(entry.eventJson)); } assertBoundedFigureJson(JSON.parse(execution.inputJson),256*1024); }
  return record;
}
export function artifactIdentityCompatible(identity: ArtifactExperimentIdentity, kind: ArtifactCacheKind = 'execution') {
  if (kind === 'plan') return true;
  if (identity.sdk.version !== '1.0.0' || identity.compiler !== 'paperplay-script-admission@1.0.0/acorn@8.19.0/quickjs@0.32.0/synchronous-update-v1') return false;
  if (kind === 'build') return true;
  return identity.runtime === ARTIFACT_EXPERIMENT_RUNTIME_VERSION && identity.randomPolicy === FIGURE_RANDOM_POLICY && (kind !== 'report' || identity.qualityPolicy === FIGURE_QUALITY_POLICY.version);
}
export { figureArtifactSchema };
