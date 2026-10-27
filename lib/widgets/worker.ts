/// <reference lib="webworker" />
import { computeWidget } from './compute';
import { widgetSpecSchema } from '../../shared/widgets';
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener('message',event=>{const data=event.data;try{if(data?.protocol!==2||typeof data.id!=='string'||new TextEncoder().encode(JSON.stringify(data)).length>128*1024||!Number.isInteger(data.seed)||data.seed<0||data.seed>4_294_967_295)throw Error('Invalid or oversized widget worker request.');const result=computeWidget(widgetSpecSchema.parse(data.spec),data.seed);if(new TextEncoder().encode(JSON.stringify(result)).length>2*1024*1024)throw Error('Widget result exceeds its transfer budget.');scope.postMessage({protocol:2,id:data.id,result});}catch(e){scope.postMessage({protocol:2,id:data?.id,error:e instanceof Error?e.message:'The computation failed.'});}});
