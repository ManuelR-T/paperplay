import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../shared/schema';
import {validateRepresentationPlan} from '../shared/representations';
import {createDefaultDiscreteLimits,type DiscreteRequest} from '../shared/discrete-algorithms';
import {isRepresentationSelection,representationInputRevision,selectionAnchorIds} from '../shared/representation-selection';
import {buildRepresentation,executeRepresentation} from '../lib/representations/lifecycle';
import {representationAdapters} from '../lib/representations/adapters';
import {createCapabilityRegistry} from '../lib/representations/registry';
import {serializeDataStudy,parseDataStudy} from '../lib/representations/data-study';
import {runDiscrete} from '../lib/discrete/solver';
import {validateDiscreteNavigation} from '../lib/discrete/navigation';
import {createSemanticSelectionStore} from '../lib/interactions/selection-store';

function fixture(){
 const quote='Authored collection fixture: make two distinct elements, merge their sets, then query one representative. These commands are a teaching input, not an original-paper experiment.';
 const source=validateDocument({schemaVersion:1,id:'authored-discrete-fixture',sourceVersion:'authored-v1',title:'An evolving parent forest',authors:['Paperplay'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'algorithm',kind:'paragraph',page:1,text:quote}],anchors:[{id:'algorithm',blockId:'algorithm',page:1,quote}],extractionWarnings:['Authored explanation and synthetic command input.']});
 const request:DiscreteRequest={format:'paperplay-discrete-request',schemaVersion:1,model:'union-find',commands:[{id:'make-a',kind:'make',element:{id:'a',label:'Same label'}},{id:'make-b',kind:'make',element:{id:'b',label:'Same label'}},{id:'join',kind:'union',a:'a',b:'b'},{id:'query',kind:'find',elementId:'b'}],limits:createDefaultDiscreteLimits()};
 const plan=validateRepresentationPlan({format:'paperplay-representation',schemaVersion:1,id:'discrete-fixture',title:'Source-linked growing collections',source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:{kind:'prepared',label:'Authored mathematical example'},objective:'Inspect stable identities, changing parents and explicit command completion.',anchors:[{id:'algorithm',blockId:'algorithm',page:1,quote}],claims:[{id:'scope',kind:'pedagogical-addition',text:'Application-owned teaching execution; no source benchmark reproduction.',anchorIds:['algorithm']}],assumptions:['Union by size with full path compression; input commands are synthetic.'],requestedEvidence:'simplified-illustration',assets:[],quantities:[],execution:{kind:'local-computation',capabilities:[{id:'discrete-collections',version:'1.0.0'}],assetIds:[]},interactions:['widget-controls','select-time','select-entity','inspect-data','return-source'],views:[{id:'trace',kind:'discrete-trace',discrete:{title:'Two equal labels, distinct identities',anchorIds:['algorithm'],request}}]},source);
 return {source,plan,request};
}
test('discrete collections use the generic lifecycle and portable study without claiming scientific verification',async()=>{
 const {source,plan}=fixture(),built=buildRepresentation(plan,source);if(built.status!=='ready')throw Error(built.reason);
 const run=await executeRepresentation(built.value,source);assert.equal(run.status,'ready');if(run.status!=='ready')throw Error('Discrete fixture did not execute');assert.equal(run.value.evidence.verified,false);
 const view=run.value.views[0];if(view.kind!=='discrete-trace')throw Error();assert.equal(view.result.outcome,'commands-complete');const last=view.result.frames.at(-1)!;assert.equal(last.state.kind,'union-find');
 const selections=[{kind:'time' as const,viewId:'trace',scopeId:'discrete',frameId:null,unit:'frame',mode:'authored-step' as const,value:last.step},{kind:'entity' as const,viewId:'trace',scopeId:'discrete',entityId:'b'}];
 const saved=validateRepresentationPlan({...plan,navigation:{format:'paperplay-semantic-navigation',schemaVersion:1,revision:representationInputRevision(plan),selections}},source);
 validateDiscreteNavigation(view.result,saved.navigation!.selections,'trace');assert.deepEqual(selectionAnchorIds(saved,selections),['algorithm']);assert.deepEqual((await parseDataStudy(serializeDataStudy(source,saved))).plan,saved);
 const noWorker=buildRepresentation(plan,source,{environment:{facilities:[],offline:true}});assert.equal(noWorker.status,'unsupported');
});
test('a saved entity or step must exist in its current retained trace, including after rewinding before creation',()=>{
 const {plan,request}=fixture(),result=runDiscrete(request),entity={kind:'entity' as const,viewId:'trace',scopeId:'discrete',entityId:'b'},initial={kind:'time' as const,viewId:'trace',scopeId:'discrete',frameId:null,unit:'frame',mode:'authored-step' as const,value:0};
 assert.equal(isRepresentationSelection(plan,entity),true);assert.throws(()=>validateDiscreteNavigation(result,[initial,entity],'trace'),/unavailable at/);assert.throws(()=>validateDiscreteNavigation(result,[{...initial,value:result.frames.length}],'trace'),/not in the retained trace/);assert.equal(isRepresentationSelection(plan,{...entity,entityId:'unknown'}),false);
 const revision=representationInputRevision(plan),store=createSemanticSelectionStore({revision,isValid:s=>isRepresentationSelection(plan,s)}),last={...initial,value:result.frames.length-1};
 store.replaceScope('trace','discrete',[last,entity]);validateDiscreteNavigation(result,store.getSnapshot().selections,'trace');store.replaceScope('trace','discrete',[initial]);validateDiscreteNavigation(result,store.getSnapshot().selections,'trace');store.undo();validateDiscreteNavigation(result,store.getSnapshot().selections,'trace');assert.ok(store.getSnapshot().selections.some(s=>s.kind==='entity'&&s.entityId==='b'));
});
test('substituted discrete request and forged future-entity navigation fail through the approved adapter',async()=>{
 const {source,plan}=fixture(),adapter=representationAdapters.find(x=>x.descriptor.id==='discrete-collections')!;
 const registry=createCapabilityRegistry([{...adapter,execute:async(view,context)=>{const output=await adapter.execute(view,context);if(output.kind==='discrete-trace')output.result.request.limits.maxOperations--;return output;}}]);
 const built=buildRepresentation(plan,source,{registry});if(built.status!=='ready')throw Error(built.reason);assert.equal((await executeRepresentation(built.value,source,{registry})).status,'failed');
 const forged=validateRepresentationPlan({...plan,navigation:{format:'paperplay-semantic-navigation',schemaVersion:1,revision:representationInputRevision(plan),selections:[{kind:'entity',viewId:'trace',scopeId:'discrete',entityId:'b'}]}},source),next=buildRepresentation(forged,source);if(next.status!=='ready')throw Error(next.reason);assert.equal((await executeRepresentation(next.value,source)).status,'failed');
});
test('all editable algorithm examples retain their authored source and exact request across portable studies',async()=>{
 const {createDiscreteExample,DISCRETE_EXAMPLE_IDS}=await import('../lib/representations/discrete-examples');
 for(const id of DISCRETE_EXAMPLE_IDS){const study=createDiscreteExample(id),restored=await parseDataStudy(serializeDataStudy(study.source,study.plan));assert.deepEqual(restored.plan,study.plan);assert.ok(restored.source.extractionWarnings.some(value=>value.includes('Authored teaching')));const built=buildRepresentation(restored.plan,restored.source);if(built.status!=='ready')throw Error(built.reason);const outcome=await executeRepresentation(built.value,restored.source);assert.equal(outcome.status,'ready');if(outcome.status!=='ready')throw Error('Discrete example did not execute');const trace=outcome.value.views[0];if(trace.kind!=='discrete-trace')throw Error();assert.equal(trace.result.status,'completed');assert.equal(trace.result.outcome,id==='dag'?'topological-order':id==='cycle-tail'?'cycle-blocked-remainder':'commands-complete');assert.equal(outcome.value.evidence.verified,false);}
});
