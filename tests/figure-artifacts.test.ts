import test from 'node:test';
import assert from 'node:assert/strict';
import { createDynamicSequenceArtifact as createFixture } from '../lib/artifacts/fixtures/dynamic-sequence';
import { declarativeFigureArtifact } from '../lib/artifacts/declarative';
import { buildFigureArtifact,runFigureArtifact } from '../lib/artifacts/lifecycle';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { createReasoningExample } from '../lib/representations/reasoning-examples';
import { validateFigureArtifact } from '../shared/figure-artifacts';
import { sealScientificAsset } from '../lib/assets/local';
import { validateSdkFrame } from '../shared/figure-sdk';
async function createDynamicSequenceArtifact(){const value=await createFixture();value.artifact.resources.maxExecutionMs=1000;return value;}
const referenceAdapter={id:'restricted-interpreter-reference-only',execute:evaluateGuestFrame};
test('one build/run interface preserves a declarative guide and generated variable-length SDK interaction',async()=>{
 const study=createReasoningExample('bell'),declarative=await buildFigureArtifact(declarativeFigureArtifact(study.plan,study.source),study.source);assert.equal(declarative.status,'ready');if(declarative.status!=='ready')throw Error();assert.equal((await runFigureArtifact(declarative.value,study.source)).status,'ready');
 const {artifact,source}=await createDynamicSequenceArtifact(),built=await buildFigureArtifact(artifact,source);assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();assert.equal(built.value.trust,'untrusted-source');assert.equal(built.value.evidence,'unverified');
 assert.equal((await runFigureArtifact(built.value,source)).status,'disabled');
 let state:unknown=null;const lengths=[];for(const event of [{kind:'initialize'},{kind:'control',id:'append'},{kind:'control',id:'append'},{kind:'control',id:'remove'}] as const){const run=await runFigureArtifact(built.value,source,{state,event,executionAdapter:referenceAdapter});assert.equal(run.status,'ready');if(run.status!=='ready'||!('marks'in run.value))throw Error();const frame=run.value;state=frame.state;lengths.push(frame.table.rows.length);assert.equal(run.evidence,'unverified');assert.ok(frame.marks.every(m=>!m.entityId||m.anchorId==='passage'));}
 assert.deepEqual(lengths,[0,1,2,1]);assert.deepEqual(state,{items:[{id:1,value:1}],nextId:3});
});
test('manifest source, exact SDK/source digests, strict privileges and evidence cannot self-authorize',async()=>{
 const {artifact,source}=await createDynamicSequenceArtifact();for(const patch of [{permissions:{network:true}},{trusted:true},{provenance:{...artifact.provenance,evidence:'verified'}},{dependencyLock:[...artifact.dependencyLock,{id:'remote-package',version:'1.0.0'}]}])assert.throws(()=>validateFigureArtifact({...artifact,...patch},source));
 const different=structuredClone(artifact);different.entry.source+='\n//changed';assert.equal((await buildFigureArtifact(different,source)).status,'invalid');
 const sdk=structuredClone(artifact);sdk.dependencyLock[0].sha256='0'.repeat(64);assert.equal((await buildFigureArtifact(sdk,source)).status,'invalid');
 const quote=structuredClone(artifact);quote.anchors[0].quote='Invented source';assert.throws(()=>validateFigureArtifact(quote,source),/anchor/);
});
test('SDK frame boundaries reject URL/HTML, undeclared source/capabilities, oversized outputs and malformed controls',async()=>{
 const {artifact}=await createDynamicSequenceArtifact(),frame=await evaluateGuestFrame(artifact,{},null,{kind:'control',id:'append'}),check=(value:unknown,caps=artifact.capabilityRequests)=>validateSdkFrame(value,artifact.resources,['passage'],caps);
 assert.equal(check({...frame,table:{...frame.table,rows:[[1,2e9]]}}).table.rows[0][1],2e9);assert.throws(()=>check({...frame,html:'<script/>'}));const bad=structuredClone(frame);bad.marks[0].anchorId='invented';assert.throws(()=>check(bad),/source/);assert.throws(()=>check(frame,[]),/capability/);assert.throws(()=>check({...frame,title:'<img src=x>'}));assert.throws(()=>check({...frame,table:{...frame.table,rows:[[1,2,3]]}}),/columns/);assert.throws(()=>validateSdkFrame(frame,{...artifact.resources,maxOutputBytes:1},['passage'],artifact.capabilityRequests),/budget/);
});
test('reference guest has no ambient host functions and interrupts loops under its heap/stack/time policy',async()=>{
 const {artifact}=await createDynamicSequenceArtifact();const custom=structuredClone(artifact);custom.entry.source=`function update(){ if(typeof fetch!=='undefined'||typeof process!=='undefined'||typeof document!=='undefined'||typeof localStorage!=='undefined'||typeof Worker!=='undefined')throw Error('Ambient host access'); return sdk.frame({title:'No ambient APIs',description:'Reference isolation probe only',coordinateSpace:{width:10,height:10},state:{items:[],nextId:1}});}`;
 const frame=await evaluateGuestFrame(custom,{},null,{kind:'initialize'});assert.equal(frame.title,'No ambient APIs');custom.entry.source='function update(){while(true){}}';custom.resources.maxExecutionMs=20;await assert.rejects(()=>evaluateGuestFrame(custom,{},null,{kind:'initialize'}),/failed/);
});
test('built source changes, invalid state and cancellation remain recoverable without scientific promotion',async()=>{
 const {artifact,source}=await createDynamicSequenceArtifact(),built=await buildFigureArtifact(artifact,source);if(built.status!=='ready')throw Error();const controller=new AbortController();controller.abort();assert.equal((await runFigureArtifact(built.value,source,{signal:controller.signal})).status,'cancelled');assert.equal((await runFigureArtifact(built.value,source,{state:{items:Array(33).fill(0),nextId:1},executionAdapter:referenceAdapter})).status,'failed');built.value.manifest.title='Changed after build';assert.equal((await runFigureArtifact(built.value,source,{executionAdapter:referenceAdapter})).status,'failed');
});

test('generated data bindings require exact checked asset bytes and source identity',async()=>{
 const {artifact,source}=await createDynamicSequenceArtifact();
 const asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'points',label:'Authored points fixture',kind:'table',shape:[1,1],coordinates:{system:'Authored rows',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Paperplay reference fixture',rights:'Project-authored'},transformations:[],data:{columns:[{id:'value',label:'Value',type:'number',unit:'index'}],rows:[{id:'row1',values:[1]}]}});
 const bound={...artifact,assetIds:['points'],assetBindings:[{id:'points',kind:'table' as const,sha256:asset.checksum.value}]};
 assert.equal((await buildFigureArtifact(bound,source)).status,'invalid');assert.equal((await buildFigureArtifact(bound,source,{assets:[asset]})).status,'ready');
 assert.equal((await buildFigureArtifact({...bound,assetBindings:[{...bound.assetBindings[0],sha256:'0'.repeat(64)}]},source,{assets:[asset]})).status,'invalid');
 assert.equal((await buildFigureArtifact(bound,source,{assets:[structuredClone(asset)]})).status,'invalid');
});
