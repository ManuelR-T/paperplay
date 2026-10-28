import {z} from 'zod';
import {validateDocument,validateSnapshot,validateFigure,type SourceDocument} from '../../shared/schema';
import {validateReadingState} from '../reading-state';
import {validateWidgetEnvelope} from '../../shared/widgets';
import {engineRegistry} from '../engines';
import {preparedPapers} from '../../data/papers';
import {parseExperimentBundle} from '../snapshots';
import {validateWorkspace} from '../experiments/workspace';
import {parseEnrichmentState,enrichmentFingerprint} from '../enrichment/state';
import {parseDataStudy} from '../representations/data-study';
import {parseArtifactExperimentBundle} from '../artifacts/experiment-bundle';
import {parseScientificExperience} from '../experiences/bundle';
import {validateExtractionEvidenceManifest} from '../extraction/model';
import {validateArtifactCacheRecord,artifactIdentityCompatible} from '../../shared/artifact-experiment';
import {validateImportRecord} from '../import-storage';
import {analysisResultSchema} from '../analysis';
export const migrationInputSchema=z.strictObject({id:z.string().min(1).max(100),kind:z.enum(['source','import-record','reading-state','widget','snapshot','experiment-bundle','workspace','enrichment','data-study','artifact-bundle','artifact-cache','extraction','scientific-experience']),serialized:z.string().max(20*1024*1024)});
export type AdoptionMigrationInput=z.infer<typeof migrationInputSchema>;
export type AdoptionInspection={id:string;kind:AdoptionMigrationInput['kind'];disposition:'compatible'|'read-only'|'requires-recompile'|'incompatible';reason:string;original:string;invalidations:('build'|'execution'|'report')[]};
/** Read-only validation. No worker, provider, database or storage mutation is invoked. */
export async function inspectAdoptionRecord(input:AdoptionMigrationInput,options:{source?:SourceDocument}={}):Promise<AdoptionInspection>{
 const item=migrationInputSchema.parse(input);if(new TextEncoder().encode(item.serialized).length>20*1024*1024)throw Error('Migration entry exceeds 20 MiB.');
 const result=(disposition:AdoptionInspection['disposition'],reason:string,invalidations:AdoptionInspection['invalidations']=[]):AdoptionInspection=>({id:item.id,kind:item.kind,disposition,reason,original:item.serialized,invalidations});
 try{
  const value=JSON.parse(item.serialized),source=options.source?validateDocument(options.source):undefined;
  switch(item.kind){
   case 'source':validateDocument(value);break;
   case 'import-record':{
    // The legacy full validator runs engines; inspect its metadata without analysis instead.
    validateImportRecord({...value,analysis:undefined,stage:value.stage==='complete'?'ready':value.stage});
    if(value.stage==='complete'&&!value.analysis)throw Error('Missing accepted analysis.');
    if(value.analysis){const analysis=analysisResultSchema.parse(value.analysis),owner=validateDocument(value.source);if(JSON.stringify({...analysis.document,anchors:[]})!==JSON.stringify({...owner,anchors:[]}))throw Error('Different analysis source.');for(const entry of analysis.figures)validateFigure(entry.figure,analysis.document,engineRegistry);return result('read-only','Saved analysis is historical. Source and notes remain available; full source-grounding/runtime checks are deferred to explicit reopening.');}break;
   }
   case 'snapshot':{const owner=source??preparedPapers.find(p=>p.document.id===value.documentId&&p.document.sourceVersion===value.sourceVersion)?.document;if(!owner)return result('read-only','The exact source is missing. Retain the snapshot and reopen with its source.');validateSnapshot(value,owner,engineRegistry);break;}
   case 'experiment-bundle':{const parsed=await parseExperimentBundle(item.serialized,{sources:source?[source]:[]});if(parsed.missingSource)return result('read-only','The exact source is missing; the bundle original is retained.');break;}
   case 'reading-state':if(!source)return result('read-only','Supply the exact source to check saved reading position and notes.');validateReadingState(value,source);break;
   case 'widget':if(!source)return result('read-only','Supply the exact source to check the saved declarative widget.');validateWidgetEnvelope(value,source);break;
   case 'workspace':if(!source)return result('read-only','Supply the exact source to check saved widget bindings.');validateWorkspace(value,source);break;
   case 'enrichment':if(!source)return result('read-only','Supply the exact source to check saved plans and pending references.');parseEnrichmentState(item.serialized,source,await enrichmentFingerprint(source));break;
   case 'data-study':await parseDataStudy(item.serialized);break;
   case 'artifact-bundle':{const parsed=await parseArtifactExperimentBundle(item.serialized,{sources:source?[source]:[]});if(parsed.status==='incompatible')return result('incompatible',parsed.reason??'Unsupported artifact version; retain original.');if(parsed.status!=='ready')return result('read-only',parsed.reason??'Exact source/assets are missing; retain inert recorded replay.');if(parsed.artifact?.kind==='generated')return result('requires-recompile','Generated source needs a fresh local compilation and explicit Run under the current policy. Recorded frames remain historical.', ['build']);break;}
   case 'artifact-cache':{const record=await validateArtifactCacheRecord(value);if(!artifactIdentityCompatible(record.identity,record.kind))return result('read-only','Cache versions differ. Retain original accepted source and recorded output; recompute only on explicit action.',record.kind==='report'?['report']:['build','execution','report']);if(record.kind==='build')return result('requires-recompile','Persisted build metadata cannot restore a private compiler receipt.',['build']);if(record.kind==='report')return result('read-only','Cached report is history, not a new verification.');break;}
   case 'extraction':await validateExtractionEvidenceManifest(value,source);break;
   case 'scientific-experience':{const parsed=await parseScientificExperience(item.serialized,{sources:source?[source]:[]});if(parsed.status!=='ready')return result(parsed.status==='incompatible'?'incompatible':'read-only',parsed.issues.join(' ').slice(0,1000)||'Some exact sources/assets or versions are unavailable.');return result('read-only','Portable reports and captures are historical. Opening an interaction requires its normal current host gates.');}
  }
  return result('compatible','The existing validator accepts this record. This inspection performs no execution and grants no scientific verification.');
 }catch{return result('incompatible','Unsupported, corrupt or differently bound record. Original bytes are retained; export them or reopen with a compatible version.');}
}
