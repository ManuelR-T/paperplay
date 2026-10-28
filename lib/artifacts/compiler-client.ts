'use client';
import {withGeneratedExecution,type AdoptionPolicyHost} from '../adoption/policy';
import { compileRequestSchema,compiledFigureSchema,compileDiagnosticSchema,canonicalArtifactJson,type FigureCompileRequest,type FigureCompileResult } from '../../shared/figure-compilation';
import type { CompiledFigure } from '../../shared/figure-compilation';
const localAdmissions=new WeakSet<object>();
export function isLocallyCompiledFigure(artifact:CompiledFigure){return localAdmissions.has(artifact);}
function freezeAdmission(value:unknown){if(value&&typeof value==='object'){Object.values(value).forEach(freezeAdmission);Object.freeze(value);}}
import { loadArtifactWorker } from './worker-bootstrap';
import { sha256Text } from './sdk-source';
import {getExecutionScheduler,ExecutionSchedulingError,type ExecutionScheduler} from '../execution/scheduler';
export type CompilerWorkerOptions={policyHost?:AdoptionPolicyHost;signal?:AbortSignal;workerUrl?:string;scheduler?:ExecutionScheduler;ownerId?:string;revision?:string;visible?:boolean};
/** Each compilation gets a fresh worker. The host owns the deadline, cancellation and accepted result shape. */
export async function compileFigureInWorker(request:FigureCompileRequest,options:CompilerWorkerOptions={}):Promise<FigureCompileResult>{
 options={...options};
 const scheduler=options.scheduler??getExecutionScheduler(),epoch=scheduler.getSnapshot().stopEpoch;
 const parsed=compileRequestSchema.safeParse(request);if(!parsed.success)return {status:'rejected',diagnostics:[{code:'integrity',message:'Invalid compiler request.'}]};
 const serialized=JSON.stringify(parsed.data);if(new TextEncoder().encode(serialized).length>70*1024)return {status:'rejected',diagnostics:[{code:'integrity',message:'Invalid compiler request.'}]};
 const captured=compileRequestSchema.parse(JSON.parse(serialized));freezeAdmission(captured);
 try{return await withGeneratedExecution(options.signal,async(signal,assertCurrent)=>{assertCurrent();if(scheduler.getSnapshot().stopEpoch!==epoch)throw new DOMException('Cancelled','AbortError');return compileAdmittedFigure(captured,{...options,signal},assertCurrent);},options.policyHost);}
 catch(error){const cancelled=error instanceof DOMException&&error.name==='AbortError';return {status:cancelled?'cancelled':'failed',diagnostics:[{code:cancelled?'cancelled':'unavailable',message:cancelled?'Compilation cancelled.':'Generated compilation is disabled or operator policy is unavailable. Source and recorded replay remain available.'}]};}
}
async function compileAdmittedFigure(request:FigureCompileRequest,options:CompilerWorkerOptions,assertPolicy:()=>void):Promise<FigureCompileResult>{
 const scheduler=options.scheduler??getExecutionScheduler(),stopEpoch=scheduler.getSnapshot().stopEpoch;
 const parsed=compileRequestSchema.safeParse(request);if(!parsed.success||new TextEncoder().encode(JSON.stringify(request)).length>70*1024)return {status:'rejected',diagnostics:[{code:'integrity',message:'Invalid compiler request.'}]};
 const checkedRequest=parsed.data;
 if(typeof Worker==='undefined'||typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')return {status:'failed',diagnostics:[{code:'unavailable',message:'This browser cannot start the isolated compiler.'}]};
 if(options.signal?.aborted||scheduler.getSnapshot().stopEpoch!==stopEpoch)return {status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]};
 // Infrastructure has its own bounded verification deadline; CPU admission starts afterwards.
 let url:string;try{url=options.workerUrl??await loadArtifactWorker('compiler',options.signal);}catch{if(options.signal?.aborted||scheduler.getSnapshot().stopEpoch!==stopEpoch)return {status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]};return {status:'failed',diagnostics:[{code:'unavailable',message:'The isolated compiler could not load its checked infrastructure.'}]};}
 if(options.signal?.aborted||scheduler.getSnapshot().stopEpoch!==stopEpoch)return {status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]};
 try{return await scheduler.run({kind:'artifact-compiler',ownerId:options.ownerId,revision:options.revision??checkedRequest.manifestSha256,visible:options.visible,resources:{inputBytes:new TextEncoder().encode(JSON.stringify(checkedRequest)).length,maxResultBytes:72*1024,memoryReservationBytes:68*1024*1024,maxExecutionMs:2200,maxQueueMs:30000}},async lease=>{
 assertPolicy();const signal=lease.signal;if(signal.aborted)throw signal.reason;let worker:Worker;try{worker=new Worker(url,{type:'module'});}catch{return {status:'failed',diagnostics:[{code:'unavailable',message:'The isolated compiler could not start.'}]} as FigureCompileResult;}
 const instanceId=crypto.randomUUID();
 return new Promise<FigureCompileResult>(resolve=>{let done=false,messages=0;const finish=(value:FigureCompileResult)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.terminate();resolve(value);};const abort=()=>finish({status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]});const timer=setTimeout(()=>finish({status:'failed',diagnostics:[{code:'resource',message:'The isolated compiler exceeded its wall-clock budget.'}]}),2000);
 worker.onerror=()=>finish({status:'failed',diagnostics:[{code:'resource',message:'The isolated compiler failed.'}]});
 worker.onmessage=event=>{void (async()=>{try{if(done)return;if(++messages>1)throw Error();const raw=event.data;if(!raw||Object.keys(raw).some(key=>!['instanceId','result'].includes(key))||raw.instanceId!==instanceId||new TextEncoder().encode(JSON.stringify(raw)).length>72*1024)throw Error();const result=raw.result;if(result.status==='ready'){const artifact=compiledFigureSchema.parse(result.artifact);if(artifact.manifestSha256!==checkedRequest.manifestSha256||artifact.entry.sha256!==checkedRequest.sourceSha256||artifact.entry.source!==checkedRequest.source||artifact.sdk.sha256!==checkedRequest.sdkSha256||result.sha256!==await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(artifact)))throw Error();if(done||signal.aborted)return;lease.acceptResultBytes(new TextEncoder().encode(JSON.stringify(raw)).length);freezeAdmission(artifact);localAdmissions.add(artifact);finish({status:'ready',artifact,sha256:result.sha256,diagnostics:[]});}else{if(!['rejected','cancelled','failed'].includes(result.status)||!Array.isArray(result.diagnostics)||result.diagnostics.length>4)throw Error();const diagnostics=result.diagnostics.map((value:unknown)=>compileDiagnosticSchema.parse(value));lease.acceptResultBytes(new TextEncoder().encode(JSON.stringify(raw)).length);finish({status:result.status,diagnostics});}}catch{finish({status:'failed',diagnostics:[{code:'integrity',message:'Compiler response failed integrity checks.'}]});}})();};
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}try{worker.postMessage({instanceId,request:checkedRequest});}catch{finish({status:'failed',diagnostics:[{code:'resource',message:'The compiler input could not be transferred.'}]});}
 });
 },{signal:options.signal,expectedStopEpoch:stopEpoch});}catch(error){const cancelled=options.signal?.aborted||error instanceof DOMException&&error.name==='AbortError'||error instanceof ExecutionSchedulingError&&['backgrounded','superseded','disposed'].includes(error.code);return {status:cancelled?'cancelled':'failed',diagnostics:[{code:cancelled?'cancelled':'resource',message:'Compilation stopped before a validated result was available.'}]};}
}
