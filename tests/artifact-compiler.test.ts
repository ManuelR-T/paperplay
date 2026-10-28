import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileFigureSource } from '../lib/artifacts/compiler-engine';
import { canonicalArtifactJson } from '../shared/figure-compilation';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { FIGURE_SDK_SOURCE,sha256Text } from '../lib/artifacts/sdk-source';
const parser=readFileSync('node_modules/acorn/dist/acorn.js','utf8');
async function request(source:string){return {format:'paperplay-figure-compile-request' as const,schemaVersion:1 as const,source,sourceSha256:await sha256Text(source),manifestSha256:'a'.repeat(64),sdkSha256:await sha256Text(FIGURE_SDK_SOURCE)};}
test('isolated compiler emits the same canonical source envelope without calling the generated function',async()=>{
 const {artifact}=await createDynamicSequenceArtifact(),input=await request(artifact.entry.source),one=await compileFigureSource(input,parser),two=await compileFigureSource(input,parser);assert.equal(one.status,'ready');assert.deepEqual(two,one);if(one.status!=='ready')throw Error();assert.equal(one.artifact.admission,'syntax-and-policy-only');assert.equal(one.artifact.scientificEvidence,'unverified');assert.equal(one.sha256,await sha256Text('paperplay-compiled-source-v1\n'+canonicalArtifactJson(one.artifact)));
 for(const source of ['function update(input,state,event){throw Error("must not run");}','function update(input,state,event){while(true){}}'])assert.equal((await compileFigureSource(await request(source),parser)).status,'ready');
});
test('AST admission rejects remote/dynamic dependencies, disguised loaders and entry/path/build expansion',async()=>{
 const bad=["import x from 'https://bad.invalid/x.js';function update(input,state,event){}","function update(input,state,event){return import('https://bad.invalid/x.js');}","function update(input,state,event){return req\\u0075ire('fs');}","function update(input,state,event){const text=`x${import('https://bad.invalid/')}`;}","function update(input,state,event){return module.exports;}","export function update(input,state,event){}",'function update(input,state,event){};update({},null,{});','async function update(input,state,event){}','function* update(input,state,event){}','function update(...args){}','function update(input,state){}'];
 for(const source of bad){const output=await compileFigureSource(await request(source),parser);assert.equal(output.status,'rejected',source);assert.ok(output.diagnostics.length<=1);}
 const input=await request('function update(input,state,event){}');for(const patch of [{entry:'../../escape.js'},{buildCommand:'npm install'},{dependencies:['remote']},{hooks:{postinstall:'x'}}])assert.equal((await compileFigureSource({...input,...patch},parser)).status,'rejected');
});
test('strings, comments, unicode and templates do not become wrapper code or fake imports',async()=>{
 const source='function update(input,state,event){const text="import(\\\"not-code\\\")";/* require module */const label=`Unicode λ and \\u03bc`;return text+label;}';assert.equal((await compileFigureSource(await request(source),parser)).status,'ready');
 const hostile='function update(input,state,event){const text="});throw Error(\\\"private-marker\\\");({";return text;}';assert.equal((await compileFigureSource(await request(hostile),parser)).status,'ready');
});
test('parser/source integrity and syntax/complexity pressure yield bounded source-free diagnostics',async()=>{
 const input=await request('function update(input,state,event){}');assert.equal((await compileFigureSource({...input,sourceSha256:'0'.repeat(64)},parser)).status,'rejected');assert.equal((await compileFigureSource(input,parser+' ')).status,'rejected');
 for(const source of ['function update(input,state,event){ const privateSensitiveName = ; }','function update(input,state,event){'+ '!'.repeat(200)+'1'+';}','function update(input,state,event){'+Array(5000).fill('0;').join('')+'}']){const output=await compileFigureSource(await request(source),parser);assert.equal(output.status,'rejected');const logs=JSON.stringify(output.diagnostics);assert.ok(logs.length<400);assert.ok(!logs.includes('privateSensitiveName'));assert.ok(!logs.includes('node_modules'));}
 assert.equal((await compileFigureSource(await request('x'.repeat(65537)),parser)).status,'rejected');
});

test('compiler owner validates instance/content responses and terminates on cancellation',async()=>{
 const { compileFigureInWorker }=await import('../lib/artifacts/compiler-client');const original=globalThis.Worker,input=await request('function update(input,state,event){}'),built=await compileFigureSource(input,parser);if(built.status!=='ready')throw Error();let terminated=0,spoof=true;
 class FakeWorker{onmessage:((event:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;postMessage(message:{instanceId:string}){queueMicrotask(()=>this.onmessage?.({data:{instanceId:spoof?'wrong-instance':message.instanceId,result:built}}));}terminate(){terminated++;}}
 try{globalThis.Worker=FakeWorker as unknown as typeof Worker;assert.equal((await compileFigureInWorker(input,{workerUrl:'/artifact-compiler.worker.mjs'})).status,'failed');assert.equal(terminated,1);spoof=false;assert.equal((await compileFigureInWorker(input,{workerUrl:'/artifact-compiler.worker.mjs'})).status,'ready');assert.equal(terminated,2);
 let markStarted!:()=>void;const started=new Promise<void>(resolve=>{markStarted=resolve;});
 class HangingWorker extends FakeWorker{postMessage(){markStarted();}}
 globalThis.Worker=HangingWorker as unknown as typeof Worker;const controller=new AbortController(),pending=compileFigureInWorker(input,{workerUrl:'/artifact-compiler.worker.mjs',signal:controller.signal});
 // This case exercises cancellation of an admitted compiler, after the free policy check.
 await Promise.race([started,pending.then(()=>{throw Error('Compiler finished before the cancellation fixture was admitted.');})]);controller.abort();assert.equal((await pending).status,'cancelled');assert.equal(terminated,3);
 }finally{if(original===undefined)Reflect.deleteProperty(globalThis,'Worker');else globalThis.Worker=original;}
});
