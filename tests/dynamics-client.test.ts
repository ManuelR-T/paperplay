import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDynamics,activeDynamicsExecutions,type DynamicsWorker } from '../lib/dynamics/client';
import { solveDynamics } from '../lib/dynamics/solver';
import { createDefaultDynamicsSolver,type DynamicsRequest } from '../shared/dynamics';
const request=():DynamicsRequest=>({format:'paperplay-dynamics',schemaVersion:1,model:{id:'decay',initial:{value:1,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'}},interval:{start:0,end:1,unit:'s'},solver:createDefaultDynamicsSolver([{value:1e-9,unit:'1'}])});
class FakeWorker implements DynamicsWorker{
 onmessage:DynamicsWorker['onmessage']=null;onerror:DynamicsWorker['onerror']=null;onmessageerror:DynamicsWorker['onmessageerror']=null;terminated=0;posts:unknown[]=[];
 constructor(readonly respond?:(value:any,worker:FakeWorker)=>void){}
 terminate(){this.terminated++;}postMessage(value:unknown){this.posts.push(value);this.respond?.(value,this);}message(value:unknown){this.onmessage?.({data:value} as MessageEvent<unknown>);}
}
function resultWorker(change?:(value:any)=>unknown){return new FakeWorker((value,worker)=>{worker.message({protocol:1,id:value.id,status:'started'});queueMicrotask(()=>worker.message(change?change(value):{protocol:1,id:value.id,status:'complete',result:solveDynamics(value.request)}));});}
test('worker executes validated exact request and releases every transport resource',async()=>{
 const worker=resultWorker(),progress:string[]=[];const output=await executeDynamics(request(),{workerFactory:()=>worker,onProgress:value=>progress.push(value)});assert.equal(output.status,'completed');assert.deepEqual(progress,['starting','running']);assert.equal(worker.terminated,1);assert.equal(activeDynamicsExecutions(),0);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);
});
test('stale, unrelated and malformed worker responses reject without retaining workers',async()=>{
 for(const response of [(v:any)=>({protocol:1,id:'wrong',status:'complete',result:solveDynamics(v.request)}),(v:any)=>{const other=request();other.model={id:'decay',initial:{value:2,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'}};return {protocol:1,id:v.id,status:'complete',result:solveDynamics(other)};},(v:any)=>({protocol:1,id:v.id,status:'complete',result:{status:'completed'}})]){const worker=resultWorker(response);await assert.rejects(executeDynamics(request(),{workerFactory:()=>worker}),/invalid|unrelated|stale/);assert.equal(worker.terminated,1);assert.equal(activeDynamicsExecutions(),0);}
});
test('cancel and deadline terminate CPU work while ignoring late messages',async()=>{
 const controller=new AbortController(),worker=new FakeWorker();const running=executeDynamics(request(),{workerFactory:()=>worker,signal:controller.signal});assert.equal(activeDynamicsExecutions(),1);const late=worker.onmessage;controller.abort();await assert.rejects(running,error=>error instanceof DOMException&&error.name==='AbortError');late?.({data:{protocol:1,id:(worker.posts[0] as any).id,status:'complete',result:solveDynamics(request())}} as MessageEvent);assert.equal(worker.terminated,1);assert.equal(activeDynamicsExecutions(),0);
 const timed=new FakeWorker();await assert.rejects(executeDynamics(request(),{workerFactory:()=>timed,timeoutMs:5}),/time limit/);assert.equal(timed.terminated,1);assert.equal(activeDynamicsExecutions(),0);
});
test('pre-abort and invalid input create no workers; unavailable factories do not run a fallback',async()=>{
 const controller=new AbortController();controller.abort();let factories=0;const factory=()=>{factories++;throw Error('denied');};await assert.rejects(executeDynamics(request(),{signal:controller.signal,workerFactory:factory}),/cancelled/);const invalid=request();invalid.solver.atol=[];await assert.rejects(executeDynamics(invalid,{workerFactory:factory}));assert.equal(factories,0);await assert.rejects(executeDynamics(request(),{workerFactory:factory}),/unavailable/);assert.equal(factories,1);assert.equal(activeDynamicsExecutions(),0);
});
test('progress observer exceptions and transport failures terminate immediately',async()=>{
 for(const stage of ['starting','running']){const worker=resultWorker();await assert.rejects(executeDynamics(request(),{workerFactory:()=>worker,onProgress:value=>{if(value===stage)throw Error('host private detail');}}),/observer failed/);assert.equal(worker.terminated,1);assert.equal(activeDynamicsExecutions(),0);}
 const broken=new FakeWorker(()=>{throw Error('structured clone error');});await assert.rejects(executeDynamics(request(),{workerFactory:()=>broken}),/transferred/);assert.equal(broken.terminated,1);assert.equal(activeDynamicsExecutions(),0);
 const error=new FakeWorker((_value,worker)=>worker.onerror?.({} as ErrorEvent));await assert.rejects(executeDynamics(request(),{workerFactory:()=>error}),/worker failed/);assert.equal(error.terminated,1);
 const decoding=new FakeWorker((_value,worker)=>worker.onmessageerror?.({} as MessageEvent));await assert.rejects(executeDynamics(request(),{workerFactory:()=>decoding}),/transferred/);assert.equal(decoding.terminated,1);
});
test('parallel run cap preserves healthy workers and leaves no active instances after stop',async()=>{
 const a=new AbortController(),b=new AbortController(),first=new FakeWorker(),second=new FakeWorker();const one=executeDynamics(request(),{workerFactory:()=>first,signal:a.signal}),two=executeDynamics(request(),{workerFactory:()=>second,signal:b.signal});assert.equal(activeDynamicsExecutions(),2);let extra=0;await assert.rejects(executeDynamics(request(),{workerFactory:()=>{extra++;return new FakeWorker();}}),/Stop another/);assert.equal(extra,0);a.abort();b.abort();await Promise.allSettled([one,two]);assert.equal(first.terminated,1);assert.equal(second.terminated,1);assert.equal(activeDynamicsExecutions(),0);
});
test('identity generation failure occurs before constructing a worker',async()=>{
 const original=crypto.randomUUID;let workers=0;crypto.randomUUID=()=>{throw Error('random identity unavailable');};try{await assert.rejects(executeDynamics(request(),{workerFactory:()=>{workers++;return new FakeWorker();}}),/unavailable/);assert.equal(workers,0);assert.equal(activeDynamicsExecutions(),0);}finally{crypto.randomUUID=original;}
});
