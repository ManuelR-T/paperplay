import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQualityCase,type QualityCaseId } from '../lib/artifacts/fixtures/quality-cases';
import { inspectFigureFrame,runFigureQuality,checkArtifactQuality } from '../lib/artifacts/quality-check';
import { buildFigureArtifact,type FigureExecutionAdapter } from '../lib/artifacts/lifecycle';
import { compileFigureSource } from '../lib/artifacts/compiler-engine';
import { compilerRequestFromBuild } from '../lib/artifacts/compiler-request';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { FigureRuntimeError } from '../shared/figure-runtime';
import { figureQualityDiagnosticSchema } from '../shared/figure-quality';
import { sha256Text } from '../lib/artifacts/sdk-source';
const parser=readFileSync('node_modules/acorn/dist/acorn.js','utf8');
const adapter:FigureExecutionAdapter={id:'trusted-reference-quality-tests',async execute(artifact,input,state,event){try{return await evaluateGuestFrame(artifact,input,state,event);}catch{throw new FigureRuntimeError('execution');}}};
async function prepared(id:QualityCaseId){
 const fixture=await createQualityCase(id);fixture.artifact.resources.maxExecutionMs=id==='runaway'?50:1000;
 const built=await buildFigureArtifact(fixture.artifact,fixture.source);assert.equal(built.status,'ready');if(built.status!=='ready')throw Error('invalid fixture');
 const compiled=await compileFigureSource(compilerRequestFromBuild(built.value),parser);assert.equal(compiled.status,'ready');
 return {...fixture,built:built.value};
}
test('real admitted reference guest grows sequential state; legitimate empty Add scene is usable',async()=>{
 const {built,source}=await prepared('healthy');const lengths:number[]=[];
 const result=await runFigureQuality(built,source,{adapter,promisedInteractions:true,onFrame(frame){lengths.push(frame.table.rows.length);}});
 assert.equal(result.status,'passed');assert.equal(result.framesChecked,12);assert.equal(result.textMeasurements,'not-run');assert.deepEqual(lengths,[0,1,1,2,3,4,5,6,7,8,9,10]);assert.equal(result.repairable,false);
});
test('actual host bounds detect long text clipping, without synthetic font estimates or private labels',async()=>{
 const {built,source}=await prepared('clipped-label');
 const unchecked=await runFigureQuality(built,source,{adapter,maxFrames:1,promisedInteractions:true});assert.equal(unchecked.status,'passed');assert.equal(unchecked.textMeasurements,'not-run');
 const checked=await runFigureQuality(built,source,{adapter,promisedInteractions:true,onFrame:()=>({textBounds:[{markIndex:0,x:100,y:32,width:500,height:16}]})});
 assert.equal(checked.textMeasurements,'provided');assert.equal(checked.status,'failed');assert.equal(checked.repairable,true);assert.deepEqual(checked.diagnostics,[{code:'text-clipped',scope:'artifact',step:0,markIndex:0}]);assert.equal(JSON.stringify(checked).includes('deliberately'),false);
});
test('unavailable promised interactions and blank later states have fixed repair diagnostics',async()=>{
 for(const id of ['unreachable-control','blank-after-action'] as const){const {built,source,expectedCodes}=await prepared(id);const result=await runFigureQuality(built,source,{adapter,promisedInteractions:true});assert.equal(result.status,'failed');assert.equal(result.repairable,true);assert.ok(result.diagnostics.some(d=>expectedCodes.includes(d.code)));assert.equal(result.diagnostics[0].step,id==='blank-after-action'?1:0);}
});
test('a guest loop reached only after repeated actions is interrupted and cannot expose exception text',async()=>{
 const {built,source}=await prepared('runaway');if(built.manifest.kind!=='generated')throw Error('Runaway fixture must use the generated isolation path.');assert.equal(built.manifest.resources.maxExecutionMs,50);
 // Node's cold WASM setup is unrelated to the repeated-action runaway assertion.
 // Give only the known finite prefix more startup time; the offending invocation
 // still uses the fixture's original 50 ms guest deadline. Production is unchanged.
 const repeatedActionAdapter:FigureExecutionAdapter={id:'trusted-runaway-prefix-reference',execute(artifact,input,state,event,signal){const next=((state as {nextId?:number}|null)?.nextId??0)+(event.kind==='control'?1:0);return adapter.execute(next<2?{...artifact,resources:{...artifact.resources,maxExecutionMs:1000}}:artifact,input,state,event,signal);}};
 const result=await runFigureQuality(built,source,{adapter:repeatedActionAdapter,promisedInteractions:true});
 assert.equal(result.status,'failed');assert.equal(result.repairable,true);assert.equal(result.framesChecked,2);assert.deepEqual(result.diagnostics,[{code:'execution',scope:'artifact',step:2}]);
});
test('deadline races a never-resolving host callback and aborts its signal',async()=>{
 const {built,source}=await prepared('healthy');let callbackSignal:AbortSignal|undefined;
 const result=await runFigureQuality(built,source,{adapter,maxDurationMs:100,onFrame(_frame,context){callbackSignal=context.signal;return new Promise(()=>{});}});
 assert.equal(result.status,'unavailable');assert.equal(result.repairable,false);assert.equal(result.diagnostics[0].code,'deadline');assert.equal(callbackSignal?.aborted,true);assert.equal(result.framesChecked,1);
});
test('caller cancellation wins over a hanging observation with no late frame commits',async()=>{
 const {built,source}=await prepared('healthy');const controller=new AbortController();let frames=0;
 const result=await runFigureQuality(built,source,{adapter,signal:controller.signal,onFrame(){frames++;controller.abort();return new Promise(()=>{});}});
 assert.equal(result.status,'cancelled');assert.equal(result.repairable,false);assert.equal(result.diagnostics[0].code,'cancelled');assert.equal(frames,1);
});
test('unknown platform failures and host diagnostic failures never authorize model repair',async()=>{
 const {built,source}=await prepared('healthy');
 const result=await runFigureQuality(built,source,{adapter:{id:'denied',async execute(){throw Error('private host detail');}}});assert.equal(result.status,'unavailable');assert.equal(result.repairable,false);assert.equal(result.diagnostics[0].code,'infrastructure');assert.equal(JSON.stringify(result).includes('private'),false);
 const host=await runFigureQuality(built,source,{adapter,onFrame:()=>({diagnostics:[{code:'page-overflow',scope:'host',step:0}]})});assert.equal(host.repairable,false);assert.equal(host.status,'unavailable');
});
test('text measurement failure stays host-owned; diagnostics reject arbitrary payload fields',async()=>{
 const {built}=await prepared('clipped-label');const frame=await adapter.execute(built.manifest as Parameters<typeof evaluateGuestFrame>[0],{},null,{kind:'initialize'});
 assert.deepEqual(inspectFigureFrame(frame,{step:0,textBounds:[]}),[{code:'missing-text-measurement',scope:'host',step:0,markIndex:0}]);
 assert.deepEqual(inspectFigureFrame(frame,{step:0,textBounds:[{markIndex:0,x:0,y:0,width:NaN,height:10}]}),[{code:'missing-text-measurement',scope:'host',step:0,markIndex:0}]);
 assert.equal(figureQualityDiagnosticSchema.safeParse({code:'text-clipped',scope:'artifact',step:0,text:'untrusted paper'}).success,false);
});
test('bounded convenience check validates the manifest before running and respects frame cap',async()=>{
 const {artifact,source}=await prepared('healthy');const checked=await checkArtifactQuality(artifact,source,{adapter,maxFrames:2});assert.equal(checked.framesChecked,2);
 const bad=await checkArtifactQuality({...artifact,source:{documentId:'wrong',sourceVersion:'wrong'}},source,{adapter});assert.equal(bad.status,'unavailable');assert.equal(bad.repairable,false);assert.equal(bad.diagnostics[0].code,'integrity');
});
test('a successful interaction may legitimately disable all controls at completion',async()=>{
 const {artifact,source}=await createQualityCase('healthy');artifact.entry.source=`function update(input,state,event){const done=event.kind==='control';return sdk.frame({title:'Completion',description:'Authored completion state',coordinateSpace:{width:100,height:80},marks:[sdk.circle({id:'node',center:[40,40],radius:10,label:'Done'})],controls:[sdk.button({id:'next',label:'Next',disabled:done})],state:{items:[],nextId:1}});}`;artifact.entry.sha256=await sha256Text(artifact.entry.source);artifact.resources.maxExecutionMs=1000;
 const result=await checkArtifactQuality(artifact,source,{adapter,promisedInteractions:true});assert.equal(result.status,'passed');assert.equal(result.framesChecked,2);
});
test('compiler rejection codes are bounded repair hints; compile infrastructure is not',async()=>{
 const {built,source}=await prepared('healthy');
 const syntax=await runFigureQuality(built,source,{compile:async()=>({status:'rejected',diagnostics:[{code:'syntax',message:'private source contents'}]})});assert.equal(syntax.repairable,true);assert.deepEqual(syntax.diagnostics,[{code:'invalid-input',scope:'artifact',step:0}]);assert.equal(JSON.stringify(syntax).includes('private'),false);
 const unknown=await runFigureQuality(built,source,{compile:async()=>{throw Error('platform denied');}});assert.equal(unknown.repairable,false);assert.equal(unknown.status,'unavailable');assert.equal(unknown.diagnostics[0].code,'infrastructure');
 const timeout=await runFigureQuality(built,source,{maxDurationMs:10,compile:async()=>new Promise(()=>{})});assert.equal(timeout.diagnostics[0].code,'deadline');assert.equal(timeout.framesChecked,0);
});

