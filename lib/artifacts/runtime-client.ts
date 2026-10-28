'use client';
import type { CompiledFigure } from '../../shared/figure-compilation';
import { canonicalArtifactJson } from '../../shared/figure-compilation';
import { runtimeRequestSchema,runtimeResponseSchema,assertBoundedFigureJson,FigureRuntimeError,FIGURE_RUNTIME_VERSION,figureSeedSchema } from '../../shared/figure-runtime';
import { validateSdkFrame,type SdkEvent,type SdkFrame } from '../../shared/figure-sdk';
import { isLocallyCompiledFigure } from './compiler-client';
import { loadArtifactWorker } from './worker-bootstrap';
import { sha256Text } from './sdk-source';
import type { BuiltFigureArtifact,FigureExecutionAdapter } from './lifecycle';
import {getExecutionScheduler,type ExecutionScheduler} from '../execution/scheduler';
export type GeneratedWorkerOptions={workerUrl?:string;seed?:number;scheduler?:ExecutionScheduler;ownerId?:string;revision?:string;visible?:boolean};
function freezeFrame(value:unknown){if(value&&typeof value==='object'){Object.values(value).forEach(freezeFrame);Object.freeze(value);}}
const activeWorkers=new Set<Worker>();
export function activeGeneratedExecutions(){return activeWorkers.size;}
/** A JSON artifact cannot create this adapter: compilation receipts are private in-memory identities. */
export function createCompiledFigureAdapter(built:BuiltFigureArtifact,compiled:CompiledFigure,compiledSha256:string,options:GeneratedWorkerOptions={}):FigureExecutionAdapter{
 if(built.manifest.kind!=='generated'||!isLocallyCompiledFigure(compiled)||compiled.manifestSha256!==built.contentSha256||compiled.entry.sha256!==built.manifest.entry.sha256)throw Error('Recompile this exact figure before execution.');
 const seed=figureSeedSchema.parse(options.seed??42),recent:number[]=[];
 return Object.freeze({id:FIGURE_RUNTIME_VERSION,async execute(artifact,input,state,event,signal){
   const scheduler=options.scheduler??getExecutionScheduler(),stopEpoch=scheduler.getSnapshot().stopEpoch;
   const stopped=()=>{if(signal?.aborted||scheduler.getSnapshot().stopEpoch!==stopEpoch)throw new DOMException('Cancelled','AbortError');};
   const now=Date.now();while(recent.length&&recent[0]<now-1000)recent.shift();if(recent.length>=20)throw new FigureRuntimeError('resource');recent.push(now);
   if(typeof Worker==='undefined'||typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')throw new FigureRuntimeError('unavailable');if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const instanceId=crypto.randomUUID(),parsedRequest=runtimeRequestSchema.parse({format:'paperplay-runtime-request',schemaVersion:1,instanceId,sequence:1,artifact,compiled,compiledSha256,input,state,event,seed,runtimeVersion:FIGURE_RUNTIME_VERSION});assertBoundedFigureJson(parsedRequest,768*1024);
   // Freeze a private serialized snapshot before any queued wait; caller mutation must not change execution.
   const serialized=JSON.stringify(parsedRequest),request=runtimeRequestSchema.parse(JSON.parse(serialized));freezeFrame(request);if(request.artifact.kind!=='generated')throw new FigureRuntimeError('integrity');const manifest=request.artifact;if(await sha256Text(JSON.stringify(manifest))!==compiled.manifestSha256||compiledSha256!==await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(compiled)))throw new FigureRuntimeError('integrity');stopped();const revision=await sha256Text(serialized);stopped();
   let workerUrl:string;try{workerUrl=options.workerUrl??await loadArtifactWorker('runtime',signal);}catch{stopped();throw new FigureRuntimeError('unavailable');}stopped();
   try{return await scheduler.run({kind:'artifact-runtime',ownerId:options.ownerId,revision:options.revision??revision,visible:options.visible,resources:{inputBytes:new TextEncoder().encode(serialized).length,maxResultBytes:132*1024,memoryReservationBytes:68*1024*1024,maxExecutionMs:1700,maxQueueMs:30000}},async lease=>{
   const signal=lease.signal;if(signal.aborted)throw signal.reason;let worker:Worker;try{worker=new Worker(workerUrl,{type:'module'});}catch{throw new FigureRuntimeError('unavailable');}activeWorkers.add(worker);
   return new Promise<SdkFrame>((resolve,reject)=>{let done=false,messages=0;const finish=(error:Error|null,frame?:SdkFrame)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.terminate();activeWorkers.delete(worker);if(error)reject(error);else resolve(frame!);};const abort=()=>finish(new DOMException('Cancelled','AbortError')),timer=setTimeout(()=>finish(new FigureRuntimeError('resource')),1500);
   worker.onerror=()=>finish(new FigureRuntimeError('execution'));
   worker.onmessage=message=>{try{if(done)return;if(++messages>1||message.origin!==''||message.target!==worker)throw Error();assertBoundedFigureJson(message.data,132*1024);const response=runtimeResponseSchema.parse(message.data);if(response.instanceId!==instanceId||response.sequence!==1)throw Error();if(response.status==='failed'){finish(new FigureRuntimeError(response.code));return;}const frame=validateSdkFrame(response.frame,manifest.resources,manifest.anchors.map(a=>a.id),manifest.capabilityRequests);lease.acceptResultBytes(new TextEncoder().encode(JSON.stringify(message.data)).length);freezeFrame(frame);finish(null,frame);}catch{finish(new FigureRuntimeError('integrity'));}};
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}try{worker.postMessage(request);}catch{finish(new FigureRuntimeError('resource'));}
   });
   },{signal,expectedStopEpoch:stopEpoch});}catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw error;if(error instanceof FigureRuntimeError)throw error;throw new FigureRuntimeError('resource');}
 }});
}
export function validateFigureEvent(frame:SdkFrame,event:SdkEvent){if(event.kind==='initialize')return;if(event.kind==='entity'){if(!frame.marks.some(mark=>mark.entityId===event.id))throw Error('Entity is unavailable.');return;}const control=frame.controls.find(item=>item.id===event.id);if(!control||control.kind==='button'&&control.disabled)throw Error('Control is unavailable.');if(control.kind==='slider'&&(event.value===undefined||!Number.isFinite(event.value)||event.value<control.min||event.value>control.max))throw Error('Control value is outside its domain.');if(control.kind==='button'&&event.value!==undefined)throw Error('Button events cannot supply a value.');}
