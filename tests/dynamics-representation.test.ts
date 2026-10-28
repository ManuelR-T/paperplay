import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDynamicsSolver } from '../shared/dynamics';
import { preparedPapers } from '../data/papers';
import { createSourceGuide } from '../lib/representations/source-guide';
import { validateRepresentationPlan } from '../shared/representations';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { representationAdapters,representationRegistry } from '../lib/representations/adapters';
import { createCapabilityRegistry } from '../lib/representations/registry';
import { serializeDataStudy,parseDataStudy } from '../lib/representations/data-study';
import { isRepresentationSelection,representationInputRevision,selectionAnchorIds } from '../shared/representation-selection';
function fixture(){
 const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
 const guide=createSourceGuide(source,block.id);
 // Deliberately an authored engineering example, not a model extracted from this algorithm paper.
 const plan=validateRepresentationPlan({...guide,title:'Authored decay example',execution:{kind:'local-computation',capabilities:[{id:'ode-rk4',version:'1.0.0'}],assetIds:[]},interactions:['widget-controls','inspect-data','return-source'],views:[{id:'dynamics',kind:'dynamics',dynamics:{title:'Independent authored scalar example',anchorIds:[guide.anchors[0].id],request:{format:'paperplay-dynamics',schemaVersion:1,model:{id:'decay',initial:{value:4,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'}},interval:{start:0,end:Math.LN2,unit:'s'},solver:createDefaultDynamicsSolver([{value:1e-9,unit:'1'}])}}}]},source);
 return {source,plan};
}
test('dynamics uses the approved generic lifecycle, local behavior discovery and honest evidence',async()=>{
 const {source,plan}=fixture();
 const selected=representationRegistry.select({behaviors:['ode-integration'],assetKinds:[],interactions:['widget-controls'],inputBytes:1000,requestedEvidence:'mechanism-reproduction'},{facilities:['trusted-computation'],offline:true});
 assert.deepEqual(selected.candidates.map(c=>c.id),['ode-rk4']);assert.ok(selected.gaps.some(g=>g.kind==='evidence'));
 assert.equal(buildRepresentation(plan,source,{environment:{facilities:[],offline:true}}).status,'unsupported');
 const built=buildRepresentation(plan,source);assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();
 const result=await executeRepresentation(built.value,source);assert.equal(result.status,'ready');if(result.status!=='ready')throw Error('Expected ready dynamics result');
 const view=result.value.views[0];assert.equal(view.kind,'dynamics');if(view.kind!=='dynamics')throw Error();assert.equal(view.result.status,'completed');assert.ok(Math.abs(view.result.samples.at(-1)!.state[0]-2)<1e-5);assert.equal(result.value.evidence.verified,false);
});
test('dynamics source bindings and local-execution declarations cannot be omitted',()=>{
 const {source,plan}=fixture();const wrong=structuredClone(plan);if(wrong.views[0].kind!=='dynamics')throw Error();wrong.views[0].dynamics.anchorIds=['missing'];assert.throws(()=>validateRepresentationPlan(wrong,source),/undeclared/);
 assert.throws(()=>validateRepresentationPlan({...plan,execution:{...plan.execution,kind:'none'}},source),/local computation/);
});
test('physical-time selection survives portable export and becomes stale after parameter changes',async()=>{
 const {source,plan}=fixture(),selection={kind:'time' as const,viewId:'dynamics',scopeId:'dynamics',frameId:null,value:.25,unit:'s',mode:'physical-time' as const};assert.ok(isRepresentationSelection(plan,selection));assert.equal(isRepresentationSelection(plan,{...selection,value:5}),false);assert.equal(isRepresentationSelection(plan,{...selection,unit:'ms'}),false);assert.deepEqual(selectionAnchorIds(plan,[selection]),[plan.anchors[0].id]);
 const saved={...plan,navigation:{format:'paperplay-semantic-navigation' as const,schemaVersion:1 as const,revision:representationInputRevision(plan),selections:[selection]}};
 const restored=await parseDataStudy(serializeDataStudy(source,saved));assert.deepEqual(restored.plan.navigation,saved.navigation);
 const changed=structuredClone(saved);if(changed.views[0].kind!=='dynamics')throw Error();changed.views[0].dynamics.request.interval.end=2;assert.throws(()=>validateRepresentationPlan(changed,source),/Saved selections/);
});
test('an adapter cannot substitute dynamics request/result bindings',async()=>{
 const {source,plan}=fixture(),original=representationAdapters.find(a=>a.descriptor.id==='ode-rk4')!;
 const registry=createCapabilityRegistry([{...original,execute:async(view,context)=>{const out=await original.execute(view,context);if(out.kind!=='dynamics')throw Error();out.result.request.interval.end=999;return out;}}]);
 const built=buildRepresentation(plan,source,{registry});if(built.status!=='ready')throw Error(built.reason);assert.equal((await executeRepresentation(built.value,source,{registry})).status,'failed');
});

test('all authored dynamics examples round-trip through source-linked data studies',async()=>{
 const {createDynamicsExample,DYNAMICS_EXAMPLE_IDS}=await import('../lib/representations/dynamics-examples');
 for(const id of DYNAMICS_EXAMPLE_IDS){const study=createDynamicsExample(id),restored=await parseDataStudy(serializeDataStudy(study.source,study.plan));assert.deepEqual(restored.plan,study.plan);assert.ok(study.source.extractionWarnings.some(text=>text.includes('authored')));const built=buildRepresentation(study.plan,study.source);if(built.status!=='ready')throw Error(built.reason);const result=await executeRepresentation(built.value,study.source);assert.equal(result.status,'ready');if(result.status==='ready'){const view=result.value.views[0];assert.equal(view.kind,'dynamics');if(view.kind==='dynamics')assert.equal(view.result.status,'completed');}}
});
