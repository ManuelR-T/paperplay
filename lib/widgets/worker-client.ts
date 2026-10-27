import { validateWidgetSpec, type WidgetSpec } from '../../shared/widgets';
import type { WidgetResult } from './compute';
export const WIDGET_WORKER_PROTOCOL=2;
export function executeWidget(spec:WidgetSpec,seed:number,options:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<WidgetResult>{
 return new Promise((resolve,reject)=>{
  if(options.signal?.aborted){reject(new DOMException('Widget computation cancelled.','AbortError'));return;}
  let validated:WidgetSpec;try{validated=validateWidgetSpec(spec);if(new TextEncoder().encode(JSON.stringify(validated)).length>128*1024)throw Error('Widget input exceeds its transfer budget.');if(!Number.isInteger(seed)||seed<0||seed>4_294_967_295)throw Error('A widget needs a valid 32-bit seed.');}catch(e){reject(e);return;}
  if(typeof Worker==='undefined'){reject(Error('Browser workers are unavailable. No blocking main-thread fallback was run.'));return;}
  const id=crypto.randomUUID();let worker:Worker;try{worker=new Worker('/widget.worker.mjs?v=2.1.0',{type:'module'});}catch{reject(Error('The widget computation worker could not start.'));return;}
  let settled=false;const finish=(fn:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.terminate();fn();};
  const abort=()=>finish(()=>reject(new DOMException('Widget computation cancelled.','AbortError')));
  const timer=setTimeout(()=>finish(()=>reject(Error('Widget computation exceeded its time limit.'))),Math.min(30_000,Math.max(1,options.timeoutMs??15_000)));
  options.signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(()=>reject(Error('The widget worker failed. Its source and settings remain available.')));
  worker.onmessageerror=()=>finish(()=>reject(Error('The widget worker result could not be transferred. Its settings remain available.')));
  worker.onmessage=event=>{const data=event.data;if(data?.protocol!==2||data.id!==id)return;if(data.error)finish(()=>reject(Error(String(data.error))));else if(!data.result||typeof data.result.summary!=='string'||!Array.isArray(data.result.metrics)||new TextEncoder().encode(JSON.stringify(data.result)).length>2*1024*1024)finish(()=>reject(Error('The widget worker returned an invalid result.')));else finish(()=>resolve(data.result));};
  try{worker.postMessage({protocol:2,id,spec:validated,seed});}catch{finish(()=>reject(Error('The widget input could not be transferred. No computation was retained.')));}
 });
}
