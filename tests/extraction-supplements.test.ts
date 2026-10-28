import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLEMENT_DESCRIPTORS,prepareSupplementRetrieval,retrieveSupplement,supplementDescriptorForReference,supplementMetadata,verifySupplementBytes} from '../lib/extraction/supplements';
import {createSupplementService} from '../server/supplements/service';
import {createSupplementHandlers} from '../server/supplements/handlers';

const descriptor=SUPPLEMENT_DESCRIPTORS[0];
const selected=()=>prepareSupplementRetrieval({descriptorId:descriptor.id,parentFingerprint:'1'.repeat(64),referenceId:'html-reference1',referenceUrl:descriptor.sourceUrl});
function request(body:unknown,origin='http://localhost'){return new Request('http://localhost/api/supplements/retrieve',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
function response(bytes:Uint8Array){return new Response(bytes as Uint8Array<ArrayBuffer>,{headers:{'Content-Type':descriptor.mediaType,'Content-Length':String(bytes.length)}});}
/** Synthetic ZIP-signature-shaped transport fixture, not original workbook data. */
const synthetic=new Uint8Array(descriptor.byteLength);synthetic.set([0x50,0x4b,3,4]);

test('one exact public descriptor and local disclosure never create an arbitrary downloader or an upload',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error();};
 try{
  const prepared=await selected();assert.equal(calls,0);assert.ok(Object.isFrozen(prepared));
  assert.equal(prepared.review.descriptorId,'chew-biomass-2212-v1');assert.ok(prepared.review.disclosure.recipient.includes('No private paper'));
  assert.equal(supplementDescriptorForReference(descriptor.sourceUrl)?.id,descriptor.id);assert.equal(supplementDescriptorForReference(descriptor.downloadUrl)?.id,descriptor.id);
  for(const url of ['https://fairdomhub.org/data_files/2212?version=2','https://fairdomhub.org/data_files/2212?version=1&extra=1','https://evil.invalid/'+descriptor.downloadUrl])assert.equal(supplementDescriptorForReference(url),undefined);
  await assert.rejects(()=>prepareSupplementRetrieval({descriptorId:descriptor.id,parentFingerprint:'1'.repeat(64),referenceId:'ref',referenceUrl:'https://evil.invalid/data.csv'}));
  await assert.rejects(()=>retrieveSupplement(prepared,{accepted:true,reviewSha256:'0'.repeat(64)}),/consent/);assert.equal(calls,0);
  await assert.rejects(()=>retrieveSupplement(structuredClone(prepared),{accepted:true,reviewSha256:prepared.reviewSha256}),/fresh local/);assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});

test('server consent and same-origin checks happen before outbound retrieval',async()=>{
 let calls=0;const service=createSupplementService({fetcher:async()=>{calls++;throw Error();}}),handlers=createSupplementHandlers({service});
 const prepared=await selected(),valid={review:prepared.review,consent:{accepted:true as const,reviewSha256:prepared.reviewSha256}};
 assert.equal((await handlers.retrieve(request(valid,'https://evil.invalid'))).status,403);
 assert.equal((await handlers.retrieve(request({...valid,consent:{accepted:true,reviewSha256:'0'.repeat(64)}}))).status,403);
 assert.equal((await handlers.retrieve(request({...valid,url:'http://169.254.169.254/metadata'}))).ok,false);
 const changed=structuredClone(valid);changed.review.referenceId='changed-with-stale-consent';assert.equal((await handlers.retrieve(request(changed))).ok,false);
 const oversized=new Request('http://localhost/api/supplements/retrieve',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','Content-Length':'1'},body:' '.repeat(16385)});
 assert.equal((await handlers.retrieve(oversized)).status,413);assert.equal(calls,0);
});

test('reviewed redirects cannot escape the exact inspected path or forward credentials',async()=>{
 const prepared=await selected();
 for(const location of ['https://evil.invalid/file.xlsx','http://169.254.169.254/metadata','https://fairdomhub.org/data_files/2213/download?version=1','https://user:password@fairdomhub.org/data_files/2212/download?version=1']){
  let calls=0;const fetcher:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),descriptor.downloadUrl);assert.equal(init?.redirect,'manual');assert.equal(init?.credentials,'omit');assert.ok(!new Headers(init?.headers).has('Authorization'));assert.ok(!new Headers(init?.headers).has('Cookie'));return new Response(null,{status:302,headers:{Location:location}});};
  await assert.rejects(()=>createSupplementService({fetcher}).retrieve(prepared.review),/reviewed destination/);assert.equal(calls,1);
 }
 let loops=0;await assert.rejects(()=>createSupplementService({fetcher:async()=>{loops++;return new Response(null,{status:302,headers:{Location:descriptor.downloadUrl}});}}).retrieve(prepared.review),/too many redirects/);assert.equal(loops,4);
});

