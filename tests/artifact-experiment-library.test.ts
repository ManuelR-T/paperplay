import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { createArtifactExperimentStorage } from '../lib/artifacts/experiment-storage';
import { saveArtifactExperiment,listSavedArtifactExperiments,removeSavedArtifactExperiment } from '../lib/artifacts/experiment-library';
import { createArtifactCacheRecord,createArtifactExperimentIdentity,artifactExperimentOwner } from '../shared/artifact-experiment';
import { sealScientificAsset,hasCheckedAssetIntegrity } from '../lib/assets/local';
import { createArtifactExperimentBundle } from '../lib/artifacts/experiment-bundle';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { sha256Text } from '../lib/artifacts/sdk-source';

test('only explicit Save enters generic accepted library; reopen retains exact manifest/seed without invented plan',async()=>{
  const f=await createDynamicSequenceArtifact(),indexedDB=new IDBFactory(),storage=createArtifactExperimentStorage({indexedDB}),identity=await createArtifactExperimentIdentity(f);
  const unaccepted=await createArtifactCacheRecord('plan',identity,{artifact:f.artifact});await storage.put(unaccepted,artifactExperimentOwner(identity));assert.deepEqual(await listSavedArtifactExperiments(f.source,{storage}),[]);
  const saved=await saveArtifactExperiment({...f,seed:123,storage});const reopened=createArtifactExperimentStorage({indexedDB});const items=await listSavedArtifactExperiments(f.source,{storage:reopened});assert.equal(items.length,1);assert.equal(items[0].id,saved.id);assert.equal(items[0].seed,123);assert.deepEqual(items[0].artifact,f.artifact);assert.equal((saved.payload as Record<string,unknown>).plan,undefined);
});
test('explicit settings update replaces the same accepted artifact owner instead of accumulating protected records',async()=>{
  const f=await createDynamicSequenceArtifact(),storage=createArtifactExperimentStorage({indexedDB:new IDBFactory(),maxEntries:1});await saveArtifactExperiment({...f,seed:1,storage});const last=await saveArtifactExperiment({...f,seed:2,storage});const list=await listSavedArtifactExperiments(f.source,{storage});assert.equal(list.length,1);assert.equal(list[0].seed,2);assert.equal(list[0].id,last.id);assert.equal((await storage.list()).length,1);
});
test('source fingerprint gates library listing/removal and removes only the matching explicit item',async()=>{
  const f=await createDynamicSequenceArtifact(),storage=createArtifactExperimentStorage({indexedDB:new IDBFactory()});const saved=await saveArtifactExperiment({...f,storage});const other={...f.source,title:'Other source bytes'};assert.deepEqual(await listSavedArtifactExperiments(other,{storage}),[]);await assert.rejects(removeSavedArtifactExperiment(saved.id,other,{storage}),/exact current source/);assert.equal((await listSavedArtifactExperiments(f.source,{storage})).length,1);await removeSavedArtifactExperiment(saved.id,f.source,{storage});assert.equal((await listSavedArtifactExperiments(f.source,{storage})).length,0);
});
test('local bound assets persist only on explicit Save and rehydrate integrity on reopen; default bundles omit registry attachments',async()=>{
  const f=await createDynamicSequenceArtifact(),asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'data',kind:'tensor',label:'Private local fixture',shape:[1],coordinates:{system:'Synthetic',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Test author',rights:'ISC fixture'},transformations:[],data:{values:[919191]}});
  f.artifact.assetIds=['data'];f.artifact.assetBindings=[{id:'data',kind:'tensor',sha256:asset.checksum.value}];f.artifact.interfaces.input=[{id:'assets',kind:'object',description:'Exact local data'}];const storage=createArtifactExperimentStorage({indexedDB:new IDBFactory()});const record=await saveArtifactExperiment({...f,assets:[asset],storage});const items=await listSavedArtifactExperiments(f.source,{storage});assert.equal(items.length,1);assert.equal(hasCheckedAssetIntegrity(items[0].assets[0]),true);assert.equal(JSON.stringify(items[0].input).includes('919191'),true);
  const bundle=await createArtifactExperimentBundle({...f,records:[record],input:items[0].input,assets:items[0].assets});assert.equal(bundle.includes('919191'),false);assert.equal(JSON.parse(bundle).records.length,0);assert.deepEqual(JSON.parse(bundle).assets,[]);
});
test('corrupt accepted originals remain exportable and are not replaced while saving a fresh valid configuration',async()=>{
  const f=await createDynamicSequenceArtifact(),indexedDB=new IDBFactory(),name='library-corrupt-original',storage=createArtifactExperimentStorage({indexedDB,name});const first=await saveArtifactExperiment({...f,storage});
  await new Promise<void>((resolve,reject)=>{const req=indexedDB.open(name,1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),get=store.get(first.id);get.onsuccess=()=>store.put({...get.result,record:{...first,schemaVersion:99}});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
  assert.deepEqual(await listSavedArtifactExperiments(f.source,{storage}),[]);assert.equal(JSON.parse((await storage.exportOriginal(first.id))!).schemaVersion,99);await saveArtifactExperiment({...f,seed:11,storage});assert.equal(JSON.parse((await storage.exportOriginal(first.id))!).schemaVersion,99);assert.equal((await listSavedArtifactExperiments(f.source,{storage}))[0].seed,11);
});
test('accepted read-only recorded evidence survives reopen without entering execution caches',async()=>{
  const f=await createDynamicSequenceArtifact(),storage=createArtifactExperimentStorage({indexedDB:new IDBFactory()}),identity=await createArtifactExperimentIdentity(f),frame=await evaluateGuestFrame(f.artifact,{},null,{kind:'initialize'});
  const replay={frame,seed:42,inputSha256:'a'.repeat(64),artifactSha256:identity.artifactSha256};await saveArtifactExperiment({...f,replay,storage});const items=await listSavedArtifactExperiments(f.source,{storage});assert.deepEqual(items[0].replay,replay);assert.equal((await storage.list()).some(record=>record.kind==='execution'),false);
  await assert.rejects(saveArtifactExperiment({...f,replay:{...replay,artifactSha256:'b'.repeat(64)},storage}),/differs/);
});
test('an accepted artifact remains inspectable after quality/runtime versions change and owner-scoped removal preserves other references',async()=>{
  const f=await createDynamicSequenceArtifact(),storage=createArtifactExperimentStorage({indexedDB:new IDBFactory()}),identity=await createArtifactExperimentIdentity(f);
  const record=await createArtifactCacheRecord('plan',{...identity,qualityPolicy:'older-quality',runtime:'older-runtime'},{artifact:f.artifact,inputJson:'{}',seed:42,assets:[]});await storage.put(record,artifactExperimentOwner(identity),{accepted:true});await storage.put(record,'other-owner',{accepted:true});assert.equal((await listSavedArtifactExperiments(f.source,{storage})).length,1);
  await removeSavedArtifactExperiment(record.id,f.source,{storage});assert.ok(await storage.get(record.id));assert.equal((await storage.list('other-owner',{acceptedOnly:true})).length,1);assert.equal((await listSavedArtifactExperiments(f.source,{storage})).length,0);
});
test('library preserves assets-first effective input order, exact digest and recorded replay expectation across reopen',async()=>{
  const f=await createDynamicSequenceArtifact(),asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'data',kind:'tensor',label:'Synthetic order fixture',shape:[1],coordinates:{system:'Synthetic',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Test author',rights:'ISC fixture'},transformations:[],data:{values:[424242]}});
  f.artifact.assetIds=['data'];f.artifact.assetBindings=[{id:'data',kind:'tensor',sha256:asset.checksum.value}];f.artifact.interfaces.input=[{id:'assets',kind:'object',description:'Exact assets'},{id:'width',kind:'number',description:'Synthetic width'}];f.artifact.initialInput={width:7};
  const input={assets:{data:asset},width:7},identity=await createArtifactExperimentIdentity({...f,input,assets:[asset]}),frame=await evaluateGuestFrame(f.artifact,input,null,{kind:'initialize'}),replay={frame,seed:42,inputSha256:identity.inputSha256,artifactSha256:identity.artifactSha256};
  const indexedDB=new IDBFactory(),storage=createArtifactExperimentStorage({indexedDB});const record=await saveArtifactExperiment({...f,input,assets:[asset],replay,storage});assert.equal(record.identity.inputSha256,identity.inputSha256);assert.equal((record.payload as {inputJson:string}).inputJson,'{"assets":null,"width":7}');
  const reopened=await listSavedArtifactExperiments(f.source,{storage:createArtifactExperimentStorage({indexedDB})});assert.equal(reopened.length,1);assert.deepEqual(Object.keys(reopened[0].input as object),['assets','width']);assert.equal(JSON.stringify(reopened[0].input),JSON.stringify(input));assert.equal(await sha256Text(JSON.stringify(reopened[0].input)),reopened[0].replay!.inputSha256);assert.equal(reopened[0].replay!.inputSha256,identity.inputSha256);
});