test('empty input is explicit and malformed initial values are rejected before execution',async()=>{
 const {artifact,source}=await createQualityCase('healthy');artifact.resources.maxExecutionMs=1000;let calls=0;const counting:FigureExecutionAdapter={id:'counting',execute(...args){calls++;return adapter.execute(...args);}};
 const valid=await checkArtifactQuality(artifact,source,{adapter:counting,maxFrames:1});assert.equal(valid.status,'passed');assert.equal(calls,1);
 const invalid={...artifact,interfaces:{...artifact.interfaces,input:[{id:'temperature',kind:'number',description:'Finite authored parameter'}]},initialInput:{temperature:'not-a-number'}};
 const failed=await checkArtifactQuality(invalid,source,{adapter:counting});assert.equal(failed.status,'unavailable');assert.equal(calls,1);assert.equal(failed.repairable,false);
});

for(const code of ['text-overlap','legend-overlap'] as const)test(`${code} measured artifact diagnostics authorize bounded layout repair`,async()=>{
 const {built,source}=await prepared('healthy');
 const result=await runFigureQuality(built,source,{adapter,maxFrames:1,onFrame:()=>({diagnostics:[{code,scope:'artifact',step:0,markIndex:0}]})});
 assert.equal(result.status,'failed');assert.equal(result.repairable,true);assert.equal(result.diagnostics[0].code,code);
});
