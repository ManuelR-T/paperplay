import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument } from '../shared/schema';
import { validateRepresentationPlan } from '../shared/representations';
import { createDefaultStochasticSolver } from '../shared/stochastic';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { representationAdapters,representationRegistry } from '../lib/representations/adapters';
import { createCapabilityRegistry } from '../lib/representations/registry';
import { serializeDataStudy,parseDataStudy } from '../lib/representations/data-study';
import { isRepresentationSelection,representationInputRevision,selectionAnchorIds } from '../shared/representation-selection';
function fixture(){
 const quote='An authored mathematical fixture: four independent entities may disappear at a constant first-order hazard. These are synthetic counts, not measurements.';
 const source=validateDocument({schemaVersion:1,id:'authored-loss-fixture',sourceVersion:'authored-v1',title:'Independent loss fixture',authors:['Paperplay'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'model',kind:'paragraph',page:1,text:quote}],anchors:[{id:'model',blockId:'model',page:1,quote}],extractionWarnings:['Authored engineering fixture, not an original paper experiment.']});
 const plan=validateRepresentationPlan({format:'paperplay-representation',schemaVersion:1,id:'loss-fixture',title:'A bounded loss ensemble',source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:{kind:'prepared',label:'Authored mathematical fixture'},objective:'Inspect seeded replicate counts and separate empirical spread from analytic expectation.',anchors:[{id:'model',blockId:'model',page:1,quote}],claims:[{id:'scope',kind:'pedagogical-addition',text:'Synthetic independent count losses, without measurement uncertainty.',anchorIds:['model']}],assumptions:['Synthetic independent first-order losses at a constant rate.'],requestedEvidence:'simplified-illustration',assets:[],quantities:[],execution:{kind:'local-computation',capabilities:[{id:'stochastic-ssa',version:'1.0.0'}],assetIds:[]},interactions:['widget-controls','select-time','inspect-data','return-source'],views:[{id:'population',kind:'stochastic',stochastic:{title:'Seeded losses',anchorIds:['model'],request:{format:'paperplay-stochastic',schemaVersion:1,model:{id:'pure-death',initial:4,countUnit:'count',rate:{value:1,per:'s',role:'per-item-hazard'}},assumptions:{wellMixed:true,independentEntities:true,constantRates:true,description:'Synthetic independent entities with constant first-order loss.'},interval:{start:0,end:Math.LN2,unit:'s'},replicates:16,observationCount:8,random:{seed:'42',sequence:'54'},solver:createDefaultStochasticSolver()}}}]},source);
 return {source,plan};
}
test('stochastic behavior routes through the existing local lifecycle without granting scientific evidence',async()=>{
 const {source,plan}=fixture(),selected=representationRegistry.select({behaviors:['stochastic-events'],assetKinds:[],interactions:['select-time'],inputBytes:1000,requestedEvidence:'experiment-reproduction'},{facilities:['trusted-computation'],offline:true});assert.deepEqual(selected.candidates.map(x=>x.id),['stochastic-ssa']);assert.ok(selected.gaps.some(x=>x.kind==='evidence'));
 assert.equal(buildRepresentation(plan,source,{environment:{facilities:[],offline:true}}).status,'unsupported');
 const built=buildRepresentation(plan,source);if(built.status!=='ready')throw Error(built.reason);const run=await executeRepresentation(built.value,source);assert.equal(run.status,'ready');if(run.status!=='ready')throw Error('Expected a local stochastic run');const view=run.value.views[0];assert.equal(view.kind,'stochastic');if(view.kind!=='stochastic')throw Error();assert.equal(view.result.status,'completed');assert.equal(view.result.replicates.length,16);assert.equal(run.value.evidence.verified,false);
});
test('stochastic plans require exact source anchors, assumptions and local computation',()=>{
 const {source,plan}=fixture(),view=plan.views[0];if(view.kind!=='stochastic')throw Error();const bad=structuredClone(plan);if(bad.views[0].kind!=='stochastic')throw Error();bad.views[0].stochastic.anchorIds=['absent'];assert.throws(()=>validateRepresentationPlan(bad,source),/undeclared/);
 assert.throws(()=>validateRepresentationPlan({...plan,execution:{...plan.execution,kind:'none'}},source),/local computation/);assert.throws(()=>validateRepresentationPlan({...plan,views:[{...view,stochastic:{...view.stochastic,request:{...view.stochastic.request,assumptions:undefined}}}]},source));
});
test('physical-time selections export and become stale when seed or count inputs change',async()=>{
 const {source,plan}=fixture(),selection={kind:'time' as const,viewId:'population',scopeId:'stochastic',frameId:null,value:.25,unit:'s',mode:'physical-time' as const};assert.ok(isRepresentationSelection(plan,selection));assert.equal(isRepresentationSelection(plan,{...selection,value:5}),false);assert.deepEqual(selectionAnchorIds(plan,[selection]),['model']);const saved={...plan,navigation:{format:'paperplay-semantic-navigation' as const,schemaVersion:1 as const,revision:representationInputRevision(plan),selections:[selection]}};const reopened=await parseDataStudy(serializeDataStudy(source,saved));assert.deepEqual(reopened.plan.navigation,saved.navigation);
 const changed=structuredClone(saved);if(changed.views[0].kind!=='stochastic')throw Error();changed.views[0].stochastic.request.random.seed='43';assert.throws(()=>validateRepresentationPlan(changed,source),/Saved selections/);
});
test('registered stochastic adapters cannot substitute a different seed/result request',async()=>{
 const {source,plan}=fixture(),original=representationAdapters.find(x=>x.descriptor.id==='stochastic-ssa')!;
 const registry=createCapabilityRegistry([{...original,execute:async(view,context)=>{const result=await original.execute(view,context);if(result.kind!=='stochastic')throw Error();result.result.request.random.seed='999';return result;}}]);const built=buildRepresentation(plan,source,{registry});if(built.status!=='ready')throw Error(built.reason);assert.equal((await executeRepresentation(built.value,source,{registry})).status,'failed');
});

test('authored loss and development biology examples retain source mapping, assumptions and portable seeds',async()=>{
 const {createStochasticExample,STOCHASTIC_EXAMPLE_IDS}=await import('../lib/representations/stochastic-examples');
 for(const id of STOCHASTIC_EXAMPLE_IDS){const study=createStochasticExample(id),restored=await parseDataStudy(serializeDataStudy(study.source,study.plan));assert.deepEqual(restored.plan,study.plan);const view=study.plan.views[0];if(view.kind!=='stochastic')throw Error();assert.equal(view.stochastic.request.random.seed,'42');assert.ok(view.stochastic.request.assumptions.description.length>16);if(id==='two-state-pool'){assert.ok(study.source.extractionWarnings.some(x=>x.includes('518')&&x.includes('(7)')));assert.ok(study.plan.objective.includes('does not compute'));assert.ok(study.plan.claims.some(x=>x.kind==='pedagogical-addition'));}const built=buildRepresentation(study.plan,study.source);if(built.status!=='ready')throw Error(built.reason);const run=await executeRepresentation(built.value,study.source);assert.equal(run.status,'ready');if(run.status==='ready'){assert.equal(run.value.evidence.verified,false);const executed=run.value.views[0];if(executed.kind!=='stochastic')throw Error();assert.equal(executed.result.status,'completed');}}
});
