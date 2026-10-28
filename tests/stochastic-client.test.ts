import test from 'node:test';
import assert from 'node:assert/strict';
import { executeStochastic,activeStochasticExecutions,type StochasticWorker } from '../lib/stochastic/client';
import { solveStochastic } from '../lib/stochastic/solver';
import { createDefaultStochasticSolver,type StochasticRequest } from '../shared/stochastic';
const request=():StochasticRequest=>({format:'paperplay-stochastic',schemaVersion:1,model:{id:'pure-death',initial:4,countUnit:'count',rate:{value:1,per:'s',role:'per-item-hazard'}},assumptions:{wellMixed:true,independentEntities:true,constantRates:true,description:'Authored independent constant-hazard fixture.'},interval:{start:0,end:1,unit:'s'},replicates:4,observationCount:9,random:{seed:'42',sequence:'54'},solver:createDefaultStochasticSolver()});
class FakeWorker implements StochasticWorker{
 onmessage:StochasticWorker['onmessage']=null;onerror:StochasticWorker['onerror']=null;onmessageerror:StochasticWorker['onmessageerror']=null;terminated=0;posts:unknown[]=[];
 constructor(readonly respond?:(value:any,worker:FakeWorker)=>void){}
 terminate(){this.terminated++;}postMessage(value:unknown){this.posts.push(value);this.respond?.(value,this);}message(value:unknown){this.onmessage?.({data:value} as MessageEvent<unknown>);}
}
function resultWorker(change?:(value:any)=>unknown){return new FakeWorker((value,worker)=>{worker.message({protocol:1,id:value.id,status:'started'});queueMicrotask(()=>worker.message(change?change(value):{protocol:1,id:value.id,status:'complete',result:solveStochastic(value.request)}));});}
test('worker executes validated exact request and releases every transport resource',async()=>{
 const worker=resultWorker(),progress:string[]=[];const output=await executeStochastic(request(),{workerFactory:()=>worker,onProgress:value=>progress.push(value)});assert.equal(output.status,'completed');assert.deepEqual(progress,['starting','running']);assert.equal(worker.terminated,1);assert.equal(activeStochasticExecutions(),0);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);
});
test('stale, unrelated and malformed worker responses reject without retaining workers',async()=>{
 for(const response of [(v:any)=>({protocol:1,id:'wrong',status:'complete',result:solveStochastic(v.request)}),(v:any)=>{const other=request();other.model={id:'pure-death',initial:2,countUnit:'count',rate:{value:1,per:'s',role:'per-item-hazard'}};return {protocol:1,id:v.id,status:'complete',result:solveStochastic(other)};},(v:any)=>({protocol:1,id:v.id,status:'complete',result:{status:'completed'}})]){const worker=resultWorker(response);await assert.rejects(executeStochastic(request(),{workerFactory:()=>worker}),/invalid|unrelated|stale/);assert.equal(worker.terminated,1);assert.equal(activeStochasticExecutions(),0);}
});
test('cancel and deadline terminate CPU work while ignoring late messages',async()=>{
 const controller=new AbortController(),worker=new FakeWorker();const running=executeStochastic(request(),{workerFactory:()=>worker,signal:controller.signal});assert.equal(activeStochasticExecutions(),1);const late=worker.onmessage;controller.abort();await assert.rejects(running,error=>error instanceof DOMException&&error.name==='AbortError');late?.({data:{protocol:1,id:(worker.posts[0] as any).id,status:'complete',result:solveStochastic(request())}} as MessageEvent);assert.equal(worker.terminated,1);assert.equal(activeStochasticExecutions(),0);
 const timed=new FakeWorker();await assert.rejects(executeStochastic(request(),{workerFactory:()=>timed,timeoutMs:5}),/time limit/);assert.equal(timed.terminated,1);assert.equal(activeStochasticExecutions(),0);
});
test('pre-abort and invalid input create no workers; unavailable factories do not run a fallback',async()=>{
 const controller=new AbortController();controller.abort();let factories=0;const factory=()=>{factories++;throw Error('denied');};await assert.rejects(executeStochastic(request(),{signal:controller.signal,workerFactory:factory}),/cancelled/);const invalid=request();invalid.replicates=0;await assert.rejects(executeStochastic(invalid,{workerFactory:factory}));assert.equal(factories,0);await assert.rejects(executeStochastic(request(),{workerFactory:factory}),/unavailable/);assert.equal(factories,1);assert.equal(activeStochasticExecutions(),0);
});
test('progress observer exceptions and transport failures terminate immediately',async()=>{
 for(const stage of ['starting','running']){const worker=resultWorker();await assert.rejects(executeStochastic(request(),{workerFactory:()=>worker,onProgress:value=>{if(value===stage)throw Error('host private detail');}}),/observer failed/);assert.equal(worker.terminated,1);assert.equal(activeStochasticExecutions(),0);}
 const broken=new FakeWorker(()=>{throw Error('structured clone error');});await assert.rejects(executeStochastic(request(),{workerFactory:()=>broken}),/transferred/);assert.equal(broken.terminated,1);assert.equal(activeStochasticExecutions(),0);
 const error=new FakeWorker((_value,worker)=>worker.onerror?.({} as ErrorEvent));await assert.rejects(executeStochastic(request(),{workerFactory:()=>error}),/worker failed/);assert.equal(error.terminated,1);
 const decoding=new FakeWorker((_value,worker)=>worker.onmessageerror?.({} as MessageEvent));await assert.rejects(executeStochastic(request(),{workerFactory:()=>decoding}),/transferred/);assert.equal(decoding.terminated,1);
});
test('parallel run cap preserves healthy workers and leaves no active instances after stop',async()=>{
 const a=new AbortController(),b=new AbortController(),first=new FakeWorker(),second=new FakeWorker();const one=executeStochastic(request(),{workerFactory:()=>first,signal:a.signal}),two=executeStochastic(request(),{workerFactory:()=>second,signal:b.signal});assert.equal(activeStochasticExecutions(),2);let extra=0;await assert.rejects(executeStochastic(request(),{workerFactory:()=>{extra++;return new FakeWorker();}}),/Stop another/);assert.equal(extra,0);a.abort();b.abort();await Promise.allSettled([one,two]);assert.equal(first.terminated,1);assert.equal(second.terminated,1);assert.equal(activeStochasticExecutions(),0);
});
test('identity generation failure occurs before constructing a worker',async()=>{
 const original=crypto.randomUUID;let workers=0;crypto.randomUUID=()=>{throw Error('random identity unavailable');};try{await assert.rejects(executeStochastic(request(),{workerFactory:()=>{workers++;return new FakeWorker();}}),/unavailable/);assert.equal(workers,0);assert.equal(activeStochasticExecutions(),0);}finally{crypto.randomUUID=original;}
});
