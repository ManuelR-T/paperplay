import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { createArtifactExperimentIdentity, artifactCacheKey, createArtifactCacheRecord, validateArtifactCacheRecord, artifactExperimentOwner, artifactIdentityCompatible } from '../shared/artifact-experiment';
import { createArtifactExperimentStorage } from '../lib/artifacts/experiment-storage';

async function fixture(input: unknown = {}) { const value = await createDynamicSequenceArtifact(); const identity = await createArtifactExperimentIdentity({ ...value, input }); return { ...value, identity, owner: artifactExperimentOwner(identity) }; }
async function execution(f: Awaited<ReturnType<typeof fixture>>, input: unknown = {}) { return createArtifactCacheRecord('execution', f.identity, { inputJson: JSON.stringify(input), entries: [], currentKey: null }); }
async function rawPut(factory: IDBFactory, name: string, row: unknown, key: string, id: string) { await new Promise<void>((resolve,reject) => { const request = factory.open(name,1); request.onerror=()=>reject(request.error); request.onsuccess=()=>{const db=request.result,tx=db.transaction(['records','pointers'],'readwrite');tx.objectStore('records').put(row);tx.objectStore('pointers').put({key,id});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);}; }); }

test('content-addressed records persist across adapters without granting compilation admission', async () => {
  const f = await fixture(), indexedDB = new IDBFactory(), first = createArtifactExperimentStorage({ indexedDB });
  const record = await execution(f); await first.put(record,f.owner);
  const reopened = createArtifactExperimentStorage({ indexedDB }); assert.deepEqual(await reopened.get(record.key),record); assert.equal((await reopened.list(f.owner)).length,1);
  assert.equal(JSON.stringify(record).includes('admissionReceipt'),false); const tampered={...record,payload:{inputJson:'{"changed":true}',entries:[],currentKey:null}};await assert.rejects(validateArtifactCacheRecord(tampered),/digest/);
});
test('plan/build/execution/report keys invalidate only their declared dependencies', async () => {
  const f = await fixture(); const inputChanged={...f.identity,inputSha256:'a'.repeat(64),seed:9};
  assert.equal(await artifactCacheKey('plan',f.identity),await artifactCacheKey('plan',inputChanged)); assert.equal(await artifactCacheKey('build',f.identity),await artifactCacheKey('build',inputChanged)); assert.notEqual(await artifactCacheKey('execution',f.identity),await artifactCacheKey('execution',inputChanged));
  const policyChanged={...f.identity,qualityPolicy:'future-quality'};
  assert.equal(await artifactCacheKey('execution',f.identity),await artifactCacheKey('execution',policyChanged)); assert.notEqual(await artifactCacheKey('report',f.identity),await artifactCacheKey('report',policyChanged)); assert.equal(artifactIdentityCompatible(policyChanged,'execution'),true);assert.equal(artifactIdentityCompatible(policyChanged,'report'),false);
  const runtimeChanged={...f.identity,runtime:'future-runtime'};assert.equal(await artifactCacheKey('build',f.identity),await artifactCacheKey('build',runtimeChanged));assert.notEqual(await artifactCacheKey('execution',f.identity),await artifactCacheKey('execution',runtimeChanged));assert.equal(artifactIdentityCompatible(runtimeChanged,'build'),true);
  const dependencyChanged={...f.identity,dependencies:[{...f.identity.dependencies[0],sha256:'b'.repeat(64)}]};assert.notEqual(await artifactCacheKey('build',f.identity),await artifactCacheKey('build',dependencyChanged));
});
test('raw input and variant object order remain part of semantic identity', async () => {
  const f = await fixture({a:1,b:2}), other=await createArtifactExperimentIdentity({...f,input:{b:2,a:1}});assert.notEqual(f.identity.inputSha256,other.inputSha256);
  assert.notEqual(await artifactCacheKey('execution',f.identity,{a:1,b:2}),await artifactCacheKey('execution',f.identity,{b:2,a:1}));
  const a=await createArtifactCacheRecord('execution',f.identity,{inputJson:'{}',entries:[],currentKey:null}); const b={...a,payload:{currentKey:null,entries:[],inputJson:'{}'}};await assert.rejects(validateArtifactCacheRecord(b),/digest/);
});
test('bounded LRU removes recomputable records while accepted originals survive and failed puts roll back', async () => {
  const f=await fixture(),indexedDB=new IDBFactory(),storage=createArtifactExperimentStorage({indexedDB,maxEntries:2,now:()=>1});
  const plan=await createArtifactCacheRecord('plan',f.identity,{artifact:f.artifact});await storage.put(plan,f.owner,{accepted:true});
  const first=await execution(f);await storage.put(first,f.owner);
  const secondIdentity={...f.identity,seed:12};const second=await createArtifactCacheRecord('execution',secondIdentity,{inputJson:'{}',entries:[],currentKey:null});await storage.put(second,f.owner);
  assert.ok(await storage.get(plan.key));assert.equal(await storage.get(first.key),undefined);assert.ok(await storage.get(second.key));
  const tiny=createArtifactExperimentStorage({indexedDB,maxEntries:1});const changedArtifact={...f.artifact,title:'Another accepted original'},changedIdentity=await createArtifactExperimentIdentity({...f,artifact:changedArtifact});const third=await createArtifactCacheRecord('plan',changedIdentity,{artifact:changedArtifact});await assert.rejects(tiny.put(third,f.owner,{accepted:true}),/retained/);assert.ok(await storage.get(plan.key));
});
test('document removal drops its owner references while retaining another owner and no unrelated keys', async () => {
  const f=await fixture(),indexedDB=new IDBFactory(),storage=createArtifactExperimentStorage({indexedDB});const record=await execution(f);await storage.put(record,f.owner);await storage.put(record,'other-document:owner');await storage.removeOwner(f.owner);assert.equal((await storage.list(f.owner)).length,0);assert.ok(await storage.get(record.key));await storage.removeOwner('other-document:owner');assert.equal((await storage.list()).length,0);
});
test('invalid versions remain exportable and cannot silently enter an executable cache', async () => {
  const f=await fixture(),indexedDB=new IDBFactory(),name='unknown-artifact-record',storage=createArtifactExperimentStorage({indexedDB,name,maxEntries:1});const record=await execution(f);await storage.put(record,f.owner);
  const future={...record,schemaVersion:99};await rawPut(indexedDB,name,{id:record.id,record:future,owners:[f.owner],accepted:false,bytes:100,touched:1},record.key,record.id);
  await assert.rejects(storage.get(record.key),/retained/);assert.equal((await storage.list()).length,0);assert.match(storage.warning!,/retained/);assert.equal(JSON.parse((await storage.exportOriginal(record.key))!).schemaVersion,99);
  const changed=await createArtifactCacheRecord('execution',{...f.identity,seed:7},{inputJson:'{}',entries:[],currentKey:null});await assert.rejects(storage.put(changed,f.owner),/retained/);assert.equal(JSON.parse((await storage.exportOriginal(record.key))!).schemaVersion,99);
});
test('quota pressure never evicts an outer-valid schema-v1 record with a corrupt content digest',async()=>{
  const f=await fixture(),indexedDB=new IDBFactory(),name='corrupt-digest-eviction',storage=createArtifactExperimentStorage({indexedDB,name,maxEntries:1});const first=await execution(f);await storage.put(first,f.owner);
  const corrupt={...first,payload:{inputJson:'{"tampered":true}',entries:[],currentKey:null}};
  await rawPut(indexedDB,name,{id:first.id,record:corrupt,owners:[f.owner],accepted:false,bytes:JSON.stringify(corrupt).length,touched:1},first.key,first.id);
  const original=await storage.exportOriginal(first.id);await assert.rejects(storage.get(first.key),/retained/);
  const next=await createArtifactCacheRecord('execution',{...f.identity,seed:123},{inputJson:'{}',entries:[],currentKey:null});await assert.rejects(storage.put(next,f.owner),/retained/);
  assert.equal(await storage.exportOriginal(first.id),original);assert.equal(await storage.get(next.key),undefined);
});
test('newer databases and unavailable adapters never reset existing records', async () => {
  const indexedDB=new IDBFactory();await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('future-experiments',2);req.onsuccess=()=>{req.result.close();resolve();};req.onerror=()=>reject(req.error);});
  await assert.rejects(createArtifactExperimentStorage({indexedDB,name:'future-experiments'}).list(),/newer artifact database/);
  const denied={open(){throw new DOMException('Denied','SecurityError');}} as unknown as IDBFactory;await assert.rejects(createArtifactExperimentStorage({indexedDB:denied}).list(),/unavailable/);
});
test('scientific token/job fields in state are ordinary data while private envelope extras are rejected', async () => {
  const f=await fixture();const frame={format:'paperplay-sdk-frame',schemaVersion:1,title:'Token teaching values',description:'Synthetic values',coordinateSpace:{width:100,height:100},marks:[],controls:[],table:{caption:'Synthetic',columns:['Value'],rows:[]},state:{token:3,job:4}};
  const record=await createArtifactCacheRecord('execution',f.identity,{inputJson:'{}',entries:[{key:'a'.repeat(64),inputJson:'{}',stateJson:'null',eventJson:'{"kind":"initialize"}',frame}],currentKey:'a'.repeat(64)});assert.ok(await validateArtifactCacheRecord(record));
  await assert.rejects(createArtifactCacheRecord('build',f.identity,{status:'admitted',compilerVersion:f.identity.compiler,artifactSha256:f.identity.artifactSha256,admissionReceipt:'not-real'}));
});
test('read-only cache hits survive failure to write LRU metadata',async()=>{
  const f=await fixture(),indexedDB=new IDBFactory(),name='read-only-cache-hit',storage=createArtifactExperimentStorage({indexedDB,name});const record=await execution(f);await storage.put(record,f.owner);
  const refusingFactory={open(dbName:string,version?:number){const request=indexedDB.open(dbName,version);return new Proxy(request,{get(target,key){const value=Reflect.get(target,key,target);if(key==='result'&&value)return new Proxy(value,{get(db,property){if(property==='transaction')return (names:string[],mode:IDBTransactionMode)=>{if(mode==='readwrite')throw new DOMException('Read-only policy','QuotaExceededError');return db.transaction(names,mode);};const item=Reflect.get(db,property,db);return typeof item==='function'?item.bind(db):item;}});return typeof value==='function'?value.bind(target):value;}});}} as unknown as IDBFactory;
  const readonly=createArtifactExperimentStorage({indexedDB:refusingFactory,name});assert.deepEqual(await readonly.get(record.key),record);assert.match(readonly.warning!,/recent-use metadata/);assert.ok(await storage.get(record.key));
});
