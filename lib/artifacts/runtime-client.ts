'use client';
import type { CompiledFigure } from '../../shared/figure-compilation';
import { canonicalArtifactJson } from '../../shared/figure-compilation';
import { runtimeRequestSchema,runtimeResponseSchema,assertBoundedFigureJson,FigureRuntimeError } from '../../shared/figure-runtime';
import { validateSdkFrame,type SdkEvent,type SdkFrame } from '../../shared/figure-sdk';
import { isLocallyCompiledFigure } from './compiler-client';
import { loadArtifactWorker } from './worker-bootstrap';
import { sha256Text } from './sdk-source';
import type { BuiltFigureArtifact,FigureExecutionAdapter } from './lifecycle';
function freezeFrame(value:unknown){if(value&&typeof value==='object'){Object.values(value).forEach(freezeFrame);Object.freeze(value);}}
const activeWorkers=new Set<Worker>();
export function activeGeneratedExecutions(){return activeWorkers.size;}
/** A JSON artifact cannot create this adapter: compilation receipts are private in-memory identities. */
export function createCompiledFigureAdapter(built:BuiltFigureArtifact,compiled:CompiledFigure,compiledSha256:string,options:{workerUrl?:string}={}):FigureExecutionAdapter{
 if(built.manifest.kind!=='generated'||!isLocallyCompiledFigure(compiled)||compiled.manifestSha256!==built.contentSha256||compiled.entry.sha256!==built.manifest.entry.sha256)throw Error('Recompile this exact figure before execution.');
 const recent:number[]=[];
 return Object.freeze({id:'quickjs-wasm-worker@1.0.0',async execute(artifact,input,state,event,signal){
   const now=Date.now();while(recent.length&&recent[0]<now-1000)recent.shift();if(recent.length>=20)throw new FigureRuntimeError('resource');recent.push(now);
   if(typeof Worker==='undefined'||typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')throw new FigureRuntimeError('unavailable');if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(activeWorkers.size>=2)throw new FigureRuntimeError('resource');
   if(await sha256Text(JSON.stringify(artifact))!==compiled.manifestSha256||compiledSha256!==await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(compiled)))throw new FigureRuntimeError('integrity');
   const instanceId=crypto.randomUUID(),request=runtimeRequestSchema.parse({format:'paperplay-runtime-request',schemaVersion:1,instanceId,sequence:1,artifact,compiled,compiledSha256,input,state,event});assertBoundedFigureJson(request,768*1024);
   let workerUrl:string;try{workerUrl=options.workerUrl??await loadArtifactWorker('runtime',signal);}catch{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');throw new FigureRuntimeError('unavailable');}if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(activeWorkers.size>=2)throw new FigureRuntimeError('resource');let worker:Worker;try{worker=new Worker(workerUrl,{type:'module'});}catch{throw new FigureRuntimeError('unavailable');}activeWorkers.add(worker);
   return new Promise<SdkFrame>((resolve,reject)=>{let done=false,messages=0;const finish=(error:Error|null,frame?:SdkFrame)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();activeWorkers.delete(worker);if(error)reject(error);else resolve(frame!);};const abort=()=>finish(new DOMException('Cancelled','AbortError')),timer=setTimeout(()=>finish(new FigureRuntimeError('resource')),1500);
   worker.onerror=()=>finish(new FigureRuntimeError('execution'));
   worker.onmessage=message=>{try{if(done)return;if(++messages>1||message.origin!==''||message.target!==worker)throw Error();assertBoundedFigureJson(message.data,132*1024);const response=runtimeResponseSchema.parse(message.data);if(response.instanceId!==instanceId||response.sequence!==1)throw Error();if(response.status==='failed'){finish(new FigureRuntimeError(response.code));return;}const frame=validateSdkFrame(response.frame,artifact.resources,artifact.anchors.map(a=>a.id),artifact.capabilityRequests);freezeFrame(frame);finish(null,frame);}catch{finish(new FigureRuntimeError('integrity'));}};
   signal?.addEventListener('abort',abort,{once:true});worker.postMessage(request);
   });
 }});
}
export function validateFigureEvent(frame:SdkFrame,event:SdkEvent){if(event.kind==='initialize')return;if(event.kind==='entity'){if(!frame.marks.some(mark=>mark.entityId===event.id))throw Error('Entity is unavailable.');return;}const control=frame.controls.find(item=>item.id===event.id);if(!control||control.kind==='button'&&control.disabled)throw Error('Control is unavailable.');if(control.kind==='slider'&&(event.value===undefined||!Number.isFinite(event.value)||event.value<control.min||event.value>control.max))throw Error('Control value is outside its domain.');if(control.kind==='button'&&event.value!==undefined)throw Error('Button events cannot supply a value.');}
