import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComposedScene, sceneMarks } from '../shared/composed-scene';
import { stableSceneBounds, sceneLayout, diagnoseScene, measureSceneText } from '../lib/scenes/layout';
import { createComposedGuide } from '../lib/representations/composed-guide';
import { validateRepresentationPlan } from '../shared/representations';
import { preparedPapers } from '../data/papers';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { representationRegistry } from '../lib/representations/adapters';
const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
function fixture(){const plan=createComposedGuide(source,block.id);const view=plan.views[0];assert.equal(view.kind,'composed-scene');if(view.kind!=='composed-scene')throw Error('Expected composed fixture');const scene=view.scene.nodes.find(n=>n.kind==='scene')!;return {plan,view,scene};}
test('biology, physics and algorithm examples use one composed layout and execution contract',async()=>{
 for(const [title,labels]of [['Illustrative biological process',['Cell before stimulus','Signal propagation','Cell response']],['Illustrative physical scene',['Initial particle','Intermediate position','Final position']],['Illustrative algorithm diagram',['Input state','Transition','Output state']]] as const){
   const {plan,scene}=fixture();scene.title=title;scene.marks=[{id:'group',kind:'repeat',label:'Explicitly illustrative objects',color:'green',items:labels.map((label,index)=>({id:['first','second','third'][index],label,x:index,y:index%2,value:index,unit:'illustrative units'}))}];
   const built=buildRepresentation(plan,source,{environment:{facilities:[],offline:true}});assert.equal(built.status,'ready');if(built.status!=='ready')continue;
   const run=await executeRepresentation(built.value,source,{environment:{facilities:[],offline:true}});assert.equal(run.status,'ready');if(run.status==='ready')assert.equal(run.value.evidence.verified,false);
 }
 const selected=representationRegistry.select({behaviors:['composed-layout'],assetKinds:[],interactions:['select-step'],inputBytes:100,requestedEvidence:'illustration'},{facilities:[],offline:true});assert.equal(selected.candidates[0].id,'composed-scene');
});
test('scientific coordinates remain independent of layout pixels and frame extents are stable',()=>{
 const {scene}=fixture(),original=structuredClone(scene),before=stableSceneBounds(scene),initial=sceneLayout(scene,-1),after=sceneLayout(scene,0);
 assert.deepEqual(initial.bounds,after.bounds);assert.deepEqual(before,stableSceneBounds(scene));assert.deepEqual(scene,original);
 assert.equal(initial.marks.find(m=>m.id==='second')!.y,1);assert.equal(after.marks.find(m=>m.id==='second')!.y,2);
 assert.equal(initial.marks.find(m=>m.id==='first')!.screenX,after.marks.find(m=>m.id==='first')!.screenX);
 for(const mark of [...initial.marks,...after.marks]){assert.ok(mark.screenX>=0&&mark.screenX<=initial.width);assert.ok(mark.screenY>=0&&mark.screenY<=initial.height);}
 assert.ok(measureSceneText('Full long scientific label',20,2).width>measureSceneText('Full long scientific label',16).width);
});
test('collisions are diagnosed across all frames and hidden marks retain full numerical equivalents',()=>{
 const {scene}=fixture();scene.frames[0].changes=[{markId:'second',x:0,y:0},{markId:'third',x:2,y:0,visible:false}];
 assert.ok(diagnoseScene(scene).some(c=>c.frame==='move'&&c.first==='first'&&c.second==='second'));
 const current=sceneLayout(scene,0);assert.equal(current.marks.length,3);assert.equal(current.marks.find(m=>m.id==='third')!.visible,false);
 assert.equal(sceneMarks(scene).length,3);
});
test('layouts reject cycles, excessive depth, unreachable nodes and unbounded repeated marks',()=>{
 const {view}=fixture();const cycle=structuredClone(view.scene);cycle.nodes[0]={id:'root',kind:'row',children:['root']};assert.throws(()=>validateComposedScene(cycle),/tree/);
 const deep=structuredClone(view.scene);deep.rootId='n1';deep.nodes=Array.from({length:6},(_,i)=>i===5?{id:`n${i+1}`,kind:'text' as const,text:'Leaf'}:{id:`n${i+1}`,kind:'row' as const,children:[`n${i+2}`]});assert.throws(()=>validateComposedScene(deep),/nesting/);
 const unused=structuredClone(view.scene);unused.nodes.push({id:'unused',kind:'text',text:'Unreachable'});assert.throws(()=>validateComposedScene(unused),/unreachable/);
 const duplicate=structuredClone(view.scene);duplicate.nodes.push(duplicate.nodes[0]);assert.throws(()=>validateComposedScene(duplicate),/Duplicate/);
 const {scene}=fixture();scene.marks=[{kind:'repeat',id:'many',label:'Many',color:'blue',items:Array.from({length:65},(_,i)=>({id:`item-${i}`,label:'Item',x:i,y:0}))}];const over=structuredClone(view.scene);over.nodes=over.nodes.map(n=>n.kind==='scene'?scene:n);assert.throws(()=>validateComposedScene(over));
});
test('source annotations require exact source text and frames cannot invent unknown object identities',()=>{
 const {plan,view,scene}=fixture();const annotation=view.scene.nodes.find(n=>n.kind==='annotation')!;annotation.text='A model-invented interpretation misrepresented as source quotation.';assert.throws(()=>validateRepresentationPlan(plan,source),/must quote/);
 annotation.role='added-assumption';assert.doesNotThrow(()=>validateRepresentationPlan(plan,source));
 annotation.anchorIds=['missing'];assert.throws(()=>validateRepresentationPlan(plan,source),/declared source anchors/);
 scene.frames[0].changes[0].markId='unknown';assert.throws(()=>validateComposedScene(view.scene),/source anchors|existing mark/);
});
