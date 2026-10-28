import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBrokerRun,startBrokerRun,listBrokerJobs,getBrokerStatus,cancelBrokerJob,collectBrokerResult,BrokerClientError,type PreparedBrokerRun} from '../lib/broker/client';
import {createBrokerDemoAsset,importBrokerLocalFile} from '../lib/broker/local';
import {externalRequirementGaps,inspectBrokerRequirements} from '../lib/broker/requirements';
import {BROKER_ADAPTER,BROKER_DISCLOSURE,createDefaultBrokerBudget,type BrokerPublicJob,type BrokerRequirement,type BrokerResultEnvelope} from '../shared/external-broker';
import {validateDocument} from '../shared/schema';
import {hasCheckedAssetIntegrity,sealScientificAsset,sha256} from '../lib/assets/local';

const source=validateDocument({schemaVersion:1,id:'broker-source',sourceVersion:'authored-v1',title:'Authored broker conformance source',authors:['Paperplay'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'passage',kind:'paragraph',page:1,text:'A short selected source excerpt. private-whole-paper-marker is not selected for upload.'}],anchors:[{id:'passage',blockId:'passage',page:1,quote:'A short selected source excerpt.'}],extractionWarnings:[]});
const byteLength=(value:string)=>new TextEncoder().encode(value).byteLength;
function publicJob(prepared:PreparedBrokerRun):BrokerPublicJob{
 const createdAt=Date.now();return {job:{jobId:crypto.randomUUID(),runId:prepared.review.run.runId,requestSha256:prepared.review.requestSha256,sourceFingerprint:prepared.review.run.source.fingerprint},adapter:{id:BROKER_ADAPTER.id,version:BROKER_ADAPTER.version},state:'queued',revision:0,createdAt,deadlineAt:createdAt+prepared.review.run.budget.maxWallMs,resources:{creations:1,inputBytes:prepared.review.run.selected.reduce((sum,item)=>sum+item.byteLength,0),outputBytes:0,statusCalls:0,collects:0,costMicrosUSD:0},budget:structuredClone(prepared.review.run.budget),message:'Deterministic engineering test job.'};
}
async function resultFixture(prepared:PreparedBrokerRun){
 const asset=await createBrokerDemoAsset(),serialized=JSON.stringify(asset),job=publicJob(prepared);job.state='completed';job.revision=2;job.resources.outputBytes=byteLength(serialized);job.resources.collects=1;
 const result:BrokerResultEnvelope={format:'paperplay-broker-result',schemaVersion:1,job:job.job,adapter:job.adapter,reviewSha256:prepared.review.reviewSha256,source:prepared.review.run.source,inputs:prepared.review.run.selected,evidence:'illustrative-engineering-output',output:{mediaType:'application/json',schema:'paperplay-scientific-asset@1',byteLength:byteLength(serialized),byteSha256:await sha256(serialized),manifestChecksum:asset.checksum.value,serialized}};
 return {job,result};
}
function transport(prepared:PreparedBrokerRun,initial=publicJob(prepared)){
 const calls:{path:string;body:unknown;init:RequestInit}[]=[];let job=initial;
 const fetcher:typeof fetch=async(input,init)=>{
  const path=String(input).split('/').at(-1)!;calls.push({path,body:JSON.parse(String(init?.body)),init:init!});
  if(path==='prepare')return Response.json({reviewToken:'opaque-private-review-token',expiresAt:Date.now()+600000,reviewSha256:prepared.review.reviewSha256});
  if(path==='list')return Response.json({jobs:[job]});
  if(path==='cancel')job={...job,state:'cancel-requested',revision:job.revision+1};
  return Response.json({job});
 };
 return {calls,fetcher};
}

test('local review defaults to no selection and never uploads the source or calls fetch',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No external transport authorized.');};
 try{
  const empty=await prepareBrokerRun({source});assert.deepEqual(empty.review.run.selected,[]);assert.deepEqual(empty.payloads,[]);
  const asset=await createBrokerDemoAsset(),prepared=await prepareBrokerRun({source,assets:[asset]});
  assert.equal(calls,0);assert.ok(Object.isFrozen(prepared));assert.ok(Object.isFrozen(prepared.review.run.budget));
  assert.equal(prepared.payloads[0].serialized,JSON.stringify(asset));assert.equal(prepared.review.run.selected[0].manifestChecksum,asset.checksum.value);
  assert.equal(prepared.review.run.selected[0].byteSha256,await sha256(prepared.payloads[0].serialized));
  assert.ok(!JSON.stringify(prepared).includes('private-whole-paper-marker'));assert.deepEqual(prepared.review.disclosure,BROKER_DISCLOSURE);
  await assert.rejects(()=>prepareBrokerRun({source,assets:[structuredClone(asset)]}),/integrity-checked/);
  await assert.rejects(()=>prepareBrokerRun({source,assets:[asset],budget:{...createDefaultBrokerBudget(),maxInputBytes:1}}),/budget/);
 }finally{globalThis.fetch=original;}
});

