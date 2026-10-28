import test from 'node:test';
import assert from 'node:assert/strict';
import { executeField,activeFieldExecutions,type FieldWorker } from '../lib/fields/client';
import { solveField } from '../lib/fields/solver';
import { createDefaultFieldSolver,type FieldRequest } from '../shared/physical-fields';
const request=():FieldRequest=>({format:'paperplay-physical-field',schemaVersion:1,model:'temperature-diffusion',grid:{dimension:1,nx:4,ny:1,origin:[{value:0,unit:'m'}],extent:[{value:4,unit:'m'}],boundary:'periodic'},coefficient:{value:1,lengthUnit:'m',timeUnit:'s',role:'thermal-diffusivity'},initial:{kind:'constant',temperature:{value:300,unit:'K',temperatureMode:'absolute'}},interval:{start:0,end:1,unit:'s'},solver:createDefaultFieldSolver(.25,[0,4])});
class FakeWorker implements FieldWorker{
 onmessage:FieldWorker['onmessage']=null;onerror:FieldWorker['onerror']=null;onmessageerror:FieldWorker['onmessageerror']=null;terminated=0;posts:unknown[]=[];
 constructor(readonly respond?:(value:any,worker:FakeWorker)=>void){}
 terminate(){this.terminated++;}postMessage(value:unknown){this.posts.push(value);this.respond?.(value,this);}message(value:unknown){this.onmessage?.({data:value} as MessageEvent<unknown>);}
}
function resultWorker(change?:(value:any)=>unknown){return new FakeWorker((value,worker)=>{worker.message({protocol:1,id:value.id,status:'started'});queueMicrotask(()=>worker.message(change?change(value):{protocol:1,id:value.id,status:'complete',result:solveField(value.request)}));});}
test('worker executes validated exact request and releases every transport resource',async()=>{
 const worker=resultWorker(),progress:string[]=[];const output=await executeField(request(),{workerFactory:()=>worker,onProgress:value=>progress.push(value)});assert.equal(output.status,'completed');assert.deepEqual(progress,['starting','running']);assert.equal(worker.terminated,1);assert.equal(activeFieldExecutions(),0);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);
});
test('stale, unrelated and malformed worker responses reject without retaining workers',async()=>{
 for(const response of [(v:any)=>({protocol:1,id:'wrong',status:'complete',result:solveField(v.request)}),(v:any)=>{const other=request();other.initial={kind:'constant',temperature:{value:350,unit:'K',temperatureMode:'absolute'}};return {protocol:1,id:v.id,status:'complete',result:solveField(other)};},(v:any)=>({protocol:1,id:v.id,status:'complete',result:{status:'completed'}})]){const worker=resultWorker(response);await assert.rejects(executeField(request(),{workerFactory:()=>worker}),/invalid|unrelated|stale/);assert.equal(worker.terminated,1);assert.equal(activeFieldExecutions(),0);}
});
test('cancel and deadline terminate CPU work while ignoring late messages',async()=>{
 const controller=new AbortController(),worker=new FakeWorker();const running=executeField(request(),{workerFactory:()=>worker,signal:controller.signal});assert.equal(activeFieldExecutions(),1);const late=worker.onmessage;controller.abort();await assert.rejects(running,error=>error instanceof DOMException&&error.name==='AbortError');late?.({data:{protocol:1,id:(worker.posts[0] as any).id,status:'complete',result:solveField(request())}} as MessageEvent);assert.equal(worker.terminated,1);assert.equal(activeFieldExecutions(),0);
 const timed=new FakeWorker();await assert.rejects(executeField(request(),{workerFactory:()=>timed,timeoutMs:5}),/time limit/);assert.equal(timed.terminated,1);assert.equal(activeFieldExecutions(),0);
});
test('pre-abort and invalid input create no workers; unavailable factories do not run a fallback',async()=>{
 const controller=new AbortController();controller.abort();let factories=0;const factory=()=>{factories++;throw Error('denied');};await assert.rejects(executeField(request(),{signal:controller.signal,workerFactory:factory}),/cancelled/);const invalid=request();invalid.grid.nx=0;await assert.rejects(executeField(invalid,{workerFactory:factory}));assert.equal(factories,0);await assert.rejects(executeField(request(),{workerFactory:factory}),/unavailable/);assert.equal(factories,1);assert.equal(activeFieldExecutions(),0);
});
test('progress observer exceptions and transport failures terminate immediately',async()=>{
 for(const stage of ['starting','running']){const worker=resultWorker();await assert.rejects(executeField(request(),{workerFactory:()=>worker,onProgress:value=>{if(value===stage)throw Error('host private detail');}}),/observer failed/);assert.equal(worker.terminated,1);assert.equal(activeFieldExecutions(),0);}
 const broken=new FakeWorker(()=>{throw Error('structured clone error');});await assert.rejects(executeField(request(),{workerFactory:()=>broken}),/transferred/);assert.equal(broken.terminated,1);assert.equal(activeFieldExecutions(),0);
 const error=new FakeWorker((_value,worker)=>worker.onerror?.({} as ErrorEvent));await assert.rejects(executeField(request(),{workerFactory:()=>error}),/worker failed/);assert.equal(error.terminated,1);
 const decoding=new FakeWorker((_value,worker)=>worker.onmessageerror?.({} as MessageEvent));await assert.rejects(executeField(request(),{workerFactory:()=>decoding}),/transferred/);assert.equal(decoding.terminated,1);
});
test('parallel run cap preserves healthy workers and leaves no active instances after stop',async()=>{
 const a=new AbortController(),b=new AbortController(),first=new FakeWorker(),second=new FakeWorker();const one=executeField(request(),{workerFactory:()=>first,signal:a.signal}),two=executeField(request(),{workerFactory:()=>second,signal:b.signal});assert.equal(activeFieldExecutions(),2);let extra=0;await assert.rejects(executeField(request(),{workerFactory:()=>{extra++;return new FakeWorker();}}),/Stop another/);assert.equal(extra,0);a.abort();b.abort();await Promise.allSettled([one,two]);assert.equal(first.terminated,1);assert.equal(second.terminated,1);assert.equal(activeFieldExecutions(),0);
});
test('identity generation failure occurs before constructing a worker',async()=>{
 const original=crypto.randomUUID;let workers=0;crypto.randomUUID=()=>{throw Error('random identity unavailable');};try{await assert.rejects(executeField(request(),{workerFactory:()=>{workers++;return new FakeWorker();}}),/unavailable/);assert.equal(workers,0);assert.equal(activeFieldExecutions(),0);}finally{crypto.randomUUID=original;}
});
