import { z } from 'zod';
import { sourceDocumentSchema, validateDocument, type SourceDocument } from '../../shared/schema';
import { figureArtifactSchema, validateFigureArtifact, type FigureArtifact } from '../../shared/figure-artifacts';
import { scientificAssetSchema, type ScientificAsset } from '../../shared/scientific-assets';
import { artifactExperimentIdentitySchema, artifactCacheRecordSchema, createArtifactExperimentIdentity, validateArtifactCacheRecord, artifactIdentityCompatible, type ArtifactCacheRecord } from '../../shared/artifact-experiment';
import { validateScientificAsset } from '../assets/local';
import { sha256Text } from './sdk-source';
import { assertBoundedFigureJson } from '../../shared/figure-json';
import { sdkFrameSchema, validateSdkFrame, type SdkFrame } from '../../shared/figure-sdk';
import { validateArtifactInterface } from '../../shared/figure-interfaces';
import { artifactExecutionPayloadSchema, artifactCacheKey } from '../../shared/artifact-experiment';

export const MAX_ARTIFACT_EXPERIMENT_BUNDLE_BYTES = 20*1024*1024;
const attributionSchema = z.strictObject({ authors: z.string().min(1).max(2000), notice: z.string().min(1).max(5000), sourceUrl: z.string().url().max(2000).optional(), license: z.string().min(1).max(500).optional(), licenseUrl: z.string().url().max(2000).optional() });
const bundleSchema = z.strictObject({ format: z.literal('paperplay-artifact-experiment'), schemaVersion: z.literal(1), contents: z.literal('artifact-and-quoted-excerpts'), inclusions: z.strictObject({ source: z.boolean(), assets: z.boolean(), results: z.boolean() }), artifact: figureArtifactSchema, identity: artifactExperimentIdentitySchema, inputJson: z.string().min(1).max(256*1024), inputJsonSha256: z.string().regex(/^[a-f0-9]{64}$/), inputBinding: z.enum(['complete','assets-omitted']), records: z.array(artifactCacheRecordSchema).max(64), recordedFrames: z.array(z.strictObject({ frame: sdkFrameSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/) })).max(32), attribution: attributionSchema, source: sourceDocumentSchema.optional(), assets: z.array(scientificAssetSchema).max(16) });
export type ArtifactExperimentBundle = z.infer<typeof bundleSchema>;
export type ArtifactExperimentBundleResult = { status: 'ready' | 'missing-source' | 'missing-data' | 'incompatible'; artifact?: FigureArtifact; source?: SourceDocument; assets: ScientificAsset[]; input?: unknown; seed?: number; records: ArtifactCacheRecord[]; original: string; reason?: string; replay?: { frame: SdkFrame; seed: number; inputSha256: string; artifactSha256: string }; missingAssetIds?: string[] };
/** A distinct artifact format. No provider jobs, capability tokens or compilation receipts. */
export async function createArtifactExperimentBundle(options: { source: SourceDocument; artifact: unknown; input?: unknown; seed?: number; assets?: readonly ScientificAsset[]; records?: readonly ArtifactCacheRecord[]; includeSource?: boolean; includeAssets?: boolean; includeResults?: boolean; attribution?: z.infer<typeof attributionSchema> }): Promise<string> {
  const source = validateDocument(options.source), artifact = validateFigureArtifact(options.artifact, source);
  const input = options.input ?? (artifact.kind === 'generated' ? artifact.initialInput ?? {} : {}); assertBoundedFigureJson(input, 256*1024);
  const references = artifact.kind === 'generated' ? new Set(artifact.assetIds) : null;
  const assets = options.includeAssets ? await Promise.all((options.assets ?? []).filter(asset => !references || references.has(asset.id)).map(asset => validateScientificAsset(asset, source))) : [];
  const identity = await createArtifactExperimentIdentity({ source, artifact, input, seed: options.seed, assets: options.assets });
  const records = await Promise.all((options.records ?? []).map(record => validateArtifactCacheRecord(record)));
  for (const record of records) if (record.identity.source.fingerprint !== identity.source.fingerprint || record.identity.artifactSha256 !== identity.artifactSha256) throw Error('Only records for this exact artifact/source can be exported.');
  // Execution frames/inputs may themselves contain asset data. Exclude them unless
  // the user explicitly selected data inclusion; source text similarly stays opt-in.
  const includeResults = options.includeResults !== false;
  const portableRecords = records.filter(record => record.kind !== 'plan' && (includeResults || record.kind === 'build') && (record.kind !== 'execution' || !references?.size || options.includeAssets));
  const recordedFrames: Array<{frame: SdkFrame; sha256: string}> = [];
  if (includeResults && !options.includeAssets && references?.size) {
    const currentExecutionKey=await artifactCacheKey('execution',identity);
    for (const record of records) if (record.kind === 'execution' && record.key===await artifactCacheKey('execution',record.identity) && record.key===currentExecutionKey) { const payload = artifactExecutionPayloadSchema.parse(record.payload); const current = payload.entries.find(entry => entry.key === payload.currentKey); if (current) recordedFrames.push({frame:current.frame,sha256:await sha256Text(JSON.stringify(current.frame))}); }
  }
  const omitAssetInput = !options.includeAssets && input && typeof input === 'object' && !Array.isArray(input) && Object.hasOwn(input, 'assets');
  // Keep the original property position: guest Object.keys and the seeded raw
  // payload identity may depend on it. null is a reference placeholder, no data.
  const portableInput = omitAssetInput ? Object.fromEntries(Object.entries(input as Record<string,unknown>).map(([key,value]) => [key,key === 'assets' ? null : value])) : input;
  const inputJson = JSON.stringify(portableInput);
  const bundle = bundleSchema.parse({ format: 'paperplay-artifact-experiment', schemaVersion: 1, contents: 'artifact-and-quoted-excerpts', inclusions: { source: !!options.includeSource, assets: !!options.includeAssets, results: includeResults }, artifact, identity, inputJson, inputJsonSha256: await sha256Text(inputJson), inputBinding: omitAssetInput ? 'assets-omitted' : 'complete', records: portableRecords, recordedFrames:recordedFrames.slice(0,32), attribution: options.attribution ?? { authors: source.authors.join(' · '), notice: 'Artifact quotes and recorded values/state may contain copies of data or source text. Full paper and original asset attachments are optional. Source/data rights remain with their owners; export does not establish redistribution permission.', ...(source.source.url ? { sourceUrl: source.source.url } : {}) }, ...(options.includeSource ? { source } : {}), assets });
  const text = JSON.stringify(bundle, null, 2); if (new TextEncoder().encode(text).length > MAX_ARTIFACT_EXPERIMENT_BUNDLE_BYTES) throw Error('The artifact experiment bundle exceeds 20 MiB.'); return text;
}
export async function parseArtifactExperimentBundle(text: string, options: { sources?: SourceDocument[] } = {}): Promise<ArtifactExperimentBundleResult> {
  const unavailable = (reason: string): ArtifactExperimentBundleResult => ({ status: 'incompatible', original: text, assets: [], records: [], reason });
  if (new TextEncoder().encode(text).length > MAX_ARTIFACT_EXPERIMENT_BUNDLE_BYTES) return unavailable('The bundle exceeds 20 MiB; the original file was not changed.');
  let bundle: ArtifactExperimentBundle;
  try { bundle = bundleSchema.parse(JSON.parse(text)); } catch { return unavailable('The artifact experiment is damaged or uses an unknown format/version. Keep or export its original file.'); }
  try {
    if (bundle.inclusions.source !== !!bundle.source || !bundle.inclusions.assets && bundle.assets.length) throw Error('Bundle content differs from the explicit inclusion choices.');
    if (!artifactIdentityCompatible(bundle.identity)) throw Error('The artifact SDK/compiler/runtime/quality versions are incompatible. The original remains available.');
    const input: unknown = JSON.parse(bundle.inputJson); assertBoundedFigureJson(input, 256*1024);
    if (await sha256Text(bundle.inputJson) !== bundle.inputJsonSha256 || bundle.inputBinding === 'complete' && bundle.inputJsonSha256 !== bundle.identity.inputSha256 || await sha256Text(JSON.stringify(bundle.artifact)) !== bundle.identity.artifactSha256) throw Error('Artifact or raw serialized input digest differs.');
    if (bundle.inputBinding === 'assets-omitted' && (bundle.inclusions.assets || bundle.artifact.kind !== 'generated' || !bundle.artifact.assetBindings.length)) throw Error('Omitted asset input has no matching asset references.');
    if (bundle.artifact.source.documentId !== bundle.identity.source.documentId || bundle.artifact.source.sourceVersion !== bundle.identity.source.sourceVersion) throw Error('Artifact/source identity differs.');
    const source = bundle.source ?? options.sources?.find(item => item.id === bundle.identity.source.documentId && item.sourceVersion === bundle.identity.source.sourceVersion);
    const records = await Promise.all(bundle.records.map(record => validateArtifactCacheRecord(record)));
    for (const record of records) if (record.identity.artifactSha256 !== bundle.identity.artifactSha256 || record.identity.source.fingerprint !== bundle.identity.source.fingerprint) throw Error('A bundled cache record belongs to another artifact/source.');
    if (!source) return { status: 'missing-source', original: text, artifact: bundle.artifact, assets: [], input, seed: bundle.identity.seed, records: [], reason: 'The exact source is absent. The artifact stays inert; import or select that source before execution.' };
    const checkedSource = validateDocument(source), artifact = validateFigureArtifact(bundle.artifact, checkedSource);
    const expected = await createArtifactExperimentIdentity({ source: checkedSource, artifact, input, seed: bundle.identity.seed, assets: bundle.assets });
    if (JSON.stringify({ ...expected, qualityPolicy: bundle.identity.qualityPolicy, ...(bundle.inputBinding === 'assets-omitted' ? { inputSha256: bundle.identity.inputSha256 } : {}) }) !== JSON.stringify(bundle.identity)) throw Error('The source fingerprint or installed dependency identities differ.');
    const assets = await Promise.all(bundle.assets.map(asset => validateScientificAsset(asset, checkedSource)));
    if (new Set(assets.map(asset => asset.id)).size !== assets.length) throw Error('Duplicate bundled asset.');
    if (artifact.kind === 'generated' && assets.some(asset => !artifact.assetBindings.some(binding => binding.id === asset.id && binding.kind === asset.kind && binding.sha256 === asset.checksum.value))) throw Error('Bundled data does not match the declared asset bindings.');
    if (!bundle.inclusions.assets && input && typeof input === 'object' && Object.hasOwn(input, 'assets') && !(bundle.inputBinding === 'assets-omitted' && (input as Record<string,unknown>).assets === null)) throw Error('Bound asset input was included without explicit asset inclusion.');
    if (!bundle.inclusions.results && (bundle.recordedFrames.length || records.some(record => record.kind === 'execution' || record.kind === 'report'))) throw Error('Recorded results were included without explicit selection.');
    let replay: ArtifactExperimentBundleResult['replay'];
    if (artifact.kind === 'generated') for (const recorded of bundle.recordedFrames) { if (await sha256Text(JSON.stringify(recorded.frame)) !== recorded.sha256) throw Error('Recorded frame digest differs.'); validateArtifactInterface(recorded.frame.state, artifact.interfaces.state, artifact.resources.maxStateBytes); const frame = validateSdkFrame(recorded.frame, artifact.resources, artifact.anchors.map(anchor => anchor.id), artifact.capabilityRequests); replay = { frame, seed:bundle.identity.seed,inputSha256:bundle.identity.inputSha256,artifactSha256:bundle.identity.artifactSha256 }; }
    const missingAssetIds = artifact.kind === 'generated' ? artifact.assetIds.filter(id => !assets.some(asset => asset.id === id)) : [];
    return { status: bundle.inputBinding === 'assets-omitted' || missingAssetIds.length ? 'missing-data' : 'ready', original: text, artifact, source: checkedSource, assets, input, seed: bundle.identity.seed, records, ...(replay?{replay}:{}), ...(missingAssetIds.length ? {missingAssetIds,reason:'Exact bound assets are absent. Recorded output is read-only and unverified; it cannot authorize execution or become an active cache result.'}: {}) };
  } catch (cause) { return unavailable(cause instanceof Error ? cause.message : 'The bundle failed integrity checks. Original data was retained.'); }
}
