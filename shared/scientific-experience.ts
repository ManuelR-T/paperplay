import {z} from 'zod';
import {sourceDocumentSchema,experimentSnapshotSchema,type SourceDocument,type ExperimentSnapshot} from './schema';
import {widgetEnvelopeSchema,type WidgetEnvelope} from './widgets';
import {representationPlanSchema,type RepresentationPlan} from './representations';
import {scientificAssetSchema,type ScientificAsset} from './scientific-assets';
import type {FigureArtifact} from './figure-artifacts';
import type {ArtifactCacheRecord} from './artifact-experiment';
export const SCIENTIFIC_EXPERIENCE_VERSION=1;
export const SCIENTIFIC_EXPERIENCE_LIMITS=Object.freeze({maxBytes:20*1024*1024,maxEntries:32,maxAssets:16,maxReports:16,maxSourceBytes:2*1024*1024,maxCaptureBytes:64*1024});
const id=z.string().min(1).max(100),sha=z.string().regex(/^[a-f0-9]{64}$/),version=z.string().min(1).max(160);
export const experienceAttributionSchema=z.strictObject({authors:z.string().min(1).max(2000),notice:z.string().min(1).max(5000),sourceUrl:z.url().refine(url=>/^https?:/.test(url)).optional(),license:z.string().min(1).max(500).optional(),licenseUrl:z.url().refine(url=>/^https?:/.test(url)).optional()});
export type ExperienceAttribution=z.infer<typeof experienceAttributionSchema>;
export const experienceCaptureSchema=z.strictObject({title:z.string().min(1).max(200),text:z.string().max(60000)});
export type ExperienceCapture=z.infer<typeof experienceCaptureSchema>;
const execution=z.strictObject({id,engineId:id,engineVersion:version,requestSha256:sha,parametersPath:z.string().min(1).max(300),seed:z.string().max(100).nullable(),randomPolicy:version.nullable(),replayClass:z.enum(['deterministic','seeded-stochastic','hardware-dependent'])});
const base={id,definitionSha256:sha,executions:z.array(execution).max(32),capture:experienceCaptureSchema.optional()};
export const scientificExperienceEntrySchema=z.discriminatedUnion('kind',[
 z.strictObject({...base,kind:z.literal('legacy'),snapshot:experimentSnapshotSchema}),
 z.strictObject({...base,kind:z.literal('widget'),widget:widgetEnvelopeSchema}),
 z.strictObject({...base,kind:z.literal('representation'),plan:representationPlanSchema}),
 z.strictObject({...base,kind:z.literal('artifact'),bundleJson:z.string().max(20*1024*1024)}),
]);
export type ScientificExperienceEntry=z.infer<typeof scientificExperienceEntrySchema>;
export const scientificExperienceSchema=z.strictObject({format:z.literal('paperplay-scientific-experience'),schemaVersion:z.literal(1),contents:z.literal('definitions-and-quoted-excerpts'),sourceReference:z.strictObject({documentId:id,sourceVersion:id,fingerprint:sha,title:z.string().min(1).max(1000),authors:z.array(z.string().min(1).max(300)).max(100),url:z.url().refine(url=>/^https?:/.test(url)).nullable()}),attribution:experienceAttributionSchema,inclusions:z.strictObject({source:z.boolean(),assets:z.boolean(),results:z.boolean()}),source:sourceDocumentSchema.optional(),entries:z.array(scientificExperienceEntrySchema).min(1).max(32),assetReferences:z.array(z.strictObject({id,kind:id,checksum:sha.nullable(),availability:z.enum(['included','external','missing'])})).max(16),assets:z.array(scientificAssetSchema).max(16),reports:z.array(z.strictObject({id,kind:z.literal('scientific-validation'),serialized:z.string().max(256*1024),sha256:sha})).max(16),disclosure:z.string().min(1).max(2000),manifestSha256:sha});
export type ScientificExperience=z.infer<typeof scientificExperienceSchema>;
export type ScientificExperienceInputEntry=({id:string;capture?:ExperienceCapture})&(
 {kind:'legacy';snapshot:ExperimentSnapshot}|{kind:'widget';widget:WidgetEnvelope}|{kind:'representation';plan:RepresentationPlan}|{kind:'artifact';artifact:FigureArtifact;input?:unknown;seed?:number;records?:readonly ArtifactCacheRecord[]});
export type CreateScientificExperienceOptions={source:SourceDocument;entries:readonly ScientificExperienceInputEntry[];assets?:readonly ScientificAsset[];includeSource?:boolean;includeAssets?:boolean;includeResults?:boolean;reports?:readonly {id:string;kind:'scientific-validation';serialized:string}[];attribution?:ExperienceAttribution};
