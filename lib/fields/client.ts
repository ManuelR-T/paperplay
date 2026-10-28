import { FIELD_SOLVER_VERSION,type FieldRequest,type FieldResult } from '../../shared/physical-fields';
import { normalizeFieldRequest,validateFieldResult } from './model';
export const FIELD_WORKER_PROTOCOL=1;
export type FieldWorker={postMessage(value:unknown):void;terminate():void;onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror?:((event:MessageEvent<unknown>)=>void)|null};
export type FieldClientOptions={signal?:AbortSignal;timeoutMs?:number;onProgress?:(status:'starting'|'running')=>void;workerFactory?:()=>FieldWorker};
const active=new Set<FieldWorker>();
export function activeFieldExecutions(){return active.size;}
/** Browser runs have disposable workers; server execution uses only trusted registered thermal-diffusion stencil. */
export async function executeField(raw:FieldRequest,options:FieldClientOptions={}):Promise<FieldResult>{
 const request=normalizeFieldRequest(raw).request;
 if(options.signal?.aborted)throw new DOMException('Field computation cancelled.','AbortError');
 if(typeof window==='undefined'&&!options.workerFactory){const {solveField}=await import('./solver');return validateFieldResult(solveField(request,{signal:options.signal}),request);}
 return new Promise((resolve,reject)=>{
  if(active.size>=2){reject(Error('Stop another field computation before starting this one.'));return;}
  let worker:FieldWorker,id:string;
  try{id=crypto.randomUUID();worker=options.workerFactory?.()??new Worker(`/fields.worker.mjs?v=${FIELD_SOLVER_VERSION}`,{type:'module',name:'paperplay-field'});}catch{reject(Error('Background field computation is unavailable. The prior field remains available.'));return;}
  active.add(worker);let settled=false,started=false;
  const finish=(error:Error|null,result?:FieldResult)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();active.delete(worker);if(error)reject(error);else resolve(result!);};
  const abort=()=>finish(new DOMException('Field computation cancelled.','AbortError'));
  const timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(30000,options.timeoutMs!)):request.solver.maxWallMs+1000;
  const timer=setTimeout(()=>finish(Error('Background field computation reached its time limit.')),Math.min(30000,timeout));
  options.signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(Error('The field worker failed. Its source and settings remain available.'));
  worker.onmessageerror=()=>finish(Error('The field worker result could not be transferred.'));
  worker.onmessage=event=>{
   if(settled)return;const data=event.data as {protocol?:unknown;id?:unknown;status?:unknown;result?:unknown};
   if(!data||data.protocol!==FIELD_WORKER_PROTOCOL||data.id!==id){finish(Error('The field worker returned an incompatible or stale response.'));return;}
   if(data.status==='started'){if(started){finish(Error('The field worker repeated its start response.'));return;}started=true;try{options.onProgress?.('running');}catch{finish(Error('The field progress observer failed.'));}return;}
   if(data.status==='failed'){finish(Error('The field request failed validation or its local computation could not complete.'));return;}
   try{if(data.status!=='complete')throw Error();const result=validateFieldResult(data.result,request);finish(null,result);}catch{finish(Error('The field worker returned an invalid or unrelated field.'));}
  };
  if(options.signal?.aborted){abort();return;}
  try{options.onProgress?.('starting');}catch{finish(Error('The field progress observer failed.'));return;}if(settled)return;try{worker.postMessage({protocol:FIELD_WORKER_PROTOCOL,id,request});}catch{finish(Error('The field input could not be transferred.'));}
 });
}
