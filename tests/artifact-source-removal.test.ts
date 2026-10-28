import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { enrichmentFingerprint } from '../lib/enrichment/state';
import { emptyGenerationState,generationStorageKey,serializeGenerationState } from '../lib/artifacts/generation-state';
import { checkPendingSourcePlans,forgetSourceWidgets } from '../lib/experiments/source-removal';
import { createArtifactExperimentStorage } from '../lib/artifacts/experiment-storage';
import { artifactExperimentOwner,createArtifactExperimentIdentity,createArtifactCacheRecord } from '../shared/artifact-experiment';
function memoryStorage():Storage{const values=new Map<string,string>();return {get length(){return values.size;},getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);},clear:()=>values.clear(),key:index=>[...values.keys()][index]??null};}
async function pending(status:'prepared'|'queued'|'analyzing'|'cancelled'){const {source}=await createDynamicSequenceArtifact(),fingerprint=await enrichmentFingerprint(source),state=emptyGenerationState(fingerprint,'section-0'),run={runId:crypto.randomUUID(),token:'signed-fixture',model:'fixture',createdAt:1,deadlineAt:300001};state.run=run;state.pending={attempt:1};state.reply={status,run,budget:{maxAttempts:1,attemptsClaimed:1,maxReservedTokens:666000,reservedTokens:222000,maxOutputTokensPerAttempt:6000,maxInputCharactersPerAttempt:50000}};const storage=memoryStorage();storage.setItem(generationStorageKey(source,fingerprint),serializeGenerationState(state));return {source,fingerprint,storage};}
test('accepted generated jobs prevent source removal without cancelling or deleting recovery context',async()=>{for(const status of ['queued','analyzing'] as const){const {source,fingerprint,storage}=await pending(status),key=generationStorageKey(source,fingerprint),original=storage.getItem(key);await assert.rejects(()=>checkPendingSourcePlans(source,storage),/accepted generated figure/);assert.equal(storage.getItem(key),original);}});
test('uncertain and best-effort cancelled generated submissions retain the existing explicit-removal warning policy',async()=>{for(const status of ['prepared','cancelled'] as const){const {source,storage}=await pending(status);assert.deepEqual(await checkPendingSourcePlans(source,storage),{uncertain:true});}});
test('source cleanup removes only its cache ownership, retains shared originals and pending generated references',async()=>{const {source,artifact}=await createDynamicSequenceArtifact(),identity=await createArtifactExperimentIdentity({source,artifact}),record=await createArtifactCacheRecord('plan',identity,{artifact}),experiments=createArtifactExperimentStorage({indexedDB:new IDBFactory(),name:'source-removal-fixture'}),owner=artifactExperimentOwner(identity),sharedOwner='another-paper:another-owner';await experiments.put(record,owner,{accepted:true});await experiments.put(record,sharedOwner,{accepted:true});const local=memoryStorage(),generatedKey=`paperplay:generated-figures:v1:${source.id}:pending-fixture`;local.setItem(`paperplay:widgets:v2:${source.id}:settings`,'owned');local.setItem('paperplay:widgets:v2:another-paper:settings','unrelated');local.setItem(generatedKey,'unknown or pending original');await forgetSourceWidgets(source.id,local,experiments);assert.equal((await experiments.list(owner)).length,0);assert.equal((await experiments.list(sharedOwner)).length,1);assert.equal(local.getItem(`paperplay:widgets:v2:${source.id}:settings`),null);assert.equal(local.getItem('paperplay:widgets:v2:another-paper:settings'),'unrelated');assert.equal(local.getItem(generatedKey),'unknown or pending original');});

test('automatic pending requests retain exact source and recovery bytes before removal',async()=>{
 const {createAutomaticPaperPipeline,automaticPaperStorageKey}=await import('../lib/automatic/pipeline');
 const {source}=await createDynamicSequenceArtifact(),storage=memoryStorage(),pipeline=await createAutomaticPaperPipeline(source,{storage});
 const state=pipeline.getSnapshot(),key=automaticPaperStorageKey(source,state.fingerprint);
 const pending={...state,status:'blocked',pending:{kind:'plan',requestId:crypto.randomUUID(),sectionId:state.sectionIds[0]}};
 storage.setItem(key,JSON.stringify(pending));const original=storage.getItem(key);
 await assert.rejects(()=>checkPendingSourcePlans(source,storage),/unresolved automatic figure request/);
 assert.equal(storage.getItem(key),original);pipeline.dispose();
});

test('source cleanup removes settled automatic figures but retains pending, corrupt and unrelated records',async()=>{
 const {createAutomaticPaperPipeline,automaticPaperStorageKey}=await import('../lib/automatic/pipeline');
 const {source}=await createDynamicSequenceArtifact(),storage=memoryStorage(),pipeline=await createAutomaticPaperPipeline(source,{storage});
 const state=pipeline.getSnapshot(),key=automaticPaperStorageKey(source,state.fingerprint),pendingKey=key+'-pending',corruptKey=key+'-corrupt',unrelated='paperplay:automatic:v1:unrelated:original';
 storage.setItem(key,JSON.stringify({...state,status:'complete'}));storage.setItem(pendingKey,JSON.stringify({...state,pending:{kind:'plan',requestId:crypto.randomUUID(),sectionId:state.sectionIds[0]}}));storage.setItem(corruptKey,'unreadable original');storage.setItem(unrelated,'unrelated');
 const experiments=createArtifactExperimentStorage({indexedDB:new IDBFactory(),name:'automatic-source-cleanup'});
 await forgetSourceWidgets(source.id,storage,experiments);
 assert.equal(storage.getItem(key),null);assert.ok(storage.getItem(pendingKey));assert.equal(storage.getItem(corruptKey),'unreadable original');assert.equal(storage.getItem(unrelated),'unrelated');pipeline.dispose();
});
