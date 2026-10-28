import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { buildFigureArtifact,runFigureArtifact } from '../lib/artifacts/lifecycle';
import { compileFigureSource } from '../lib/artifacts/compiler-engine';
import { compileFigureInWorker,isLocallyCompiledFigure } from '../lib/artifacts/compiler-client';
import { compilerRequestFromBuild } from '../lib/artifacts/compiler-request';
import { createCompiledFigureAdapter,activeGeneratedExecutions,validateFigureEvent } from '../lib/artifacts/runtime-client';
import { figureRuntimeInput } from '../lib/artifacts/runtime-input';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { assertBoundedFigureJson } from '../shared/figure-json';
import { isSdkSelection,sdkSelectionRevision } from '../shared/figure-selection';
import { createSemanticSelectionStore } from '../lib/interactions/selection-store';
import { addApprovedAsset } from '../lib/assets/approval-pool';
import { sealScientificAsset } from '../lib/assets/local';
const parser=readFileSync('node_modules/acorn/dist/acorn.js','utf8');
async function fixture(){const data=await createDynamicSequenceArtifact();data.artifact.resources.maxExecutionMs=1000;const built=await buildFigureArtifact(data.artifact,data.source);if(built.status!=='ready')throw Error();return {...data,built:built.value};}
test('only fresh local compiler identities can install the production execution adapter',async()=>{
 const data=await fixture(),compiled=await compileFigureSource(compilerRequestFromBuild(data.built),parser);if(compiled.status!=='ready')throw Error();assert.equal(isLocallyCompiledFigure(compiled.artifact),false);assert.throws(()=>createCompiledFigureAdapter(data.built,compiled.artifact,compiled.sha256),/Recompile/);
});
test('production compiler/worker bridge enforces source, instance identity, immutable frames, concurrency and cancellation',async()=>{
 const data=await fixture(),input=compilerRequestFromBuild(data.built),compiled=await compileFigureSource(input,parser);if(compiled.status!=='ready')throw Error();const original=globalThis.Worker;let terminateCount=0,spoof=false,hold=false;
 class FakeWorker{onmessage:((event:unknown)=>void)|null=null;onerror:(()=>void)|null=null;url:string;constructor(url:string){this.url=url;}postMessage(message:any){if(hold)return;void (async()=>{const result=this.url.includes('compiler')?{instanceId:message.instanceId,result:compiled}:{format:'paperplay-runtime-response',schemaVersion:1,instanceId:spoof?crypto.randomUUID():message.instanceId,sequence:1,status:'ready',frame:await evaluateGuestFrame(message.artifact,message.input,message.state,message.event)};this.onmessage?.({origin:'',target:this,data:result});})();}terminate(){terminateCount++;}}
 try{globalThis.Worker=FakeWorker as unknown as typeof Worker;const admitted=await compileFigureInWorker(input,{workerUrl:'/artifact-compiler.worker.mjs'});if(admitted.status!=='ready')throw Error();assert.ok(isLocallyCompiledFigure(admitted.artifact));assert.equal(isLocallyCompiledFigure(structuredClone(admitted.artifact)),false);const adapter=createCompiledFigureAdapter(data.built,admitted.artifact,admitted.sha256,{workerUrl:'/artifact-runtime.worker.mjs'});
 const first=await runFigureArtifact(data.built,data.source,{executionAdapter:adapter,event:{kind:'control',id:'append'}});assert.equal(first.status,'ready');if(first.status!=='ready'||!('marks'in first.value))throw Error();assert.ok(Object.isFrozen(first.value));assert.ok(Object.isFrozen(first.value.state));assert.equal(activeGeneratedExecutions(),0);
 spoof=true;assert.equal((await runFigureArtifact(data.built,data.source,{executionAdapter:adapter})).status,'failed');spoof=false;hold=true;const a=new AbortController(),b=new AbortController(),c=new AbortController();const one=runFigureArtifact(data.built,data.source,{executionAdapter:adapter,signal:a.signal}),two=runFigureArtifact(data.built,data.source,{executionAdapter:adapter,signal:b.signal});await new Promise(resolve=>setTimeout(resolve,20));assert.equal(activeGeneratedExecutions(),2);assert.equal((await runFigureArtifact(data.built,data.source,{executionAdapter:adapter,signal:c.signal})).status,'failed');a.abort();b.abort();assert.ok((await Promise.all([one,two])).every(run=>run.status==='cancelled'));assert.equal(activeGeneratedExecutions(),0);assert.ok(terminateCount>=5);
 }finally{if(original===undefined)Reflect.deleteProperty(globalThis,'Worker');else globalThis.Worker=original;}
});
test('initial values and approved data delivery exclude unrelated assets and workspace objects',async()=>{
 const data=await fixture(),asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'declared',label:'Allowed fixture',kind:'table',shape:[1,1],coordinates:{system:'Authored rows',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Project-authored',rights:'ISC fixture'},transformations:[],data:{columns:[{id:'value',label:'Value',type:'number',unit:'index'}],rows:[{id:'row1',values:[2]}]}}),other=await sealScientificAsset({...asset,id:'unrelated'});
 const pool=addApprovedAsset([],asset,data.source);assert.equal(pool[0],asset);assert.throws(()=>addApprovedAsset(pool,structuredClone(asset),data.source),/Check these data/);const changed=await sealScientificAsset({...asset,data:{columns:[{id:'value',label:'Value',type:'number',unit:'index'}],rows:[{id:'row1',values:[3]}]}});assert.throws(()=>addApprovedAsset(pool,changed,data.source),/different content/);
 const manifest={...data.artifact,initialInput:{parameter:3},interfaces:{...data.artifact.interfaces,input:[{id:'parameter',kind:'number' as const,description:'Authored initial parameter'},{id:'assets',kind:'object' as const,description:'Declared data only'}]},assetIds:['declared'],assetBindings:[{id:'declared',kind:'table' as const,sha256:asset.checksum.value}]};const built=await buildFigureArtifact(manifest,data.source,{assets:[asset,other]});assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();const input=figureRuntimeInput(built.value);assert.deepEqual(Object.keys(input.assets as object),['declared']);assert.equal(input.parameter,3);assert.equal((input as any).workspace,undefined);
});
test('JSON/control/selection limits retain valid states and remove selections for deleted entities',async()=>{
 assert.throws(()=>assertBoundedFigureJson({x:Infinity},1024),/finite/);let nested:unknown={};for(let i=0;i<30;i++)nested={nested};assert.throws(()=>assertBoundedFigureJson(nested,65536),/structural/);
 const {artifact}=await fixture(),frame=await evaluateGuestFrame(artifact,{},null,{kind:'control',id:'append'});assert.throws(()=>validateFigureEvent(frame,{kind:'control',id:'not-declared'}),/unavailable/);assert.throws(()=>validateFigureEvent(frame,{kind:'control',id:'append',value:1}),/cannot/);assert.throws(()=>validateFigureEvent(frame,{kind:'entity',id:'missing'}),/unavailable/);assert.ok(frame.coordinateSpace.width<=160);assert.ok(frame.coordinateSpace.height<=100);
 let current=frame;const valid=(s:any)=>isSdkSelection(artifact.id,current,s),store=createSemanticSelectionStore({revision:sdkSelectionRevision('a'.repeat(64),frame),isValid:valid});store.select({kind:'entity',viewId:artifact.id,scopeId:'sdk',entityId:'item1'});current=await evaluateGuestFrame(artifact,{},frame.state,{kind:'control',id:'remove'});store.rebindInputs(sdkSelectionRevision('a'.repeat(64),current),valid);assert.equal(store.getSnapshot().selections.length,0);assert.equal(store.undo(),false);
});
