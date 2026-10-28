'use client';
import { z } from 'zod';
import { validateFigureArtifact,type GeneratedArtifact } from '../../shared/figure-artifacts';
import { validateSdkFrame,sdkEventSchema,type SdkFrame,type SdkEvent } from '../../shared/figure-sdk';
import { assertBoundedFigureJson,freezeFigureValue } from '../../shared/figure-json';
import { validateArtifactInterface } from '../../shared/figure-interfaces';
import { FIGURE_RUNTIME_VERSION,FIGURE_RANDOM_POLICY,figureSeedSchema,type FigureRuntimeErrorCode } from '../../shared/figure-runtime';
import { FIGURE_QUALITY_POLICY,figureQualityFeedbackSchema,type FigureQualityFeedback } from '../../shared/figure-quality';
import { createArtifactExperimentIdentity,artifactCacheKey,createArtifactCacheRecord,validateArtifactCacheRecord,artifactExperimentOwner,type ArtifactCacheRecord,type ArtifactExperimentIdentity } from '../../shared/artifact-experiment';
import type { SourceDocument } from '../../shared/schema';
import type { ScientificAsset } from '../../shared/scientific-assets';
import type { FigureCompileRequest,FigureCompileResult } from '../../shared/figure-compilation';
import { buildFigureArtifact,runFigureArtifact,type BuiltFigureArtifact,type FigureExecutionAdapter } from './lifecycle';
import { compileFigureInWorker } from './compiler-client';
import { compilerRequestFromBuild } from './compiler-request';
import { createCompiledFigureAdapter,validateFigureEvent } from './runtime-client';
import { figureRuntimeInput } from './runtime-input';
import { FIGURE_SDK_SOURCE,sha256Text } from './sdk-source';
import { createArtifactExperimentStorage,type ArtifactExperimentStorage } from './experiment-storage';
import { createArtifactExperimentBundle } from './experiment-bundle';
export type ExperimentStorage=ArtifactExperimentStorage;
export type ExperimentSessionError=FigureRuntimeErrorCode|'input'|'domain'|'compiler'|'storage'|'cancelled';
export type ExperimentSessionSnapshot={status:'idle'|'opening'|'ready'|'running'|'failed'|'cancelled';frame:SdkFrame|null;input:unknown;seed:number;restored:boolean;canInteract:boolean;identity?:ArtifactExperimentIdentity;report?:FigureQualityFeedback;error?:ExperimentSessionError;recovery?:{code:'invalid'|'incompatible'|'storage';original?:string}};
export type ExperimentSessionSettings={artifact:unknown;source:SourceDocument;assets?:readonly ScientificAsset[];input?:unknown;seed?:number;storage?:ArtifactExperimentStorage;records?:readonly ArtifactCacheRecord[];environment?:string;expectedInputSha256?:string};
type ReadyCompile=Extract<FigureCompileResult,{status:'ready'}>;
export type ExperimentQualityContext={built:BuiltFigureArtifact;input:unknown;seed:number;adapter:FigureExecutionAdapter;frame:SdkFrame|null;signal:AbortSignal};
export type ExperimentQualityChecker=(context:ExperimentQualityContext)=>Promise<FigureQualityFeedback>;
export type ExperimentSessionDependencies={compile?:(request:FigureCompileRequest,options:{signal?:AbortSignal})=>Promise<FigureCompileResult>;build?:typeof buildFigureArtifact;adapter?:(built:BuiltFigureArtifact,compiled:ReadyCompile,seed:number)=>FigureExecutionAdapter;runtimeVersion?:string;qualityPolicyVersion?:string};
const entrySchema=z.strictObject({key:z.string().regex(/^[a-f0-9]{64}$/),inputJson:z.string().max(256*1024),stateJson:z.string().max(64*1024),eventJson:z.string().max(1024),frame:z.unknown()});
const payloadSchema=z.strictObject({inputJson:z.string().max(256*1024),entries:z.array(entrySchema).max(32),currentKey:z.string().regex(/^[a-f0-9]{64}$/).nullable()});
type Entry=Omit<z.infer<typeof entrySchema>,'frame'>&{frame:SdkFrame};
type Payload={inputJson:string;entries:Entry[];currentKey:string|null};
type Admission={built:BuiltFigureArtifact;compiled:ReadyCompile};
type Pending={controller:AbortController;promise:Promise<Admission>;waiters:number;value?:Admission};
const defaults:ExperimentSessionDependencies={},admissions=new WeakMap<ExperimentSessionDependencies,Map<string,Pending>>();
const defaultStorage=createArtifactExperimentStorage();
class SessionFailure extends Error{constructor(readonly code:ExperimentSessionError){super(code);}}
function clone<T>(value:T,maxBytes=256*1024):T{assertBoundedFigureJson(value,maxBytes);return JSON.parse(JSON.stringify(value)) as T;}
function raceAbort<T>(promise:Promise<T>,signal:AbortSignal){return new Promise<T>((resolve,reject)=>{const stop=()=>{cleanup();reject(new SessionFailure('cancelled'));};const cleanup=()=>signal.removeEventListener('abort',stop);signal.addEventListener('abort',stop,{once:true});if(signal.aborted){stop();return;}promise.then(value=>{cleanup();signal.aborted?reject(new SessionFailure('cancelled')):resolve(value);},error=>{cleanup();reject(error);});});}
/** Creates no provider jobs. Persisted JSON is display evidence, never compiler authority. */
export function createExperimentSession(settings:ExperimentSessionSettings,deps:ExperimentSessionDependencies=defaults){
 const storage=settings.storage??defaultStorage,listeners=new Set<()=>void>(),records=new Map<string,ArtifactCacheRecord>();
 let snapshot:ExperimentSessionSnapshot={status:'idle',frame:null,input:settings.input??{},seed:settings.seed??42,restored:false,canInteract:false};
 let manifest:GeneratedArtifact|undefined,source:SourceDocument=JSON.parse(JSON.stringify(settings.source)),input:unknown=settings.input,seed=settings.seed??42,identity:ArtifactExperimentIdentity|undefined;
 let payload:Payload={inputJson:'{}',entries:[],currentKey:null},adapter:FigureExecutionAdapter|undefined,admission:Admission|undefined,controller:AbortController|undefined,disposed=false;
 let inputExplicit=settings.input!==undefined,seedExplicit=settings.seed!==undefined,verifyImportedInput=!!settings.expectedInputSha256;let environment=settings.environment??'sdk-json-only';
 const emit=(patch:Partial<ExperimentSessionSnapshot>)=>{if(disposed)return;snapshot=Object.freeze({...snapshot,...patch});listeners.forEach(listener=>listener());return snapshot;};
 const alive=(job:AbortController)=>{if(disposed||controller!==job||job.signal.aborted)throw new SessionFailure('cancelled');};
 function jobStart(signal?:AbortSignal){if(controller)controller.abort();const job=new AbortController();controller=job;const cancel=()=>job.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();return {job,end:()=>{signal?.removeEventListener('abort',cancel);if(controller===job)controller=undefined;}};}
 function fail(error:unknown,job:AbortController){if(controller!==job||disposed)return snapshot;const code=error instanceof SessionFailure?error.code:job.signal.aborted?'cancelled':'unavailable';return emit({status:code==='cancelled'?'cancelled':'failed',error:code,canInteract:!!adapter})!;}
 function effectiveInput(value:unknown,activeManifest=manifest){
  if(!activeManifest)throw new SessionFailure('integrity');
  const supplied=clone(value??activeManifest.initialInput??{},activeManifest.resources.maxInputBytes);
  if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))throw new SessionFailure('input');
  const temp:BuiltFigureArtifact={format:'paperplay-built-figure',schemaVersion:1,manifest:{...activeManifest,initialInput:supplied},contentSha256:'',trust:'untrusted-source',evidence:'unverified',assets:settings.assets};
  try{
   for(const binding of activeManifest.assetBindings){const asset=settings.assets?.find(a=>a.id===binding.id),origin=asset?.provenance.source;
    if(!asset||asset.kind!==binding.kind||origin&&(origin.documentId!==source.id||origin.sourceVersion!==source.sourceVersion))throw new SessionFailure('integrity');
   }
   const result=figureRuntimeInput(temp);validateArtifactInterface(result,activeManifest.interfaces.input,activeManifest.resources.maxInputBytes);
   return freezeFigureValue(clone(result,activeManifest.resources.maxInputBytes));
  }catch(error){if(error instanceof SessionFailure)throw error;throw new SessionFailure('input');}
 }
 async function transitionKey(inputJson:string,stateJson:string,eventJson:string,id=identity!){return sha256Text(JSON.stringify({artifact:id.artifactSha256,source:id.source,runtime:id.runtime,randomPolicy:FIGURE_RANDOM_POLICY,seed:id.seed,inputJson,stateJson,eventJson}));}
 async function compatible(record:ArtifactCacheRecord,kind:ArtifactCacheRecord['kind'],id=identity!){return record.kind===kind&&record.key===await artifactCacheKey(kind,id)&&record.key===await artifactCacheKey(kind,record.identity);}
 async function validatePayload(record:ArtifactCacheRecord,id:ArtifactExperimentIdentity,activeManifest=manifest):Promise<Payload>{
  await validateArtifactCacheRecord(record);if(!await compatible(record,'execution',id))throw new SessionFailure('integrity');
  const parsed=payloadSchema.parse(record.payload);const supplied=effectiveInput(JSON.parse(parsed.inputJson),activeManifest);
  if(JSON.stringify(supplied)!==parsed.inputJson||await sha256Text(parsed.inputJson)!==id.inputSha256)throw new SessionFailure('integrity');
  const entries:Entry[]=[];
  for(const item of parsed.entries){
   if(item.inputJson!==parsed.inputJson||item.key!==await transitionKey(item.inputJson,item.stateJson,item.eventJson,id)||entries.some(e=>e.key===item.key))throw new SessionFailure('integrity');
   const state=JSON.parse(item.stateJson),event=sdkEventSchema.parse(JSON.parse(item.eventJson));
   if(JSON.stringify(event)!==item.eventJson||JSON.stringify(state)!==item.stateJson)throw new SessionFailure('integrity');
   if(state!==null)validateArtifactInterface(state,activeManifest!.interfaces.state,activeManifest!.resources.maxStateBytes);
   const frame=validateSdkFrame(item.frame,activeManifest!.resources,activeManifest!.anchors.map(a=>a.id),activeManifest!.capabilityRequests);validateArtifactInterface(frame.state,activeManifest!.interfaces.state,activeManifest!.resources.maxStateBytes);
   entries.push({...item,frame:freezeFigureValue(frame)});
  }
  if(parsed.currentKey!==null&&!entries.some(e=>e.key===parsed.currentKey))throw new SessionFailure('integrity');
  return {inputJson:parsed.inputJson,entries,currentKey:parsed.currentKey};
 }
 async function remember(record:ArtifactCacheRecord,job:AbortController){alive(job);records.set(record.key,record);try{await storage.put(record,artifactExperimentOwner(record.identity));}catch{alive(job);emit({recovery:{code:'storage'}});}alive(job);}
 async function saveExecution(job:AbortController){
  while(true){try{const record=await createArtifactCacheRecord('execution',identity!,payload);await remember(record,job);return;}catch(error){alive(job);if(error instanceof SessionFailure)throw error;if(payload.entries.length<=1){emit({recovery:{code:'storage'}});return;}payload={...payload,entries:payload.entries.slice(1)};}}
 }
 async function getRecord(key:string,job:AbortController){const supplied=records.get(key);if(supplied)return supplied;try{const record=await raceAbort(storage.get(key),job.signal);alive(job);return record;}catch(error){if(job.signal.aborted)throw error;let original:string|undefined;try{original=await raceAbort(storage.exportOriginal(key),job.signal);}catch{if(job.signal.aborted)throw new SessionFailure('cancelled');}alive(job);emit({recovery:original===undefined?{code:'storage'}:{code:'incompatible',original}});return undefined;}}
 async function open(options:{signal?:AbortSignal}={}){
  const {job,end}=jobStart(options.signal);emit({status:'opening',error:undefined,canInteract:false});adapter=undefined;admission=undefined;
  // Keep async restoration local. A stopped open may finish hashing after a newer
  // configure/open job, and must not overwrite that job's private execution state.
  const openingInput=input,openingSeed=seed,explicitInput=inputExplicit,explicitSeed=seedExplicit,checkImportedInput=verifyImportedInput;
  try{
   const parsed=validateFigureArtifact(clone(settings.artifact,512*1024),source);if(parsed.kind!=='generated')throw new SessionFailure('integrity');
   const openedManifest=freezeFigureValue(parsed);alive(job);manifest=openedManifest;
   const entrySha=await sha256Text(openedManifest.entry.source),sdkSha=await sha256Text(FIGURE_SDK_SOURCE);alive(job);
   if(entrySha!==openedManifest.entry.sha256||openedManifest.dependencyLock[0].sha256!==sdkSha)throw new SessionFailure('integrity');
   let openedInput=effectiveInput(openingInput,openedManifest);let openedSeed=figureSeedSchema.parse(openingSeed);
   if(checkImportedInput){const inputSha=await sha256Text(JSON.stringify(openedInput));alive(job);if(inputSha!==settings.expectedInputSha256)throw new SessionFailure('integrity');}
   let openedIdentity=freezeFigureValue(await createArtifactExperimentIdentity({artifact:openedManifest,source,assets:settings.assets,input:openedInput,seed:openedSeed,runtimeVersion:deps.runtimeVersion??FIGURE_RUNTIME_VERSION,qualityPolicyVersion:deps.qualityPolicyVersion??FIGURE_QUALITY_POLICY.version}));alive(job);
   for(const supplied of settings.records??[]){try{const valid=await validateArtifactCacheRecord(supplied);alive(job);records.set(valid.key,valid);}catch{alive(job);emit({recovery:{code:'invalid',original:JSON.stringify(supplied)}});}}
   if(!explicitInput||!explicitSeed){
    let candidates:ArtifactCacheRecord[]=[];try{candidates=await raceAbort(storage.list(artifactExperimentOwner(openedIdentity)),job.signal);alive(job);}catch{alive(job);emit({recovery:{code:'storage'}});}
    candidates=[...records.values(),...candidates];
    for(const candidate of candidates){try{
     await validateArtifactCacheRecord(candidate);alive(job);if(candidate.kind!=='execution')continue;
     const proposedInput=explicitInput?openedInput:effectiveInput(JSON.parse(payloadSchema.parse(candidate.payload).inputJson),openedManifest),proposedSeed=explicitSeed?openedSeed:candidate.identity.seed;
     const proposed=await createArtifactExperimentIdentity({source,artifact:openedManifest,assets:settings.assets,input:proposedInput,seed:proposedSeed,runtimeVersion:deps.runtimeVersion??FIGURE_RUNTIME_VERSION,qualityPolicyVersion:deps.qualityPolicyVersion??FIGURE_QUALITY_POLICY.version});alive(job);
     const matches=await compatible(candidate,'execution',proposed);alive(job);if(!matches)continue;
     await validatePayload(candidate,proposed,openedManifest);alive(job);openedInput=proposedInput;openedSeed=proposedSeed;openedIdentity=freezeFigureValue(proposed);break;
    }catch{alive(job);/* Incompatible originals remain stored; cancellation propagates. */}}
   }
   const record=await getRecord(await artifactCacheKey('execution',openedIdentity),job);alive(job);let frame:SdkFrame|null=null;
   let openedPayload:Payload={inputJson:JSON.stringify(openedInput),entries:[],currentKey:null};
   if(record){try{const restored=await validatePayload(record,openedIdentity,openedManifest);alive(job);openedPayload=restored;frame=restored.entries.find(e=>e.key===restored.currentKey)?.frame??null;records.set(record.key,record);}catch{alive(job);const original=await raceAbort(storage.exportOriginal(record.key),job.signal).catch(()=>undefined);alive(job);emit({recovery:{code:'incompatible',original:original??JSON.stringify(record)}});}}
   let report:FigureQualityFeedback|undefined;
   const reportKey=await artifactCacheKey('report',openedIdentity,{environment,executionKey:openedPayload.currentKey});alive(job);
   const savedReport=await getRecord(reportKey,job);alive(job);
   if(savedReport){try{await validateArtifactCacheRecord(savedReport);alive(job);const data=z.strictObject({report:figureQualityFeedbackSchema,environment:z.string(),policyVersion:z.string(),executionKey:z.string().nullable()}).parse(savedReport.payload);
    const expectedKey=await artifactCacheKey('report',savedReport.identity,{environment,executionKey:openedPayload.currentKey});alive(job);
    if(savedReport.kind==='report'&&savedReport.key===expectedKey&&data.environment===environment&&data.policyVersion===openedIdentity.qualityPolicy&&data.executionKey===openedPayload.currentKey){report=freezeFigureValue(data.report);records.set(savedReport.key,savedReport);}
   }catch{alive(job);emit({recovery:{code:'incompatible',original:JSON.stringify(savedReport)}});}}
   alive(job);input=openedInput;seed=openedSeed;identity=openedIdentity;payload=openedPayload;
   emit({status:'ready',frame,input,seed,identity,restored:!!frame,canInteract:false,error:undefined,report});return snapshot;
  }catch(error){return fail(error,job);}finally{end();}
 }

 async function admitted(job:AbortController){
  if(admission&&adapter)return admission;
  if(!manifest||!identity)throw new SessionFailure('integrity');
  const key=await artifactCacheKey('build',identity);let cache=admissions.get(deps);if(!cache){cache=new Map();admissions.set(deps,cache);}let pending=cache.get(key);
  if(!pending||pending.controller.signal.aborted){
   const compileController=new AbortController();const entry:Pending={controller:compileController,waiters:0,promise:Promise.resolve(undefined as never)};cache.set(key,entry);
   entry.promise=(async()=>{const built=await(deps.build??buildFigureArtifact)(manifest,source,{assets:settings.assets,signal:compileController.signal});if(built.status!=='ready')throw new SessionFailure(compileController.signal.aborted?'cancelled':'integrity');
    const compiled=await(deps.compile??compileFigureInWorker)(compilerRequestFromBuild(built.value),{signal:compileController.signal});if(compiled.status!=='ready')throw new SessionFailure(compileController.signal.aborted?'cancelled':compiled.diagnostics.every(d=>['syntax','entry','unsupported-syntax','dependency','complexity'].includes(d.code))?'compiler':'unavailable');
    if(compileController.signal.aborted)throw new SessionFailure('cancelled');return {built:built.value,compiled};})();
   entry.promise.then(value=>{if(!compileController.signal.aborted)entry.value=value;},()=>{if(cache!.get(key)===entry)cache!.delete(key);});pending=entry;
   while(cache.size>16){const oldest=cache.keys().next().value;if(oldest===undefined||oldest===key)break;cache.delete(oldest);}
  }
  pending.waiters++;
  try{const value=await raceAbort(pending.value?Promise.resolve(pending.value):pending.promise,job.signal);alive(job);
   adapter=deps.adapter?.(value.built,value.compiled,seed)??createCompiledFigureAdapter(value.built,value.compiled.artifact,value.compiled.sha256,{seed});admission=value;
   await remember(await createArtifactCacheRecord('build',identity,{status:'admitted',compilerVersion:identity.compiler,artifactSha256:identity.artifactSha256}),job);
   return value;
  }finally{pending.waiters--;if(!pending.value&&pending.waiters===0){pending.controller.abort();if(cache.get(key)===pending)cache.delete(key);}}
 }
 async function resume(options:{signal?:AbortSignal}={}){
  if(!identity){await open(options);if(!identity)return snapshot;}
  const {job,end}=jobStart(options.signal);emit({status:'running',error:undefined});try{await admitted(job);alive(job);emit({status:'ready',canInteract:true});return snapshot;}catch(error){return fail(error,job);}finally{end();}
 }
 async function step(rawEvent:SdkEvent,options:{signal?:AbortSignal}={}){
  if(!identity){await open(options);if(!identity)return snapshot;}
  const {job,end}=jobStart(options.signal);emit({status:'running',error:undefined});
  try{
   const event=sdkEventSchema.parse(rawEvent),frame=snapshot.frame;
   if(event.kind!=='initialize'){if(!frame)throw new SessionFailure('domain');try{validateFigureEvent(frame,event);}catch{throw new SessionFailure('domain');}}
   const state=event.kind==='initialize'?null:frame!.state,stateJson=JSON.stringify(state),eventJson=JSON.stringify(event),inputJson=JSON.stringify(input),key=await transitionKey(inputJson,stateJson,eventJson);alive(job);
   let entry=payload.entries.find(e=>e.key===key);const reused=!!entry;
   if(!entry){const value=await admitted(job);const run=await raceAbort(runFigureArtifact(value.built,source,{input,state,event,executionAdapter:adapter,signal:job.signal}),job.signal);alive(job);
    if(run.status!=='ready'||!('marks'in run.value))throw new SessionFailure(run.status==='ready'?'invalid-output':run.code??(run.status==='cancelled'?'cancelled':'unavailable'));
    entry={key,inputJson,stateJson,eventJson,frame:run.value};payload={inputJson,entries:[...payload.entries,entry].slice(-32),currentKey:key};
   }else payload={...payload,currentKey:key};
   await saveExecution(job);alive(job);emit({status:'ready',frame:entry.frame,identity,input,seed,restored:reused,canInteract:!!adapter,report:undefined,error:undefined});return snapshot;
  }catch(error){return fail(error,job);}finally{end();}
 }
 async function configure(values:{input?:unknown;seed?:number}){
  stop();const {job,end}=jobStart();try{
   const nextInput=effectiveInput(values.input===undefined?input:values.input),nextSeed=figureSeedSchema.parse(values.seed??seed);
   const nextIdentity=await createArtifactExperimentIdentity({artifact:manifest,source,assets:settings.assets,input:nextInput,seed:nextSeed,runtimeVersion:deps.runtimeVersion??FIGURE_RUNTIME_VERSION,qualityPolicyVersion:deps.qualityPolicyVersion??FIGURE_QUALITY_POLICY.version});alive(job);
   const target=await getRecord(await artifactCacheKey('execution',nextIdentity),job);alive(job);
   let restored:Payload|undefined;
   if(target){try{restored=await validatePayload(target,nextIdentity);}catch{alive(job);emit({recovery:{code:'incompatible',original:JSON.stringify(target)}});}}
   alive(job);input=nextInput;seed=nextSeed;if(values.input!==undefined){inputExplicit=true;verifyImportedInput=false;}if(values.seed!==undefined)seedExplicit=true;
   adapter=undefined;admission=undefined;identity=freezeFigureValue(nextIdentity);payload=restored??{inputJson:JSON.stringify(input),entries:[],currentKey:null};
   const frame=payload.entries.find(entry=>entry.key===payload.currentKey)?.frame??null;
   emit({status:'ready',frame,input,seed,identity,restored:!!frame,canInteract:false,report:undefined,error:undefined});
   if(restored&&target)await remember(target,job);else if(!target)await saveExecution(job);return snapshot;
  }catch(error){return fail(error,job);}finally{end();}
 }
 async function quality(checker:ExperimentQualityChecker,options:{environment:string;signal?:AbortSignal}){
  if(!identity)return snapshot;const {job,end}=jobStart(options.signal);emit({status:'running',error:undefined});
  try{if(!options.environment||options.environment.length>500)throw new SessionFailure('input');
   environment=options.environment;const key=await artifactCacheKey('report',identity,{environment:options.environment,executionKey:payload.currentKey});const cached=await getRecord(key,job);
   if(cached){await validateArtifactCacheRecord(cached);const data=z.strictObject({report:figureQualityFeedbackSchema,environment:z.string(),policyVersion:z.string(),executionKey:z.string().nullable()}).parse(cached.payload);
    if(cached.kind==='report'&&cached.key===key&&await artifactCacheKey('report',cached.identity,{environment:options.environment,executionKey:payload.currentKey})===key&&data.environment===options.environment&&data.policyVersion===identity.qualityPolicy&&data.executionKey===payload.currentKey){alive(job);emit({status:'ready',report:freezeFigureValue(data.report)});return snapshot;}}
   const value=await admitted(job);const report=figureQualityFeedbackSchema.parse(await raceAbort(checker({built:value.built,input,seed,adapter:adapter!,frame:snapshot.frame,signal:job.signal}),job.signal));alive(job);
   if(report.status==='passed'||report.status==='failed')await remember(await createArtifactCacheRecord('report',identity,{report,environment:options.environment,policyVersion:identity.qualityPolicy,executionKey:payload.currentKey},key),job);alive(job);emit({status:'ready',report:freezeFigureValue(report),canInteract:!!adapter});return snapshot;
  }catch(error){return fail(error,job);}finally{end();}
 }
 function stop(){const active=controller;controller=undefined;active?.abort();emit({status:snapshot.frame?'ready':'cancelled',error:undefined,canInteract:!!adapter});}
 async function exportBundle(options:{includeSource?:boolean;includeAssets?:boolean;includeResults?:boolean}={}){return createArtifactExperimentBundle({artifact:manifest??settings.artifact,source,input,seed,assets:settings.assets,records:[...records.values()].filter(record=>record.identity.artifactSha256===identity?.artifactSha256&&record.identity.source.fingerprint===identity.source.fingerprint),...options});}
 return {snapshot:()=>snapshot,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},open,resume,step,configure,quality,stop,exportBundle,dispose(){stop();disposed=true;listeners.clear();}};
}
