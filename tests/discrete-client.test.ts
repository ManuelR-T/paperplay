import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDiscrete,activeDiscreteExecutions,type DiscreteWorker } from '../lib/discrete/client';
import { runDiscrete } from '../lib/discrete/solver';
import { createDefaultDiscreteLimits,type DiscreteRequest } from '../shared/discrete-algorithms';
const request=():DiscreteRequest=>({format:'paperplay-discrete-request',schemaVersion:1,model:'kahn-topological',graph:{nodes:[{id:'a',label:'A'},{id:'b',label:'B'}],edges:[{id:'ab',source:'a',target:'b'}]},limits:createDefaultDiscreteLimits()});
class FakeWorker implements DiscreteWorker{
 onmessage:DiscreteWorker['onmessage']=null;onerror:DiscreteWorker['onerror']=null;onmessageerror:DiscreteWorker['onmessageerror']=null;terminated=0;posts:unknown[]=[];
 constructor(readonly respond?:(value:any,worker:FakeWorker)=>void){}
 terminate(){this.terminated++;}postMessage(value:unknown){this.posts.push(value);this.respond?.(value,this);}message(value:unknown){this.onmessage?.({data:value} as MessageEvent<unknown>);}
}
function resultWorker(change?:(value:any)=>unknown){return new FakeWorker((value,worker)=>{worker.message({protocol:1,id:value.id,status:'started'});queueMicrotask(()=>worker.message(change?change(value):{protocol:1,id:value.id,status:'complete',result:runDiscrete(value.request)}));});}
test('worker executes validated exact request and releases every transport resource',async()=>{
 const worker=resultWorker(),progress:string[]=[];const output=await executeDiscrete(request(),{workerFactory:()=>worker,onProgress:value=>progress.push(value)});assert.equal(output.status,'completed');assert.deepEqual(progress,['starting','running']);assert.equal(worker.terminated,1);assert.equal(activeDiscreteExecutions(),0);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);
});
test('stale, unrelated and malformed worker responses reject without retaining workers',async()=>{
 for(const response of [(v:any)=>({protocol:1,id:'wrong',status:'complete',result:runDiscrete(v.request)}),(v:any)=>{const other=request();if(other.model==='kahn-topological')other.graph.nodes[0].label='Other';return {protocol:1,id:v.id,status:'complete',result:runDiscrete(other)};},(v:any)=>({protocol:1,id:v.id,status:'complete',result:{status:'completed'}})]){const worker=resultWorker(response);await assert.rejects(executeDiscrete(request(),{workerFactory:()=>worker}),/invalid|unrelated|stale/);assert.equal(worker.terminated,1);assert.equal(activeDiscreteExecutions(),0);}
});
test('cancel and deadline terminate CPU work while ignoring late messages',async()=>{
 const controller=new AbortController(),worker=new FakeWorker();const running=executeDiscrete(request(),{workerFactory:()=>worker,signal:controller.signal});assert.equal(activeDiscreteExecutions(),1);const late=worker.onmessage;controller.abort();await assert.rejects(running,error=>error instanceof DOMException&&error.name==='AbortError');late?.({data:{protocol:1,id:(worker.posts[0] as any).id,status:'complete',result:runDiscrete(request())}} as MessageEvent);assert.equal(worker.terminated,1);assert.equal(activeDiscreteExecutions(),0);
 const timed=new FakeWorker();await assert.rejects(executeDiscrete(request(),{workerFactory:()=>timed,timeoutMs:5}),/time limit/);assert.equal(timed.terminated,1);assert.equal(activeDiscreteExecutions(),0);
});
test('pre-abort and invalid input create no workers; unavailable factories do not run a fallback',async()=>{
 const controller=new AbortController();controller.abort();let factories=0;const factory=()=>{factories++;throw Error('denied');};await assert.rejects(executeDiscrete(request(),{signal:controller.signal,workerFactory:factory}),/cancelled/);const invalid=request();if(invalid.model==='kahn-topological')invalid.graph.edges[0].target='missing';await assert.rejects(executeDiscrete(invalid,{workerFactory:factory}));assert.equal(factories,0);await assert.rejects(executeDiscrete(request(),{workerFactory:factory}),/unavailable/);assert.equal(factories,1);assert.equal(activeDiscreteExecutions(),0);
});
test('progress observer exceptions and transport failures terminate immediately',async()=>{
 for(const stage of ['starting','running']){const worker=resultWorker();await assert.rejects(executeDiscrete(request(),{workerFactory:()=>worker,onProgress:value=>{if(value===stage)throw Error('host private detail');}}),/observer failed/);assert.equal(worker.terminated,1);assert.equal(activeDiscreteExecutions(),0);}
 const broken=new FakeWorker(()=>{throw Error('structured clone error');});await assert.rejects(executeDiscrete(request(),{workerFactory:()=>broken}),/transferred/);assert.equal(broken.terminated,1);assert.equal(activeDiscreteExecutions(),0);
 const error=new FakeWorker((_value,worker)=>worker.onerror?.({} as ErrorEvent));await assert.rejects(executeDiscrete(request(),{workerFactory:()=>error}),/worker failed/);assert.equal(error.terminated,1);
 const decoding=new FakeWorker((_value,worker)=>worker.onmessageerror?.({} as MessageEvent));await assert.rejects(executeDiscrete(request(),{workerFactory:()=>decoding}),/transferred/);assert.equal(decoding.terminated,1);
});
test('parallel run cap preserves healthy workers and leaves no active instances after stop',async()=>{
 const a=new AbortController(),b=new AbortController(),first=new FakeWorker(),second=new FakeWorker();const one=executeDiscrete(request(),{workerFactory:()=>first,signal:a.signal}),two=executeDiscrete(request(),{workerFactory:()=>second,signal:b.signal});assert.equal(activeDiscreteExecutions(),2);let extra=0;const queuedController=new AbortController(),queued=executeDiscrete(request(),{signal:queuedController.signal,workerFactory:()=>{extra++;return new FakeWorker();}});assert.equal(extra,0);queuedController.abort();await assert.rejects(queued,/cancelled/);assert.equal(extra,0);a.abort();b.abort();await Promise.allSettled([one,two]);assert.equal(first.terminated,1);assert.equal(second.terminated,1);assert.equal(activeDiscreteExecutions(),0);
});
test('identity generation failure occurs before constructing a worker',async()=>{
 const original=crypto.randomUUID;let workers=0;crypto.randomUUID=()=>{throw Error('random identity unavailable');};try{await assert.rejects(executeDiscrete(request(),{workerFactory:()=>{workers++;return new FakeWorker();}}),/unavailable/);assert.equal(workers,0);assert.equal(activeDiscreteExecutions(),0);}finally{crypto.randomUUID=original;}
});
