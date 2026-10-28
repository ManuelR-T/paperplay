import test from 'node:test';
import assert from 'node:assert/strict';
import { processExamples } from '../data/process-examples';
import { validateProcessNetwork } from '../shared/process-networks';
import { representationFromProcess } from '../lib/representations/process-guide';
import { processScene } from '../lib/scenes/process-layout';
import { sceneLayout,diagnoseScene,directedConnection } from '../lib/scenes/layout';
import { validateComposedScene } from '../shared/composed-scene';
import { isRepresentationSelection,selectionAnchorIds } from '../shared/representation-selection';
import { representationRegistry } from '../lib/representations/adapters';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { preparedPapers } from '../data/papers';
const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
test('a biological pathway and algorithm state machine compile to the same structural renderer and offline lifecycle',async()=>{
 for(const example of Object.values(processExamples)){
   const plan=representationFromProcess(example,source,block.id),view=plan.views[0];assert.equal(view.kind,'composed-scene');if(view.kind!=='composed-scene')throw Error();
   assert.doesNotThrow(()=>validateComposedScene(view.scene,['passage']));
   const scene=processScene(example),initial=sceneLayout(scene,-1),first=sceneLayout(scene,0);assert.deepEqual(initial.bounds,first.bounds);assert.equal(diagnoseScene(scene).length,0);assert.ok(first.marks.some(mark=>mark.active));
   assert.equal(scene.relationships.length,example.relationships.length);assert.equal(scene.frames.length,example.steps.length);
   const built=buildRepresentation(plan,source,{environment:{facilities:[],offline:true}});assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();assert.equal((await executeRepresentation(built.value,source,{environment:{facilities:[],offline:true}})).status,'ready');
   assert.ok(isRepresentationSelection(plan,{kind:'entity',viewId:'composition',scopeId:'composition',entityId:example.entities[0].id}));
   const time={kind:'time' as const,viewId:'composition',scopeId:example.id,frameId:example.steps[0].id,value:0,unit:'walkthrough-step',mode:'authored-step' as const};assert.ok(isRepresentationSelection(plan,time));assert.deepEqual(selectionAnchorIds(plan,[time]),['passage']);
 }
 assert.equal(representationRegistry.select({behaviors:['process-network'],assetKinds:[],interactions:['select-entity'],inputBytes:100,requestedEvidence:'illustration'}).candidates[0].id,'composed-scene');
});
test('causal meaning and declared reaction rates require explicit conditions and source or assumption support',()=>{
 const sourceExample=structuredClone(processExamples['biological-process']);assert.equal(sourceExample.relationships[0].meaning,'causal');assert.ok(sourceExample.relationships[0].support.conditions.length);
 const missing=structuredClone(sourceExample);delete (missing.relationships[0] as {support?:unknown}).support;assert.throws(()=>validateProcessNetwork(missing,['passage']));
 const noConditions=structuredClone(sourceExample);noConditions.relationships[0].support.conditions=[];assert.throws(()=>validateProcessNetwork(noConditions,['passage']));
 const wrongAnchor=structuredClone(sourceExample);wrongAnchor.relationships[1].rate!.support.anchorIds=['invented'];assert.throws(()=>validateProcessNetwork(wrongAnchor,['passage']),/source anchor/);
 const invalidUnit=structuredClone(sourceExample);(invalidUnit.relationships[1].rate as unknown as {unit:string}).unit='K';assert.throws(()=>validateProcessNetwork(invalidUnit,['passage']));
});
test('authored transitions cannot self-declare computed events, execute guards or invent targets',()=>{
 const machine=structuredClone(processExamples['state-machine']);assert.ok(machine.relationships.every(r=>r.meaning==='transition'));assert.ok(machine.steps.every(s=>s.origin==='authored-walkthrough'));
 const fake=structuredClone(machine);(fake.steps[0] as unknown as {origin:string}).origin='computed-event';assert.throws(()=>validateProcessNetwork(fake,['passage']));
 const multiple=structuredClone(machine);multiple.steps[0].activeEntityIds=['waiting','processing'];assert.throws(()=>validateProcessNetwork(multiple,['passage']),/at most one/);
 const missing=structuredClone(machine);missing.steps[0].activeRelationshipIds=['invented'];assert.throws(()=>validateProcessNetwork(missing,['passage']),/unknown/);
 const reserved=structuredClone(machine);reserved.id='root';assert.doesNotThrow(()=>representationFromProcess(reserved,source,block.id));
 const guard=structuredClone(machine);guard.relationships[0].guard='throw new Error("This is plain explanatory text, never evaluated")';assert.doesNotThrow(()=>validateProcessNetwork(guard,['passage']));assert.ok(processScene(guard).frames.length);
 const over=structuredClone(machine);over.steps=Array.from({length:25},(_,i)=>({...machine.steps[0],id:`step${i}`}));assert.throws(()=>validateProcessNetwork(over,['passage']));
});
test('directed connections remain finite for regular, overlapping and self-loop endpoints',()=>{
 for(const b of [{screenX:100,screenY:50,screenRadius:12},{screenX:0,screenY:0,screenRadius:12}]){
   const result=directedConnection({screenX:0,screenY:0,screenRadius:12},b);assert.ok(result.path.startsWith('M '));assert.ok(!/NaN|Infinity/.test(result.path+result.head));
 }
});
