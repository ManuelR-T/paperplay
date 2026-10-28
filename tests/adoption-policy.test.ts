import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readAdoptionPolicy,capabilityVersionGate} from '../shared/adoption';
import {createAdoptionPolicyHost} from '../lib/adoption/policy';
import {compileFigureInWorker,isLocallyCompiledFigure} from '../lib/artifacts/compiler-client';
import {createCompiledFigureAdapter} from '../lib/artifacts/runtime-client';
import {compileFigureSource} from '../lib/artifacts/compiler-engine';
import {compilerRequestFromBuild} from '../lib/artifacts/compiler-request';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {buildFigureArtifact} from '../lib/artifacts/lifecycle';
import {createExecutionScheduler} from '../lib/execution/scheduler';
import {GET} from '../app/api/adoption-policy/route';
const enabled=readAdoptionPolicy({}),disabled=readAdoptionPolicy({PAPERPLAY_GENERATED_EXECUTION_ENABLED:'false'});
const pause=()=>new Promise(resolve=>setTimeout(resolve,2));
async function until(f:()=>boolean){for(let i=0;i<100;i++){if(f())return;await pause();}assert.fail('Bounded expected state did not arrive');}
async function fixture(){const data=await createDynamicSequenceArtifact(),built=await buildFigureArtifact(data.artifact,data.source);assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();const request=compilerRequestFromBuild(built.value),result=await compileFigureSource(request,readFileSync('node_modules/acorn/dist/acorn.js','utf8'));assert.equal(result.status,'ready');return {...data,built:built.value,request,result};}
function restore(original:typeof Worker){if(original===undefined)Reflect.deleteProperty(globalThis,'Worker');else globalThis.Worker=original;}
test('operator flags preserve explicit Run by default, fail closed on invalid flags and keep exact version matching',()=>{
 assert.equal(enabled.generatedExecution,true);assert.equal(disabled.generatedExecution,false);assert.equal(readAdoptionPolicy({PAPERPLAY_GENERATED_EXECUTION_ENABLED:'yes'}).generatedExecution,false);
 assert.equal(readAdoptionPolicy({META_ANALYSIS_ENABLED:'false'}).newModelCreation,false);assert.equal(readAdoptionPolicy({META_CREDITS_EXPIRE_AT:'invalid'}).newModelCreation,false);
 assert.equal(capabilityVersionGate({id:'trusted',version:'1.0.1'},[{id:'trusted',version:'1.0.0'}]).allowed,false);
 assert.equal(capabilityVersionGate({id:'trusted',version:'1.0.0'},[{id:'trusted',version:'1.0.0'}]).allowed,true);
});
test('public policy is dynamic no-store metadata, without server credentials',async()=>{const result=GET();assert.match(result.headers.get('cache-control')!,/no-store/);const data=await result.json();assert.deepEqual(Object.keys(data).sort(),['format','schemaVersion','policyVersion','generatedExecution','newModelCreation','reason'].sort());});
test('host begins unknown, failed refresh denies, and imported JSON is not execution authority',async()=>{
 let calls=0;const host=createAdoptionPolicyHost(async()=>{calls++;throw Error('offline');});assert.equal(host.getSnapshot().state,'unknown');await assert.rejects(host.acquire());assert.equal(calls,1);assert.equal(host.getSnapshot().state,'unavailable');assert.equal('install' in host,false);
 const bad=createAdoptionPolicyHost(async()=>({...enabled,extra:'imported'}));await assert.rejects(bad.acquire());
});
test('direct compiler API under off policy performs no bootstrap, worker construction or admission',async()=>{
 const data=await fixture(),old=globalThis.Worker;let workers=0;
 class ForbiddenWorker{constructor(){workers++;throw Error();}}
 try{globalThis.Worker=ForbiddenWorker as unknown as typeof Worker;const result=await compileFigureInWorker(data.request,{policyHost:createAdoptionPolicyHost(async()=>disabled)});assert.equal(result.status,'failed');assert.equal(result.diagnostics[0].code,'unavailable');assert.equal(workers,0);assert.equal('artifact' in result,false);}finally{restore(old);}
});
test('operator revocation cancels active and queued generated compilation without cancelling trusted work',async()=>{
 const data=await fixture(),old=globalThis.Worker,scheduler=createExecutionScheduler({policy:{maxActive:1}});let policy=enabled,workers=0,terminated=0;
 const host=createAdoptionPolicyHost(async()=>policy);
 class HangingWorker{onmessage=null;onerror=null;constructor(){workers++;}postMessage(){}terminate(){terminated++;}}
 try{globalThis.Worker=HangingWorker as unknown as typeof Worker;const one=compileFigureInWorker(data.request,{scheduler,workerUrl:'/trusted-compiler',policyHost:host});await until(()=>workers===1);const two=compileFigureInWorker(data.request,{scheduler,workerUrl:'/trusted-compiler',policyHost:host});await until(()=>scheduler.getSnapshot().queued===1);policy=disabled;await host.refresh();assert.equal((await one).status,'cancelled');assert.equal((await two).status,'cancelled');assert.equal(workers,1);assert.equal(terminated,1);assert.equal(scheduler.getSnapshot().active,0);assert.equal(await scheduler.run({kind:'dynamics',resources:{inputBytes:1,maxResultBytes:1,memoryReservationBytes:1,maxExecutionMs:100}},async()=>7),7);}finally{scheduler.dispose();restore(old);}
});
test('cached private compile receipt cannot bypass off policy or revocation of an active runtime',async()=>{
 const data=await fixture(),old=globalThis.Worker;let policy=enabled,workers=0,terminated=0;const host=createAdoptionPolicyHost(async()=>policy);
 class FakeWorker{onmessage:((event:any)=>void)|null=null;onerror=null;constructor(){workers++;}postMessage(message:any){if('request'in message)queueMicrotask(()=>this.onmessage?.({data:{instanceId:message.instanceId,result:data.result}}));}terminate(){terminated++;}}
 try{globalThis.Worker=FakeWorker as unknown as typeof Worker;const compiled=await compileFigureInWorker(data.request,{workerUrl:'/compiler',policyHost:host});assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error();assert.equal(isLocallyCompiledFigure(compiled.artifact),true);const adapter=createCompiledFigureAdapter(data.built,compiled.artifact,compiled.sha256,{workerUrl:'/runtime',policyHost:host});policy=disabled;await assert.rejects(adapter.execute(data.artifact,{},null,{kind:'initialize'}),error=>error instanceof Error&&'code'in error&&error.code==='unavailable');assert.equal(workers,1);policy=enabled;const active=adapter.execute(data.artifact,{},null,{kind:'initialize'});await until(()=>workers===2);policy=disabled;await host.refresh();await assert.rejects(active,{name:'AbortError'});assert.equal(terminated,2);}finally{restore(old);}
});
test('compiler and runtime freeze caller payloads before deferred policy metadata, with no worker while policy is unknown',async()=>{
 const data=await fixture(),old=globalThis.Worker;let workers=0,releasePolicy:(()=>void)|undefined,runtimePayload:any;
 const host=createAdoptionPolicyHost(()=>new Promise(resolve=>{releasePolicy=()=>resolve(enabled);}));
 class FakeWorker{onmessage:((event:any)=>void)|null=null;onerror=null;constructor(){workers++;}postMessage(message:any){if('request'in message){assert.equal(message.request.source,data.request.source);queueMicrotask(()=>this.onmessage?.({data:{instanceId:message.instanceId,result:data.result}}));}else runtimePayload=message;}terminate(){}}
 try{
  globalThis.Worker=FakeWorker as unknown as typeof Worker;
  const callerRequest={...data.request},compiling=compileFigureInWorker(callerRequest,{workerUrl:'/compiler',policyHost:host});callerRequest.source='MUTATED_DURING_FREE_METADATA';assert.equal(workers,0);assert.equal(host.getSnapshot().state,'unknown');releasePolicy!();const compiled=await compiling;assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error();
  releasePolicy=undefined;const delayedRuntimeHost=createAdoptionPolicyHost(()=>new Promise(resolve=>{releasePolicy=()=>resolve(enabled);}));
  const adapter=createCompiledFigureAdapter(data.built,compiled.artifact,compiled.sha256,{workerUrl:'/runtime',policyHost:delayedRuntimeHost}),controller=new AbortController(),input={items:[{id:'initial'}]},state={counter:1};
  const running=adapter.execute(data.artifact,input,state,{kind:'initialize'},controller.signal);input.items[0].id='later';input.items.push({id:'extra'});state.counter=99;assert.equal(workers,1);assert.equal(delayedRuntimeHost.getSnapshot().state,'unknown');releasePolicy!();await until(()=>runtimePayload!==undefined);assert.deepEqual(runtimePayload.input,{items:[{id:'initial'}]});assert.deepEqual(runtimePayload.state,{counter:1});controller.abort();await assert.rejects(running,{name:'AbortError'});
 }finally{restore(old);}
});
test('Stop during free operator metadata prevents late compiler admission even when metadata later enables execution',async()=>{
 const data=await fixture(),scheduler=createExecutionScheduler(),old=globalThis.Worker;let workers=0,release:()=>void=()=>{};
 const host=createAdoptionPolicyHost(()=>new Promise(resolve=>{release=()=>resolve(enabled);}));class ForbiddenWorker{constructor(){workers++;throw Error();}}
 try{globalThis.Worker=ForbiddenWorker as unknown as typeof Worker;const pending=compileFigureInWorker(data.request,{workerUrl:'/compiler',scheduler,policyHost:host});scheduler.cancelAll();release();assert.equal((await pending).status,'cancelled');assert.equal(workers,0);assert.equal(scheduler.getSnapshot().active,0);}finally{scheduler.dispose();restore(old);}
});