test('manifest UTF-8 byte disclosure includes selected excerpts but no unselected paper text',async()=>{
 const original=await createBrokerDemoAsset(),{checksum:_,...base}=original;
 const asset=await sealScientificAsset({...base,label:'Synthetic αβγ values',provenance:{...base.provenance,source:{documentId:source.id,sourceVersion:source.sourceVersion,blockId:'passage',quote:source.anchors[0].quote}}},source);
 const prepared=await prepareBrokerRun({source,assets:[asset]}),selected=prepared.review.run.selected[0],serialized=prepared.payloads[0].serialized;
 assert.equal(selected.byteLength,byteLength(serialized));assert.ok(selected.byteLength>serialized.length);
 assert.ok(serialized.includes('A short selected source excerpt.'));assert.ok(!serialized.includes('private-whole-paper-marker'));
 assert.ok(prepared.review.disclosure.included.includes('source excerpts'));
});

test('local-file adapter returns an unbound confirmation preview using the existing integrity admission',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error();};
 try{
  const file=new File(['x,y\n1,2\n2,4\n'],'local.csv'),preview=await importBrokerLocalFile(file,source);
  assert.equal(calls,0);assert.equal(preview.requiresConfirmation,true);assert.equal(preview.byteLength,file.size);
  assert.ok(hasCheckedAssetIntegrity(preview.asset));assert.equal(preview.asset.provenance.origin,'user-supplied');
  if(preview.asset.kind!=='table')throw Error();assert.equal(preview.asset.data.columns[0].unit,'unspecified');
  await assert.rejects(()=>importBrokerLocalFile(new File([new Uint8Array([0xff])],'invalid.csv')),/UTF-8/);
  let read=false;await assert.rejects(()=>importBrokerLocalFile({name:'large.csv',size:2*1024*1024+1,arrayBuffer:async()=>{read=true;return new ArrayBuffer(0);}}),/2 MiB/);assert.equal(read,false);
 }finally{globalThis.fetch=original;}
});

test('requirements demand checked exact manifests and never trust availability, raw-file hashes or fake compute',async()=>{
 const asset=await createBrokerDemoAsset(),prepared=await prepareBrokerRun({source});
 const requirement:BrokerRequirement={id:'dataset',kind:'dataset',title:'Exact local test data',anchorIds:['passage'],sourceFingerprint:prepared.review.run.source.fingerprint,expectedVersion:null,expectedSha256:asset.checksum.value,expectedBytes:byteLength(JSON.stringify(asset)),availability:'available',blocksExecution:true,details:'Expected checksum is a ScientificAsset manifest checksum, not its source-file digest.'};
 assert.equal(inspectBrokerRequirements([requirement],[asset])[0].status,'satisfied-local');assert.deepEqual(externalRequirementGaps([requirement],[asset]),[]);
 assert.equal(externalRequirementGaps([requirement],[structuredClone(asset)]).length,1);
 assert.equal(externalRequirementGaps([{...requirement,expectedVersion:'unverified-release'}],[asset]).length,1);
 assert.equal(externalRequirementGaps([{...requirement,expectedBytes:1}],[asset]).length,1);
 assert.equal(externalRequirementGaps([{...requirement,kind:'weights'}],[asset]).length,1);
 assert.equal(externalRequirementGaps([{...requirement,kind:'compute'}],[asset]).length,1);
 assert.equal(externalRequirementGaps([{...requirement,expectedSha256:null}],[asset]).length,1);
 assert.deepEqual(externalRequirementGaps([{...requirement,blocksExecution:false}],[]),[]);
});

test('only explicit matching consent starts; status/list/cancel use fixed same-origin routes and never resubmit',async()=>{
 const prepared=await prepareBrokerRun({source,assets:[await createBrokerDemoAsset()]}),fake=transport(prepared);
 await assert.rejects(()=>startBrokerRun(prepared,{accepted:true,reviewSha256:'0'.repeat(64)},{fetcher:fake.fetcher}),/consent/);assert.equal(fake.calls.length,0);
 await assert.rejects(()=>startBrokerRun(structuredClone(prepared),{accepted:true,reviewSha256:prepared.review.reviewSha256},{fetcher:fake.fetcher}),/fresh local/);assert.equal(fake.calls.length,0);
 const job=await startBrokerRun(prepared,{accepted:true,reviewSha256:prepared.review.reviewSha256},{fetcher:fake.fetcher});
 await getBrokerStatus(job.job,{fetcher:fake.fetcher});await listBrokerJobs({fetcher:fake.fetcher});await cancelBrokerJob(job.job,{fetcher:fake.fetcher});
 assert.deepEqual(fake.calls.map(call=>call.path),['prepare','start','status','list','cancel']);
 for(const call of fake.calls){assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.mode,'same-origin');assert.equal(call.init.redirect,'error');assert.equal(call.init.cache,'no-store');}
 const start=fake.calls[1].body as {payloads:unknown};assert.deepEqual(start.payloads,prepared.payloads);
 assert.ok(!JSON.stringify(fake.calls).includes('private-whole-paper-marker'));
});

