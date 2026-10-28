import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createExecutionScheduler} from '../lib/execution/scheduler';
import {compileFigureInWorker,isLocallyCompiledFigure} from '../lib/artifacts/compiler-client';
import {createCompiledFigureAdapter,activeGeneratedExecutions} from '../lib/artifacts/runtime-client';
import {compileFigureSource} from '../lib/artifacts/compiler-engine';
import {compilerRequestFromBuild} from '../lib/artifacts/compiler-request';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {buildFigureArtifact,runFigureArtifact} from '../lib/artifacts/lifecycle';
import {evaluateGuestFrame} from '../lib/artifacts/guest-engine';
const parser=readFileSync('node_modules/acorn/dist/acorn.js','utf8');
async function fixture(){const data=await createDynamicSequenceArtifact(),built=await buildFigureArtifact(data.artifact,data.source);if(built.status!=='ready')throw Error();const request=compilerRequestFromBuild(built.value),result=await compileFigureSource(request,parser);if(result.status!=='ready')throw Error();return {...data,built:built.value,request,result};}
async function until(predicate:()=>boolean){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.fail('Scheduler did not reach the expected bounded state.');}
const restoreWorker=(original:typeof Worker)=>{if(original===undefined)Reflect.deleteProperty(globalThis,'Worker');else globalThis.Worker=original;};

test('queued compiler cancellation constructs no worker while two other kinds own the shared slots',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),original=globalThis.Worker;let constructed=0;const releases:(()=>void)[]=[];
 class NeverWorker{constructor(){constructed++;throw Error('Queued worker must not be constructed.');}}
 try{globalThis.Worker=NeverWorker as unknown as typeof Worker;
 const resource={inputBytes:10,maxResultBytes:100,memoryReservationBytes:68*1024*1024,maxExecutionMs:2000};
 const holders=['engine','dynamics'].map(kind=>scheduler.run({kind:kind as 'engine'|'dynamics',resources:resource},()=>new Promise<void>(resolve=>releases.push(resolve))));
 await until(()=>scheduler.getSnapshot().active===2);const controller=new AbortController(),pending=compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs',signal:controller.signal});await until(()=>scheduler.getSnapshot().queued===1);assert.equal(constructed,0);controller.abort();assert.equal((await pending).status,'cancelled');assert.equal(constructed,0);releases.forEach(release=>release());await Promise.all(holders);assert.equal(scheduler.getSnapshot().active,0);
 }finally{releases.forEach(release=>release());scheduler.dispose();restoreWorker(original);}
});

test('background terminates admitted compilers while explicit queued cancellation creates no worker',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),original=globalThis.Worker;let constructed=0,terminated=0;const lateCallbacks:((event:any)=>void)[]=[];
 class HangingWorker{onmessage:((event:any)=>void)|null=null;onerror:(()=>void)|null=null;constructor(){constructed++;}postMessage(message:any){const callback=this.onmessage!;lateCallbacks.push(()=>callback({data:{instanceId:message.instanceId,result:data.result}}));}terminate(){terminated++;}}
 try{globalThis.Worker=HangingWorker as unknown as typeof Worker;
 const controllers=Array.from({length:3},()=>new AbortController()),runs=controllers.map(controller=>compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs',signal:controller.signal}));await until(()=>constructed===2&&scheduler.getSnapshot().queued===1);assert.equal(scheduler.getSnapshot().active,2);assert.equal(scheduler.getSnapshot().reservedMemoryBytes,136*1024*1024);
 scheduler.setDocumentVisible(false);controllers[2].abort();const results=await Promise.all(runs);assert.ok(results.every(result=>result.status==='cancelled'));assert.equal(constructed,2);assert.equal(terminated,2);lateCallbacks.forEach(callback=>callback({}));await new Promise(resolve=>setTimeout(resolve,5));assert.ok(results.every(result=>!('artifact' in result)));assert.equal(scheduler.getSnapshot().active,0);assert.equal(scheduler.getSnapshot().queued,0);
 }finally{scheduler.setDocumentVisible(true);scheduler.dispose();restoreWorker(original);}
});

test('runtime waits for global admission with a private immutable input snapshot and no third worker',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),original=globalThis.Worker,frame=await evaluateGuestFrame(data.artifact,{},null,{kind:'initialize'});let terminated=0;const runtimes:FakeWorker[]=[];
 class FakeWorker{onmessage:((event:any)=>void)|null=null;onerror:(()=>void)|null=null;request:any;constructor(readonly url:string){if(url.includes('runtime'))runtimes.push(this);}postMessage(message:any){this.request=message;if(this.url.includes('compiler'))queueMicrotask(()=>this.onmessage?.({data:{instanceId:message.instanceId,result:data.result}}));}emit(){this.onmessage?.({origin:'',target:this,data:{format:'paperplay-runtime-response',schemaVersion:1,instanceId:this.request.instanceId,sequence:1,status:'ready',frame}});}terminate(){terminated++;}}
 try{globalThis.Worker=FakeWorker as unknown as typeof Worker;const compiled=await compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs'});if(compiled.status!=='ready')throw Error();assert.ok(isLocallyCompiledFigure(compiled.artifact));assert.equal(isLocallyCompiledFigure(structuredClone(compiled.artifact)),false);
 const adapter=createCompiledFigureAdapter(data.built,compiled.artifact,compiled.sha256,{scheduler,workerUrl:'/runtime.worker.mjs'}),controllers=Array.from({length:3},()=>new AbortController()),input={nested:{value:1}};
 const runs=controllers.map(controller=>adapter.execute(data.artifact,input,null,{kind:'initialize'},controller.signal));await until(()=>runtimes.length===2&&scheduler.getSnapshot().queued===1);assert.equal(activeGeneratedExecutions(),2);input.nested.value=99;runtimes[0].emit();await runs[0];await until(()=>runtimes.length===3);assert.equal(runtimes[2].request.input.nested.value,1);controllers[1].abort();controllers[2].abort();const remaining=await Promise.allSettled(runs.slice(1));assert.ok(remaining.every(result=>result.status==='rejected'));assert.equal(activeGeneratedExecutions(),0);assert.equal(scheduler.getSnapshot().active,0);assert.equal(terminated,4);
 }finally{scheduler.dispose();restoreWorker(original);}
});

