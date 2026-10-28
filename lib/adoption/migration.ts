import {z} from 'zod';
import {adoptionMigrationReportSchema} from '../../shared/adoption';
import type {SourceDocument} from '../../shared/schema';
import {inspectAdoptionRecord,migrationInputSchema,type AdoptionMigrationInput} from './compatibility';
import {sha256Text} from '../artifacts/sdk-source';
import {canonicalArtifactJson} from '../../shared/figure-compilation';
const cacheVersionSchema=z.strictObject({source:z.string(),artifact:z.string(),sdk:z.string(),compiler:z.string(),runtime:z.string(),dependencies:z.string(),assets:z.string(),input:z.string(),seed:z.string(),randomPolicy:z.string(),qualityPolicy:z.string()});
export type AdoptionCacheVersions=z.infer<typeof cacheVersionSchema>;
/** Content changes invalidate only affected derived caches; accepted originals are never deletion candidates. */
export function adoptionCacheInvalidations(before:AdoptionCacheVersions,after:AdoptionCacheVersions){const a=cacheVersionSchema.parse(before),b=cacheVersionSchema.parse(after);const changed=(keys:(keyof AdoptionCacheVersions)[])=>keys.some(k=>a[k]!==b[k]);
 if(changed(['source','artifact','sdk','compiler','dependencies']))return ['build','execution','report'] as const;
 if(changed(['runtime','assets','input','seed','randomPolicy']))return ['execution','report'] as const;
 if(changed(['qualityPolicy']))return ['report'] as const;return [] as const;
}
/** Bounded dry-run, intentionally has no persistence interface. Callers keep/export their original records. */
export async function runAdoptionMigration(inputs:readonly AdoptionMigrationInput[],options:{source?:SourceDocument;fromVersion:string;toVersion?:string}):Promise<AdoptionMigrationReport>{
 z.array(migrationInputSchema).max(32).parse(inputs);if(new Set(inputs.map(x=>x.id)).size!==inputs.length)throw Error('Duplicate migration fixture IDs.');
 if(inputs.reduce((n,x)=>n+new TextEncoder().encode(x.serialized).length,0)>40*1024*1024)throw Error('Migration batch exceeds 40 MiB.');
 const from=z.string().min(1).max(100).parse(options.fromVersion),to=z.string().min(1).max(100).parse(options.toVersion??'1.1.0');
 const records=[];for(const input of inputs){const checked=await inspectAdoptionRecord(input,options),{original,...entry}=checked;records.push({...entry,sha256:await sha256Text(original),bytes:new TextEncoder().encode(original).length});}
 const body={format:'paperplay-adoption-migration' as const,schemaVersion:1 as const,mode:'dry-run' as const,fromVersion:from,toVersion:to,stages:['inventory','validate-exact-versions','plan-cache-invalidation','retain-originals'] as const,storageWrites:0 as const,executionCount:0 as const,records,rollback:{automaticRewrites:false as const,originalsRetained:true as const,instruction:'Keep original exports and the prior application. Reopen them with a compatible version; do not delete unknown/newer stores or overwrite original accepted records.'},limitations:['No storage migration, execution, human study or release approval is performed.','Private compiler receipts never survive reload. Imported reports remain historical and must not gain verified labels.','A prior application may not read newer formats; retain its original export separately.']};
 return adoptionMigrationReportSchema.parse({...body,reportSha256:await sha256Text(canonicalArtifactJson(body))});
}
export type AdoptionMigrationReport={format:'paperplay-adoption-migration';schemaVersion:1;mode:'dry-run';fromVersion:string;toVersion:string;stages:readonly string[];storageWrites:0;executionCount:0;records:Array<Omit<Awaited<ReturnType<typeof inspectAdoptionRecord>>,'original'>&{sha256:string;bytes:number}>;rollback:{automaticRewrites:false;originalsRetained:true;instruction:string};limitations:string[];reportSha256:string};

/** Imported reports are data-only records, never policy or execution authority. */
export async function validateAdoptionMigrationReport(input:unknown){const report=adoptionMigrationReportSchema.parse(input),{reportSha256,...body}=report;if(await sha256Text(canonicalArtifactJson(body))!==reportSha256)throw Error('Migration report checksum mismatch.');if(new Set(report.records.map(x=>x.id)).size!==report.records.length)throw Error('Duplicate fixture IDs.');return report;}