test('lost creation response is uncertain and never retried automatically',async()=>{
 const prepared=await prepareBrokerRun({source}),fake=transport(prepared);let starts=0;
 const fetcher:typeof fetch=async(input,init)=>{if(String(input).endsWith('/start')){starts++;throw Error('Accepted response was lost.');}return fake.fetcher(input,init);};
 await assert.rejects(()=>startBrokerRun(prepared,{accepted:true,reviewSha256:prepared.review.reviewSha256},{fetcher}),error=>error instanceof BrokerClientError&&error.uncertain);
 assert.equal(starts,1);assert.deepEqual(fake.calls.map(call=>call.path),['prepare']);
});

test('collection validates exact source, run/review/input hashes and output bytes before restoring checked asset',async()=>{
 const prepared=await prepareBrokerRun({source,assets:[await createBrokerDemoAsset()]}),fixture=await resultFixture(prepared);
 let calls=0;const fetcher:typeof fetch=async(input)=>{calls++;assert.equal(String(input),'/api/broker/collect');return Response.json(fixture);};
 const restored=await collectBrokerResult(fixture.job,{source,prepared,fetcher});assert.ok(hasCheckedAssetIntegrity(restored.asset));assert.equal(restored.asset.provenance.origin,'illustrative');
 // Recovery after reload uses only the owned job metadata and exact local source, never start.
 const recovered=await collectBrokerResult(fixture.job,{source,fetcher});assert.equal(recovered.asset.checksum.value,restored.asset.checksum.value);assert.equal(calls,2);
 const changed=structuredClone(source);changed.blocks[0]={id:'passage',kind:'paragraph',page:1,text:'A short selected source excerpt. Changed paper body.'};
 await assert.rejects(()=>collectBrokerResult(fixture.job,{source:changed,fetcher}),/exact original source/);assert.equal(calls,2);
});

test('wrong result identities or bytes retain bounded original output without accepting a manifest',async()=>{
 const prepared=await prepareBrokerRun({source,assets:[await createBrokerDemoAsset()]}),fixture=await resultFixture(prepared);
 for(const change of [
  (value:typeof fixture)=>{value.result.inputs[0].manifestChecksum='0'.repeat(64);},
  (value:typeof fixture)=>{value.result.source.fingerprint='0'.repeat(64);},
  (value:typeof fixture)=>{value.result.output.byteSha256='0'.repeat(64);},
  (value:typeof fixture)=>{value.result.output.manifestChecksum='0'.repeat(64);},
  (value:typeof fixture)=>{value.result.reviewSha256='0'.repeat(64);},
  (value:typeof fixture)=>{value.result.job.jobId=crypto.randomUUID();},
 ]){
  const bad=structuredClone(fixture);change(bad);
  await assert.rejects(()=>collectBrokerResult(fixture.job,{source,fetcher:async()=>Response.json(bad)}),error=>error instanceof BrokerClientError&&!!error.original&&error.originalComplete===true);
 }
});

test('even a resealed output cannot relabel a fake job as source-observed data',async()=>{
 const prepared=await prepareBrokerRun({source}),fixture=await resultFixture(prepared),demo=await createBrokerDemoAsset(),{checksum:_,...base}=demo;
 const forged=await sealScientificAsset({...base,provenance:{...base.provenance,origin:'source-extracted'}}),serialized=JSON.stringify(forged);
 fixture.result.output={...fixture.result.output,serialized,byteLength:byteLength(serialized),byteSha256:await sha256(serialized),manifestChecksum:forged.checksum.value};fixture.job.resources.outputBytes=byteLength(serialized);
 await assert.rejects(()=>collectBrokerResult(fixture.job,{source,fetcher:async()=>Response.json(fixture)}),error=>error instanceof BrokerClientError&&error.original===serialized);
});

test('bounded response reading rejects oversized streams despite a false content length',async()=>{
 const prepared=await prepareBrokerRun({source}),fixture=await resultFixture(prepared);let cancelled=false;
 const fetcher:typeof fetch=async()=>new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(6*1024*1024+1));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json','Content-Length':'1'}});
 await assert.rejects(()=>collectBrokerResult(fixture.job,{source,fetcher}),/transport limit/);assert.equal(cancelled,true);
});

test('transport deadline aborts a stalled request and an already aborted action sends nothing',async()=>{
 const prepared=await prepareBrokerRun({source}),job=publicJob(prepared);let calls=0;
 const stalled:typeof fetch=async(_input,init)=>{calls++;return new Promise<Response>((_resolve,reject)=>{init!.signal!.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true});});};
 await assert.rejects(()=>getBrokerStatus(job.job,{fetcher:stalled,timeoutMs:5}),/time limit/);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>cancelBrokerJob(job.job,{fetcher:stalled,signal:controller.signal}),{name:'AbortError'});assert.equal(calls,1);
});
