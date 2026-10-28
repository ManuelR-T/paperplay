import { DYNAMICS_SOLVER_VERSION,type DynamicsRequest,type DynamicsResult } from '../../shared/dynamics';
import { normalizeDynamicsRequest,validateDynamicsResult } from './model';
export const DYNAMICS_WORKER_PROTOCOL=1;
export type DynamicsWorker={postMessage(value:unknown):void;terminate():void;onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror?:((event:MessageEvent<unknown>)=>void)|null};
export type DynamicsClientOptions={signal?:AbortSignal;timeoutMs?:number;onProgress?:(status:'starting'|'running')=>void;workerFactory?:()=>DynamicsWorker};
const active=new Set<DynamicsWorker>();
export function activeDynamicsExecutions(){return active.size;}
/** Browser runs have disposable workers; server execution uses only trusted registered equations. */
export async function executeDynamics(raw:DynamicsRequest,options:DynamicsClientOptions={}):Promise<DynamicsResult>{
 const request=normalizeDynamicsRequest(raw).request;
 if(options.signal?.aborted)throw new DOMException('Dynamics computation cancelled.','AbortError');
 if(typeof window==='undefined'&&!options.workerFactory){const {solveDynamics}=await import('./solver');return validateDynamicsResult(solveDynamics(request,{signal:options.signal}),request);}
 return new Promise((resolve,reject)=>{
  if(active.size>=2){reject(Error('Stop another dynamics computation before starting this one.'));return;}
  let worker:DynamicsWorker,id:string;
  try{id=crypto.randomUUID();worker=options.workerFactory?.()??new Worker(`/dynamics.worker.mjs?v=${DYNAMICS_SOLVER_VERSION}`,{type:'module',name:'paperplay-dynamics'});}catch{reject(Error('Background dynamics computation is unavailable. The prior trajectory remains available.'));return;}
  active.add(worker);let settled=false,started=false;
  const finish=(error:Error|null,result?:DynamicsResult)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();active.delete(worker);if(error)reject(error);else resolve(result!);};
  const abort=()=>finish(new DOMException('Dynamics computation cancelled.','AbortError'));
  const timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(30000,options.timeoutMs!)):request.solver.maxWallMs+1000;
  const timer=setTimeout(()=>finish(Error('Background dynamics computation reached its time limit.')),Math.min(30000,timeout));
  options.signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(Error('The dynamics worker failed. Its source and settings remain available.'));
  worker.onmessageerror=()=>finish(Error('The dynamics worker result could not be transferred.'));
  worker.onmessage=event=>{
   if(settled)return;const data=event.data as {protocol?:unknown;id?:unknown;status?:unknown;result?:unknown};
   if(!data||data.protocol!==DYNAMICS_WORKER_PROTOCOL||data.id!==id){finish(Error('The dynamics worker returned an incompatible or stale response.'));return;}
   if(data.status==='started'){if(started){finish(Error('The dynamics worker repeated its start response.'));return;}started=true;try{options.onProgress?.('running');}catch{finish(Error('The dynamics progress observer failed.'));}return;}
   if(data.status==='failed'){finish(Error('The dynamics request failed validation or its local computation could not complete.'));return;}
   try{if(data.status!=='complete')throw Error();const result=validateDynamicsResult(data.result,request);finish(null,result);}catch{finish(Error('The dynamics worker returned an invalid or unrelated trajectory.'));}
  };
  if(options.signal?.aborted){abort();return;}
  try{options.onProgress?.('starting');}catch{finish(Error('The dynamics progress observer failed.'));return;}if(settled)return;try{worker.postMessage({protocol:DYNAMICS_WORKER_PROTOCOL,id,request});}catch{finish(Error('The dynamics input could not be transferred.'));}
 });
}
