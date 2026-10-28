import {z} from 'zod';
export const ADOPTION_POLICY_VERSION='1.0.0' as const;
export const adoptionPolicySchema=z.strictObject({format:z.literal('paperplay-adoption-policy'),schemaVersion:z.literal(1),policyVersion:z.literal(ADOPTION_POLICY_VERSION),generatedExecution:z.boolean(),newModelCreation:z.boolean(),reason:z.string().max(1000).nullable()});
export type AdoptionPolicy=z.infer<typeof adoptionPolicySchema>;
/** Operator metadata only. Imported policy-shaped JSON never confers execution authority. */
export function readAdoptionPolicy(environment:Record<string,string|undefined>,now=Date.now()):AdoptionPolicy{
 const value=environment.PAPERPLAY_GENERATED_EXECUTION_ENABLED;
 const generatedExecution=value===undefined||value==='true';
 const create=environment.META_ANALYSIS_ENABLED;
 const cutoff=environment.META_CREDITS_EXPIRE_AT;
 const newModelCreation=(create===undefined||create==='true')&&(!cutoff||Number.isFinite(Date.parse(cutoff))&&Date.parse(cutoff)>now);
 return Object.freeze({format:'paperplay-adoption-policy',schemaVersion:1,policyVersion:ADOPTION_POLICY_VERSION,generatedExecution,newModelCreation,reason:!generatedExecution?'Generated compilation and execution are disabled by the operator. Source, notes, exports and recorded replay remain available.':!newModelCreation?'New model creation is disabled. Accepted jobs remain recoverable.':null});
}
export type AdoptionPolicySnapshot=Readonly<{state:'unknown'|'ready'|'unavailable';epoch:number;policy:AdoptionPolicy|null}>;

export const capabilityVersionSchema=z.strictObject({id:z.string().min(1).max(100),version:z.string().regex(/^\d+\.\d+\.\d+$/)});
export type AdoptionCapabilityVersion=z.infer<typeof capabilityVersionSchema>;
export function capabilityVersionGate(requested:AdoptionCapabilityVersion,installed:readonly AdoptionCapabilityVersion[]){
 const target=capabilityVersionSchema.parse(requested),available=z.array(capabilityVersionSchema).max(128).parse(installed);
 const allowed=available.some(item=>item.id===target.id&&item.version===target.version);
 return Object.freeze({allowed,disposition:allowed?'available' as const:'read-only-original' as const,reason:allowed?null:'This exact capability version is unavailable. Retain the original; no nearest-version substitution is allowed.'});
}
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const adoptionMigrationReportSchema=z.strictObject({format:z.literal('paperplay-adoption-migration'),schemaVersion:z.literal(1),mode:z.literal('dry-run'),fromVersion:z.string().min(1).max(100),toVersion:z.string().min(1).max(100),stages:z.tuple([z.literal('inventory'),z.literal('validate-exact-versions'),z.literal('plan-cache-invalidation'),z.literal('retain-originals')]),storageWrites:z.literal(0),executionCount:z.literal(0),records:z.array(z.strictObject({id:z.string().min(1).max(100),kind:z.enum(['source','import-record','reading-state','widget','snapshot','experiment-bundle','workspace','enrichment','data-study','artifact-bundle','artifact-cache','extraction','scientific-experience']),disposition:z.enum(['compatible','read-only','requires-recompile','incompatible']),reason:z.string().max(1000),invalidations:z.array(z.enum(['build','execution','report'])).max(3),sha256:digest,bytes:z.number().int().min(0).max(20*1024*1024)})).max(32),rollback:z.strictObject({automaticRewrites:z.literal(false),originalsRetained:z.literal(true),instruction:z.string().min(1).max(1000)}),limitations:z.array(z.string().max(1000)).max(16),reportSha256:digest});
