import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatasetExample,DATASET_EXAMPLE_IDS} from '../lib/representations/dataset-examples';
import {analyzeDatasetStudy,hasDatasetStudyComputation} from '../lib/datasets/model';
import {buildRepresentation,executeRepresentation} from '../lib/representations/lifecycle';
import {representationAdapters} from '../lib/representations/adapters';
import {createCapabilityRegistry} from '../lib/representations/registry';
import {parseDataStudy,serializeDataStudy} from '../lib/representations/data-study';
import {validateRepresentationPlan} from '../shared/representations';
import {isRepresentationSelection,representationInputRevision,selectionAnchorIds} from '../shared/representation-selection';

test('empirical and reported-only studies use the shared lifecycle with exact portable input/source binding',async()=>{
 for(const id of DATASET_EXAMPLE_IDS){
  const study=await createDatasetExample(id),restored=await parseDataStudy(serializeDataStudy(study.source,study.plan));assert.deepEqual(restored.plan,study.plan);const built=buildRepresentation(restored.plan,restored.source,{assets:restored.assets});if(built.status!=='ready')throw Error(built.reason);
  const outcome=await executeRepresentation(built.value,restored.source);if(outcome.status!=='ready')throw Error(outcome.reason);assert.equal(outcome.value.evidence.verified,false);const view=outcome.value.views[0];if(view.kind!=='dataset-study')throw Error();assert.equal(hasDatasetStudyComputation(view.result),true);assert.match(view.result.bindings.source.fingerprint!,/^[a-f0-9]{64}$/);
  if(id==='reported'){assert.equal(view.result.mode,'reported-only');assert.equal(restored.assets.length,0);assert.equal(view.result.bindings.checksum,null);assert.ok(restored.source.extractionWarnings.some(message=>message.includes('521')));}
  else{assert.equal(view.result.mode,'data');if(view.result.mode!=='data')throw Error();assert.equal(view.result.replication.independentN,null);if(id==='biology'){assert.equal(view.result.observations.length,20);assert.equal(view.result.groups.length,2);assert.ok(view.result.replication.sourceNValues.every(value=>value.value===5));}else{assert.equal(view.result.observations.length,12);assert.ok(view.result.observations.every(value=>value.uncertainty?.kind==='source-uncertainty'));}}
 }
});
test('bound dataset selections follow real filtered rows and empty filter arrays have all-rows semantics',async()=>{
 const study=await createDatasetExample('biology'),view=study.plan.views[0];if(view.kind!=='dataset-study'||view.dataset.request.mode!=='data')throw Error();const asset=study.assets[0];if(asset.kind!=='table')throw Error();
 const selected={kind:'entity' as const,viewId:view.id,scopeId:'dataset',entityId:asset.data.rows[0].id};assert.equal(isRepresentationSelection(study.plan,selected,study.assets),true);assert.deepEqual(selectionAnchorIds(study.plan,[selected]),view.dataset.anchorIds);
 const request={...view.dataset.request,selectedGroups:[],selectedRowIds:[]},all=validateRepresentationPlan({...study.plan,views:[{...view,dataset:{...view.dataset,request}}]},study.source);assert.equal(isRepresentationSelection(all,selected,study.assets),true);
 const groupIndex=asset.data.columns.findIndex(column=>column.id===request.groupColumn),other=asset.data.rows.find(row=>row.values[groupIndex]!==asset.data.rows[0].values[groupIndex])!.values[groupIndex] as string;
 const filtered=validateRepresentationPlan({...all,views:[{...view,dataset:{...view.dataset,request:{...request,selectedGroups:[other]}}}]},study.source);assert.equal(isRepresentationSelection(filtered,selected,study.assets),false);
 const saved=validateRepresentationPlan({...all,navigation:{format:'paperplay-semantic-navigation',schemaVersion:1,revision:representationInputRevision(all),selections:[selected]}},study.source);assert.deepEqual((await parseDataStudy(serializeDataStudy(study.source,saved))).plan.navigation,saved.navigation);
 assert.notEqual(representationInputRevision(all),representationInputRevision(filtered));
});
test('an imported result cannot restore a computation receipt or substitute different same-version source content',async()=>{
 const study=await createDatasetExample('biology'),view=study.plan.views[0];if(view.kind!=='dataset-study')throw Error();const result=await analyzeDatasetStudy(view.dataset.request,study.assets,study.source),original=representationAdapters.find(adapter=>adapter.descriptor.id==='dataset-exploration')!;
 const copy=structuredClone(result);assert.equal(hasDatasetStudyComputation(copy),false);
 const copiedRegistry=createCapabilityRegistry([{...original,execute:async()=>({...view,result:copy})}]),copied=buildRepresentation(study.plan,study.source,{assets:study.assets,registry:copiedRegistry});if(copied.status!=='ready')throw Error(copied.reason);assert.equal((await executeRepresentation(copied.value,study.source,{registry:copiedRegistry})).status,'failed');
 const changed=structuredClone(study.source);changed.title+=' Changed content';const staleRegistry=createCapabilityRegistry([{...original,execute:async()=>({...view,result})}]),stale=buildRepresentation(study.plan,changed,{assets:study.assets,registry:staleRegistry});if(stale.status!=='ready')throw Error(stale.reason);assert.equal((await executeRepresentation(stale.value,changed,{registry:staleRegistry})).status,'failed');
});
