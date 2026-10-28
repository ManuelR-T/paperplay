import { STOCHASTIC_SOLVER_VERSION,type StochasticRequest,type StochasticResult } from '../../shared/stochastic';
import { normalizeStochasticRequest,validateStochasticResult } from './model';
export const STOCHASTIC_WORKER_PROTOCOL=1;
export type StochasticWorker={postMessage(value:unknown):void;terminate():void;onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror?:((event:MessageEvent<unknown>)=>void)|null};
export type StochasticClientOptions={signal?:AbortSignal;timeoutMs?:number;onProgress?:(status:'starting'|'running')=>void;workerFactory?:()=>StochasticWorker};
const active=new Set<StochasticWorker>();
export function activeStochasticExecutions(){return active.size;}
/** Browser runs have disposable workers; server execution uses only trusted registered equations. */
export async function executeStochastic(raw:StochasticRequest,options:StochasticClientOptions={}):Promise<StochasticResult>{
 const request=normalizeStochasticRequest(raw).request;
 if(options.signal?.aborted)throw new DOMException('Stochastic computation cancelled.','AbortError');
 if(typeof window==='undefined'&&!options.workerFactory){const {solveStochastic}=await import('./solver');return validateStochasticResult(solveStochastic(request,{signal:options.signal}),request);}
 return new Promise((resolve,reject)=>{
  if(active.size>=2){reject(Error('Stop another stochastic computation before starting this one.'));return;}
  let worker:StochasticWorker,id:string;
  try{id=crypto.randomUUID();worker=options.workerFactory?.()??new Worker(`/stochastic.worker.mjs?v=${STOCHASTIC_SOLVER_VERSION}`,{type:'module',name:'paperplay-stochastic'});}catch{reject(Error('Background stochastic computation is unavailable. The prior count-process output remains available.'));return;}
  active.add(worker);let settled=false,started=false;
  const finish=(error:Error|null,result?:StochasticResult)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();active.delete(worker);if(error)reject(error);else resolve(result!);};
  const abort=()=>finish(new DOMException('Stochastic computation cancelled.','AbortError'));
  const timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(30000,options.timeoutMs!)):request.solver.maxWallMs+1000;
  const timer=setTimeout(()=>finish(Error('Background stochastic computation reached its time limit.')),Math.min(30000,timeout));
  options.signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(Error('The stochastic worker failed. Its source and settings remain available.'));
  worker.onmessageerror=()=>finish(Error('The stochastic worker result could not be transferred.'));
  worker.onmessage=event=>{
   if(settled)return;const data=event.data as {protocol?:unknown;id?:unknown;status?:unknown;result?:unknown};
   if(!data||data.protocol!==STOCHASTIC_WORKER_PROTOCOL||data.id!==id){finish(Error('The stochastic worker returned an incompatible or stale response.'));return;}
   if(data.status==='started'){if(started){finish(Error('The stochastic worker repeated its start response.'));return;}started=true;try{options.onProgress?.('running');}catch{finish(Error('The stochastic progress observer failed.'));}return;}
   if(data.status==='failed'){finish(Error('The stochastic request failed validation or its local computation could not complete.'));return;}
   try{if(data.status!=='complete')throw Error();const result=validateStochasticResult(data.result,request);finish(null,result);}catch{finish(Error('The stochastic worker returned an invalid or unrelated count-process output.'));}
  };
  if(options.signal?.aborted){abort();return;}
  try{options.onProgress?.('starting');}catch{finish(Error('The stochastic progress observer failed.'));return;}if(settled)return;try{worker.postMessage({protocol:STOCHASTIC_WORKER_PROTOCOL,id,request});}catch{finish(Error('The stochastic input could not be transferred.'));}
 });
}
