import type { SourceDocument } from '../../shared/schema';
import { validateFigureArtifact,type FigureArtifact,type GeneratedArtifact } from '../../shared/figure-artifacts';
import { sdkEventSchema,validateSdkFrame,type SdkEvent,type SdkFrame } from '../../shared/figure-sdk';
import type { ScientificAsset } from '../../shared/scientific-assets';
import { buildRepresentation,executeRepresentation,type RepresentationRun,type RepresentationArtifact } from '../representations/lifecycle';
import { hasCheckedAssetIntegrity } from '../assets/local';
import { FIGURE_SDK_SOURCE,sha256Text } from './sdk-source';
type Failure={status:'invalid'|'disabled'|'cancelled'|'failed';reason:string;original:unknown};
export type BuiltFigureArtifact={format:'paperplay-built-figure';schemaVersion:1;manifest:FigureArtifact;contentSha256:string;trust:'untrusted-source'|'approved-declarative';evidence:'unverified';declarative?:RepresentationArtifact;assets?:readonly ScientificAsset[]};
export type FigureBuildResult={status:'ready';value:BuiltFigureArtifact}|Failure;
export type FigureExecutionAdapter={id:string;execute:(artifact:GeneratedArtifact,input:unknown,state:unknown,event:SdkEvent,signal?:AbortSignal)=>Promise<SdkFrame>};
/** Executable adapters are trusted application arguments, never fields read from a manifest. */
export async function buildFigureArtifact(input:unknown,source:SourceDocument,options:{assets?:readonly ScientificAsset[];signal?:AbortSignal}={}):Promise<FigureBuildResult>{
 try{if(options.signal?.aborted)return {status:'cancelled',reason:'Artifact build cancelled.',original:input};const manifest=validateFigureArtifact(input,source);
   let declarative:RepresentationArtifact|undefined;
   if(manifest.kind==='declarative'){const built=buildRepresentation(manifest.representation,source,{assets:options.assets});if(built.status!=='ready')throw Error(built.reason);declarative=built.value;}
   else{for(const ref of manifest.assetBindings){const asset=options.assets?.find(a=>a.id===ref.id);if(!asset||!hasCheckedAssetIntegrity(asset)||asset.kind!==ref.kind||asset.checksum.value!==ref.sha256)throw Error('Generated artifact needs its exact checked data assets.');const origin=asset.provenance.source;if(origin&&(origin.documentId!==source.id||origin.sourceVersion!==source.sourceVersion))throw Error('Generated data belongs to another source version.');}if(await sha256Text(manifest.entry.source)!==manifest.entry.sha256)throw Error('Generated source digest differs.');const lock=manifest.dependencyLock[0];if(lock.sha256!==await sha256Text(FIGURE_SDK_SOURCE))throw Error('The pinned SDK differs from the installed SDK.');}
   if(options.signal?.aborted)return {status:'cancelled',reason:'Artifact build cancelled.',original:input};
   return {status:'ready',value:{format:'paperplay-built-figure',schemaVersion:1,manifest,contentSha256:await sha256Text(JSON.stringify(manifest)),trust:manifest.kind==='generated'?'untrusted-source':'approved-declarative',evidence:'unverified',...(declarative?{declarative}:{}),...(options.assets?.length?{assets:options.assets}:{})}};
 }catch(error){return {status:'invalid',reason:error instanceof Error?error.message:'Invalid figure artifact.',original:input};}
}
export async function runFigureArtifact(built:BuiltFigureArtifact,source:SourceDocument,options:{input?:unknown;state?:unknown;event?:SdkEvent;signal?:AbortSignal;executionAdapter?:FigureExecutionAdapter}={}):Promise<{status:'ready';value:SdkFrame|RepresentationRun;evidence:'unverified'}|Failure>{
 try{
   if(options.signal?.aborted)return {status:'cancelled',reason:'Figure execution cancelled.',original:built.manifest};
   // Rebuild to detect mutated data, rebind source and retain the same manifest checks at run time.
   const rebound=await buildFigureArtifact(built.manifest,source,{assets:built.assets??built.declarative?.assets,signal:options.signal});if(rebound.status!=='ready')return rebound;if(rebound.value.contentSha256!==built.contentSha256)throw Error('Built artifact content changed.');
   const manifest=rebound.value.manifest;
   if(manifest.kind==='declarative'){const run=await executeRepresentation(rebound.value.declarative!,source,{signal:options.signal});return run.status==='ready'?{status:'ready',value:run.value,evidence:'unverified'}:{status:run.status==='cancelled'?'cancelled':'failed',reason:run.reason,original:manifest};}
   if(!options.executionAdapter)return {status:'disabled',reason:'Generated execution is disabled: no approved isolation adapter is installed in this host.',original:manifest};
   const event=sdkEventSchema.parse(options.event??{kind:'initialize'});validateArtifactInterface(options.input??{},manifest.interfaces.input,manifest.resources.maxInputBytes);if(options.state!==undefined&&options.state!==null)validateArtifactInterface(options.state,manifest.interfaces.state,manifest.resources.maxStateBytes);
   const frame=await options.executionAdapter.execute(manifest,options.input??{},options.state??null,event,options.signal);if(options.signal?.aborted)return {status:'cancelled',reason:'Figure execution cancelled.',original:manifest};
   validateArtifactInterface(frame.state,manifest.interfaces.state,manifest.resources.maxStateBytes);return {status:'ready',value:validateSdkFrame(frame,manifest.resources,manifest.anchors.map(a=>a.id),manifest.capabilityRequests),evidence:'unverified'};
 }catch{return {status:'failed',reason:'Figure execution failed validation or exceeded its policy. The source remains available.',original:built.manifest};}
}
export function validateArtifactInterface(input:unknown,fields:GeneratedArtifact['interfaces']['input'],maxBytes:number){
 if(new TextEncoder().encode(JSON.stringify(input)).length>maxBytes)throw Error('Artifact data exceeds its byte budget.');if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Artifact interface requires an object.');const data=input as Record<string,unknown>;
 if(Object.keys(data).length!==fields.length||Object.keys(data).some(id=>!fields.some(field=>field.id===id)))throw Error('Artifact fields differ from the declared interface.');
 for(const field of fields){const value=data[field.id];if(field.kind==='array'){if(!Array.isArray(value)||value.length>field.maxItems!)throw Error('Artifact array exceeds its declared shape.');}else if(field.kind==='number'){if(typeof value!=='number'||!Number.isFinite(value))throw Error('Artifact scalar must be finite.');}else if(field.kind==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Artifact object differs.');}else if(typeof value!==field.kind)throw Error('Artifact field type differs.');}
}