test('media, declared size, actual streamed bytes, signature and digest are enforced independently',async()=>{
 const prepared=await selected();
 await assert.rejects(()=>createSupplementService({fetcher:async()=>new Response('not-xlsx',{headers:{'Content-Type':'text/html'}})}).retrieve(prepared.review),/media type/);
 await assert.rejects(()=>createSupplementService({fetcher:async()=>new Response('small',{headers:{'Content-Type':descriptor.mediaType,'Content-Length':'5'}})}).retrieve(prepared.review),/declared.*size/);
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(descriptor.byteLength+1));},cancel(){cancelled=true;}});
 await assert.rejects(()=>createSupplementService({fetcher:async()=>new Response(stream,{headers:{'Content-Type':descriptor.mediaType}})}).retrieve(prepared.review),/stream exceeds/);assert.equal(cancelled,true);
 await assert.rejects(()=>createSupplementService({fetcher:async()=>new Response(new Uint8Array(8),{headers:{'Content-Type':descriptor.mediaType}})}).retrieve(prepared.review),/actual.*size/);
 // Same length and PK signature are insufficient: this is not the pinned original workbook.
 await assert.rejects(()=>createSupplementService({fetcher:async()=>response(synthetic)}).retrieve(prepared.review),/reviewed edition/);
 await assert.rejects(()=>verifySupplementBytes(new Uint8Array(descriptor.byteLength)),/reviewed edition/);
});

test('deterministic transport harness verifies once and rebinds cached public bytes to each exact reference',async()=>{
 const prepared=await selected();let fetches=0,verifications=0;
 const service=createSupplementService({fetcher:async(url,init)=>{
  fetches++;assert.equal(String(url),descriptor.downloadUrl);
  const headers=new Headers(init?.headers);
  // The real archive returns 406 for MIME-specific negotiation, while */* serves
  // the exact pinned attachment. Response identity gates remain independently tested.
  assert.equal(headers.get('Accept'),'*/*');assert.equal(headers.get('Accept-Encoding'),'identity');
  assert.equal(init?.redirect,'manual');assert.equal(init?.credentials,'omit');
  return response(synthetic);
 },verifyBytes:async bytes=>{verifications++;assert.deepEqual(bytes,synthetic);}});
 const first=await service.retrieve(prepared.review);assert.equal(first.metadata.format,'passive-xlsx');assert.equal(first.bytes.length,descriptor.byteLength);
 const other=await prepareSupplementRetrieval({descriptorId:descriptor.id,parentFingerprint:'2'.repeat(64),referenceId:'other-ref',referenceUrl:descriptor.downloadUrl});
 const second=await service.retrieve(other.review);assert.equal(fetches,1);assert.equal(verifications,1);assert.equal(second.metadata.parentFingerprint,'2'.repeat(64));assert.equal(second.metadata.referenceId,'other-ref');
 first.bytes[4]=99;assert.equal((await service.retrieve(prepared.review)).bytes[4],0,'callers cannot modify the cached bytes');
 const handlers=createSupplementHandlers({service}),reply=await handlers.retrieve(request({review:prepared.review,consent:{accepted:true,reviewSha256:prepared.reviewSha256}}));assert.equal(reply.status,200);
 const body=await reply.json();assert.deepEqual(body.metadata,supplementMetadata(prepared.review));assert.equal(Buffer.from(body.base64,'base64').length,descriptor.byteLength);
 // This hook tests transport/cache behavior only. Production uses the pinned digest verifier,
 // and the browser independently rejects these synthetic bytes in the following test.
});

test('browser collection rechecks pinned bytes and reference metadata, never promotes an XLSX to observations',async()=>{
 const prepared=await selected();let calls=0;
 const fetcher:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),'/api/supplements/retrieve');assert.equal(init?.credentials,'same-origin');assert.equal(init?.redirect,'error');return Response.json({metadata:supplementMetadata(prepared.review),base64:Buffer.from(synthetic).toString('base64')});};
 await assert.rejects(()=>retrieveSupplement(prepared,{accepted:true,reviewSha256:prepared.reviewSha256},{fetcher}),/reviewed edition/);assert.equal(calls,1);
 const wrong=supplementMetadata(prepared.review);wrong.parentFingerprint='0'.repeat(64);
 await assert.rejects(()=>retrieveSupplement(prepared,{accepted:true,reviewSha256:prepared.reviewSha256},{fetcher:async()=>Response.json({metadata:wrong,base64:'AAAA'})}),/metadata differs/);
});

test('official access failures and explicit cancellation retain a local/original-file alternative',async()=>{
 const prepared=await selected(),service=createSupplementService({fetcher:async()=>new Response('private',{status:403})});
 const handlers=createSupplementHandlers({service}),reply=await handlers.retrieve(request({review:prepared.review,consent:{accepted:true,reviewSha256:prepared.reviewSha256}}));assert.equal(reply.status,502);
 assert.ok((await reply.json()).error.includes('local file'));
 const controller=new AbortController();controller.abort();let calls=0;await assert.rejects(()=>retrieveSupplement(prepared,{accepted:true,reviewSha256:prepared.reviewSha256},{signal:controller.signal,fetcher:async()=>{calls++;throw Error();}}),{name:'AbortError'});assert.equal(calls,0);
});
