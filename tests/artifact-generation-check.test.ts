import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { compileFigureSource } from '../lib/artifacts/compiler-engine';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { canonicalArtifactJson } from '../shared/figure-compilation';
import { sha256Text } from '../lib/artifacts/sdk-source';
import { checkGeneratedCandidate } from '../lib/artifacts/generation-check';
import { FigureRuntimeError } from '../shared/figure-runtime';
import type { GenerationCandidate } from '../shared/artifact-generation';
const parser=readFileSync('node_modules/acorn/dist/acorn.js','utf8');
async function fixture(code?:string){
 const data=await createDynamicSequenceArtifact();data.artifact.resources.maxExecutionMs=1000;
 if(code){data.artifact.entry.source=code;data.artifact.entry.sha256=await sha256Text(code);}
 const base={plan:{objective:'Explain structural changes',mechanism:'Add and remove stable entities',representation:'conceptual' as const,assumptions:['Authored illustrative data'],missingDetails:[],interactions:['Add an item']},artifact:data.artifact};
 const candidate:GenerationCandidate={...base,sha256:await sha256Text(canonicalArtifactJson(base))};return {candidate,source:data.source};
}
const local={compile:(request:Parameters<typeof compileFigureSource>[0])=>compileFigureSource(request,parser),adapter:()=>({id:'restricted-test-interpreter',execute:async(...args:Parameters<typeof evaluateGuestFrame>)=>{try{return await evaluateGuestFrame(...args);}catch{throw new FigureRuntimeError('execution');}}})};
test('candidate local checks admit source, initialize and exercise declared interactions without scientific promotion',async()=>{
 const {candidate,source}=await fixture();const checked=await checkGeneratedCandidate(candidate,source,local);
 assert.equal(checked.feedback.compiler.status,'ready');assert.equal(checked.feedback.runtime.status,'ready');assert.equal(checked.repairable,false);
 assert.deepEqual(checked.checks.filter(c=>c.status==='passed').map(c=>c.id),['manifest','compiler','initialize','button']);
 assert.equal(checked.checks.find(c=>c.id==='evidence')?.status,'skipped');assert.equal(candidate.artifact.kind==='generated'&&candidate.artifact.provenance.evidence,'unverified');
});
test('failed compiler feedback contains fixed codes and positions, never supplied diagnostic text',async()=>{
 const {candidate,source}=await fixture();const checked=await checkGeneratedCandidate(candidate,source,{compile:async()=>({status:'rejected',diagnostics:[{code:'syntax',position:17,message:'private paper and host path must not reach repair'}]})});
 assert.equal(checked.repairable,true);assert.deepEqual(checked.feedback.compiler.diagnostics,[{code:'syntax',position:17}]);assert.equal(JSON.stringify(checked).includes('private paper'),false);
 const unavailable=await checkGeneratedCandidate(candidate,source,{compile:async()=>({status:'failed',diagnostics:[{code:'unavailable',message:'Not loaded'}]})});assert.equal(unavailable.repairable,false);
});
test('inert candidate tampering and cancellation never reach compiler or start replacement work',async()=>{
 const {candidate,source}=await fixture();let calls=0;const compile=async()=>{calls++;throw Error();};
 const bad=await checkGeneratedCandidate({...candidate,sha256:'0'.repeat(64)},source,{compile});assert.equal(bad.feedback.compiler.diagnostics[0].code,'integrity');assert.equal(bad.repairable,false);
 const controller=new AbortController();controller.abort();const cancelled=await checkGeneratedCandidate(candidate,source,{compile,signal:controller.signal});assert.equal(cancelled.feedback.runtime.status,'cancelled');assert.equal(calls,0);
});
test('runtime failures remain inspectable repair hints without raw guest errors or invented test assertions',async()=>{
 const {candidate,source}=await fixture('function update(input,state,event){throw Error("privateScientificContent");}');const checked=await checkGeneratedCandidate(candidate,source,local);
 assert.equal(checked.feedback.compiler.status,'ready');assert.equal(checked.feedback.runtime.status,'failed');assert.equal(checked.repairable,true);assert.equal(JSON.stringify(checked).includes('privateScientificContent'),false);assert.equal(checked.checks.find(c=>c.id==='initialize')?.status,'failed');
});
test('bounded slider endpoints and entity events branch from the initial frame',async()=>{
 const code=`function update(input,state,event){const x=event.kind==='control'?event.value:5;return sdk.frame({title:'Slider',description:'Authored structural fixture',coordinateSpace:{width:100,height:80},marks:[sdk.circle({id:'node',entityId:'item',anchorId:'passage',center:[50,40],radius:10,label:'Selected node'})],controls:[sdk.slider({id:'level',label:'Level',min:0,max:10,step:1,value:x})],state:{items:[],nextId:1}});}`;
 const {candidate,source}=await fixture(code);const checked=await checkGeneratedCandidate(candidate,source,local);assert.equal(checked.feedback.runtime.status,'ready');assert.deepEqual(checked.checks.filter(c=>c.status==='passed').map(c=>c.id),['manifest','compiler','initialize','slider-min','slider-max','entity']);
});

test('unknown platform failures never authorize a paid repair',async()=>{
 const {candidate,source}=await fixture();const checked=await checkGeneratedCandidate(candidate,source,{...local,adapter:()=>({id:'platform-denied',async execute(){throw new DOMException('Worker denied by host policy','SecurityError');}})});assert.equal(checked.feedback.runtime.code,'unavailable');assert.equal(checked.repairable,false);assert.equal(JSON.stringify(checked).includes('host policy'),false);
});
