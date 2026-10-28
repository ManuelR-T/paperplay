'use client';
import { compileRequestSchema,compiledFigureSchema,compileDiagnosticSchema,canonicalArtifactJson,type FigureCompileRequest,type FigureCompileResult } from '../../shared/figure-compilation';
import type { CompiledFigure } from '../../shared/figure-compilation';
const localAdmissions=new WeakSet<object>();
export function isLocallyCompiledFigure(artifact:CompiledFigure){return localAdmissions.has(artifact);}
function freezeAdmission(value:unknown){if(value&&typeof value==='object'){Object.values(value).forEach(freezeAdmission);Object.freeze(value);}}
import { loadArtifactWorker } from './worker-bootstrap';
import { sha256Text } from './sdk-source';
/** Each compilation gets a fresh worker. The host owns the deadline, cancellation and accepted result shape. */
export async function compileFigureInWorker(request:FigureCompileRequest,options:{signal?:AbortSignal;workerUrl?:string}={}):Promise<FigureCompileResult>{
 const parsed=compileRequestSchema.safeParse(request);if(!parsed.success||new TextEncoder().encode(JSON.stringify(request)).length>70*1024)return {status:'rejected',diagnostics:[{code:'integrity',message:'Invalid compiler request.'}]};
 const checkedRequest=parsed.data;
 if(typeof Worker==='undefined'||typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')return {status:'failed',diagnostics:[{code:'unavailable',message:'This browser cannot start the isolated compiler.'}]};
 if(options.signal?.aborted)return {status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]};
 let worker:Worker;try{const url=options.workerUrl??await loadArtifactWorker('compiler',options.signal);if(options.signal?.aborted)return {status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]};worker=new Worker(url,{type:'module'});}catch{if(options.signal?.aborted)return {status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]};return {status:'failed',diagnostics:[{code:'unavailable',message:'The isolated compiler could not load its checked infrastructure.'}]};}
 const instanceId=crypto.randomUUID();
 return new Promise(resolve=>{let done=false,messages=0;const finish=(value:FigureCompileResult)=>{if(done)return;done=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.terminate();resolve(value);};const abort=()=>finish({status:'cancelled',diagnostics:[{code:'cancelled',message:'Compilation cancelled.'}]});const timer=setTimeout(()=>finish({status:'failed',diagnostics:[{code:'resource',message:'The isolated compiler exceeded its wall-clock budget.'}]}),2000);
 worker.onerror=()=>finish({status:'failed',diagnostics:[{code:'resource',message:'The isolated compiler failed.'}]});
 worker.onmessage=event=>{void (async()=>{try{if(done)return;if(++messages>1)throw Error();const raw=event.data;if(!raw||Object.keys(raw).some(key=>!['instanceId','result'].includes(key))||raw.instanceId!==instanceId||new TextEncoder().encode(JSON.stringify(raw)).length>72*1024)throw Error();const result=raw.result;if(result.status==='ready'){const artifact=compiledFigureSchema.parse(result.artifact);if(artifact.manifestSha256!==checkedRequest.manifestSha256||artifact.entry.sha256!==checkedRequest.sourceSha256||artifact.entry.source!==checkedRequest.source||artifact.sdk.sha256!==checkedRequest.sdkSha256||result.sha256!==await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(artifact)))throw Error();freezeAdmission(artifact);localAdmissions.add(artifact);finish({status:'ready',artifact,sha256:result.sha256,diagnostics:[]});}else{if(!['rejected','cancelled','failed'].includes(result.status)||!Array.isArray(result.diagnostics)||result.diagnostics.length>4)throw Error();finish({status:result.status,diagnostics:result.diagnostics.map((value:unknown)=>compileDiagnosticSchema.parse(value))});}}catch{finish({status:'failed',diagnostics:[{code:'integrity',message:'Compiler response failed integrity checks.'}]});}})();};
 options.signal?.addEventListener('abort',abort,{once:true});worker.postMessage({instanceId,request:checkedRequest});
 });
}
