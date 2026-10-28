import {runScheduledWorker,type ExecutionScheduleOptions} from '../execution/scheduler';
import { type DiscreteRequest,type DiscreteResult } from '../../shared/discrete-algorithms';
import { validateDiscreteRequest,validateDiscreteResult } from './model';
export const DISCRETE_WORKER_PROTOCOL=1;
export type DiscreteWorker={postMessage(value:unknown):void;terminate():void;onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror?:((event:MessageEvent<unknown>)=>void)|null};
export type DiscreteClientOptions={signal?:AbortSignal;timeoutMs?:number;onProgress?:(status:'starting'|'running')=>void;workerFactory?:()=>DiscreteWorker} & ExecutionScheduleOptions;
const active=new Set<DiscreteWorker>();
export function activeDiscreteExecutions(){return active.size;}
/** Browser runs have disposable workers; server execution uses only trusted registered finite algorithm. */
async function executeDiscreteUnscheduled(raw:DiscreteRequest,options:DiscreteClientOptions={}):Promise<DiscreteResult>{
 const request=validateDiscreteRequest(raw);
 if(options.signal?.aborted)throw new DOMException('Discrete computation cancelled.','AbortError');
 if(typeof window==='undefined'&&!options.workerFactory){const {runDiscrete}=await import('./solver');return validateDiscreteResult(runDiscrete(request,{signal:options.signal}),request);}
 return new Promise((resolve,reject)=>{
  if(active.size>=2){reject(Error('Stop another discrete computation before starting this one.'));return;}
  let worker:DiscreteWorker,id:string;
  try{id=crypto.randomUUID();worker=options.workerFactory?.()??new Worker('/discrete.worker.mjs?v=1.0.0',{type:'module',name:'paperplay-discrete'});}catch{reject(Error('Background discrete computation is unavailable. The prior trace remains available.'));return;}
  active.add(worker);let settled=false,started=false;
  const finish=(error:Error|null,result?:DiscreteResult)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();active.delete(worker);if(error)reject(error);else resolve(result!);};
  const abort=()=>finish(new DOMException('Discrete computation cancelled.','AbortError'));
  const timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(30000,options.timeoutMs!)):request.limits.maxWallMs+1000;
  const timer=setTimeout(()=>finish(Error('Background discrete computation reached its time limit.')),Math.min(30000,timeout));
  options.signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(Error('The discrete worker failed. Its source and settings remain available.'));
  worker.onmessageerror=()=>finish(Error('The discrete worker result could not be transferred.'));
  worker.onmessage=event=>{
   if(settled)return;const data=event.data as {protocol?:unknown;id?:unknown;status?:unknown;result?:unknown};
   if(!data||data.protocol!==DISCRETE_WORKER_PROTOCOL||data.id!==id){finish(Error('The discrete worker returned an incompatible or stale response.'));return;}
   if(data.status==='started'){if(started){finish(Error('The discrete worker repeated its start response.'));return;}started=true;try{options.onProgress?.('running');}catch{finish(Error('The discrete progress observer failed.'));}return;}
   if(data.status==='failed'){finish(Error('The discrete request failed validation or its local computation could not complete.'));return;}
   try{if(data.status!=='complete')throw Error();const result=validateDiscreteResult(data.result,request);finish(null,result);}catch{finish(Error('The discrete worker returned an invalid or unrelated discrete.'));}
  };
  if(options.signal?.aborted){abort();return;}
  try{options.onProgress?.('starting');}catch{finish(Error('The discrete progress observer failed.'));return;}if(settled)return;try{worker.postMessage({protocol:DISCRETE_WORKER_PROTOCOL,id,request});}catch{finish(Error('The discrete input could not be transferred.'));}
 });
}

/** Global browser worker admission; existing explicit Node numerical execution stays unchanged. */
export async function executeDiscrete(raw:DiscreteRequest,options:DiscreteClientOptions={}):Promise<DiscreteResult>{
 const request=validateDiscreteRequest(raw),captured={...options};if(typeof window==='undefined'&&!captured.workerFactory)return executeDiscreteUnscheduled(request,captured);const timeout=Number.isFinite(captured.timeoutMs)?captured.timeoutMs!:request.limits.maxWallMs+1000;
 return runScheduledWorker('discrete',request,{maxResultBytes:3*1024*1024,maxExecutionMs:timeout},signal=>executeDiscreteUnscheduled(request,{...captured,signal}),captured);
}