test('compiler constructor and transfer failures release shared reservations without minting admission',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),original=globalThis.Worker;let terminated=0;
 class ConstructorFailure{constructor(){throw Error('Simulated worker allocation failure.');}}
 class TransferFailure{onmessage=null;onerror=null;postMessage(){throw new DOMException('Cannot clone','DataCloneError');}terminate(){terminated++;}}
 try{globalThis.Worker=ConstructorFailure as unknown as typeof Worker;const unavailable=await compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs'});assert.equal(unavailable.status,'failed');assert.equal(unavailable.diagnostics[0]?.code,'unavailable');assert.equal(scheduler.getSnapshot().active,0);
 globalThis.Worker=TransferFailure as unknown as typeof Worker;const failed=await compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs'});assert.equal(failed.status,'failed');assert.equal(failed.diagnostics[0]?.code,'resource');assert.equal(terminated,1);assert.equal(scheduler.getSnapshot().reservedMemoryBytes,0);assert.equal(isLocallyCompiledFigure(data.result.artifact),false);
 }finally{scheduler.dispose();restoreWorker(original);}
});


test('global Stop returns lifecycle cancelled without requiring the original caller signal to abort',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),original=globalThis.Worker;let runtimeConstructed=0,terminated=0;
 class WorkerBridge{onmessage:((event:any)=>void)|null=null;onerror:(()=>void)|null=null;constructor(readonly url:string){if(url.includes('runtime'))runtimeConstructed++;}postMessage(message:any){if(this.url.includes('compiler'))queueMicrotask(()=>this.onmessage?.({data:{instanceId:message.instanceId,result:data.result}}));}terminate(){terminated++;}}
 try{globalThis.Worker=WorkerBridge as unknown as typeof Worker;const compiled=await compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs'});if(compiled.status!=='ready')throw Error();const adapter=createCompiledFigureAdapter(data.built,compiled.artifact,compiled.sha256,{scheduler,workerUrl:'/runtime.worker.mjs'});
 const caller=new AbortController(),pending=runFigureArtifact(data.built,data.source,{executionAdapter:adapter,signal:caller.signal});await until(()=>runtimeConstructed===1);scheduler.cancelAll();const result=await pending;assert.equal(caller.signal.aborted,false);assert.equal(result.status,'cancelled');assert.equal(terminated,2);assert.equal(scheduler.getSnapshot().active,0);assert.equal(activeGeneratedExecutions(),0);
 }finally{scheduler.dispose();restoreWorker(original);}
});

test('Stop during runtime pre-admission hashing prevents any late worker construction',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),original=globalThis.Worker,originalDigest=crypto.subtle.digest;let runtimeConstructed=0,release:(()=>void)|undefined;
 class WorkerBridge{onmessage:((event:any)=>void)|null=null;onerror:(()=>void)|null=null;constructor(readonly url:string){if(url.includes('runtime'))runtimeConstructed++;}postMessage(message:any){if(this.url.includes('compiler'))queueMicrotask(()=>this.onmessage?.({data:{instanceId:message.instanceId,result:data.result}}));}terminate(){}}
 try{globalThis.Worker=WorkerBridge as unknown as typeof Worker;const compiled=await compileFigureInWorker(data.request,{scheduler,workerUrl:'/compiler.worker.mjs'});if(compiled.status!=='ready')throw Error();const adapter=createCompiledFigureAdapter(data.built,compiled.artifact,compiled.sha256,{scheduler,workerUrl:'/runtime.worker.mjs'});let held=false;
 crypto.subtle.digest=((...args:Parameters<SubtleCrypto['digest']>)=>{const computation=originalDigest.apply(crypto.subtle,args);if(held)return computation;held=true;return computation.then(value=>new Promise<ArrayBuffer>(resolve=>{release=()=>resolve(value);}));}) as SubtleCrypto['digest'];
 const pending=adapter.execute(data.artifact,{},null,{kind:'initialize'});await until(()=>release!==undefined);assert.equal(scheduler.getSnapshot().active,0);const before=scheduler.getSnapshot().stopEpoch;scheduler.cancelAll();assert.equal(scheduler.getSnapshot().stopEpoch,before+1);release!();await assert.rejects(pending,error=>error instanceof DOMException&&error.name==='AbortError');assert.equal(runtimeConstructed,0);assert.equal(scheduler.getSnapshot().active,0);assert.equal(scheduler.getSnapshot().queued,0);
 }finally{crypto.subtle.digest=originalDigest;release?.();scheduler.dispose();restoreWorker(original);}
});
