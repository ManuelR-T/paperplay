import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {executeMoleculeParse,admitMoleculeParseResult,activeMoleculeExecutions,type MoleculeWorker} from '../lib/molecules/client';
import {parsePdbCoordinates,type MoleculeParseRequest} from '../lib/molecules/parser';
import {hasCheckedAssetIntegrity} from '../lib/assets/local';
const text=(await readFile(new URL('../public/structures/1CRN.pdb',import.meta.url),'utf8')).split('\n').find(x=>x.startsWith('ATOM  '))!;
const request=():MoleculeParseRequest=>({format:'pdb',text,id:'test-coordinates',label:'Explicit coordinate',attribution:'CC0 RCSB PDB 1CRN subset',rights:'CC0'});
class FakeWorker implements MoleculeWorker{
 onmessage:MoleculeWorker['onmessage']=null;onerror:MoleculeWorker['onerror']=null;onmessageerror:MoleculeWorker['onmessageerror']=null;terminated=0;posts:unknown[]=[];
 constructor(readonly respond?:(value:any,worker:FakeWorker)=>void){}terminate(){this.terminated++;}postMessage(value:unknown){this.posts.push(value);this.respond?.(value,this);}message(value:unknown){this.onmessage?.({data:value} as MessageEvent<unknown>);}
}
function resultWorker(change?:(value:any,result:unknown)=>unknown){return new FakeWorker((value,worker)=>{worker.message({protocol:1,id:value.id,status:'started'});void parsePdbCoordinates(value.request).then(result=>worker.message(change?change(value,result):{protocol:1,id:value.id,status:'complete',result:structuredClone(result)}));});}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('worker transferred geometry is checked in host, source-bound, and all transport resources cleaned',async()=>{
 const worker=resultWorker(),progress:string[]=[];const r=await executeMoleculeParse(request(),{workerFactory:()=>worker,onProgress:v=>progress.push(v)});assert.equal(r.status,'ready');if(r.status==='ready')assert.equal(hasCheckedAssetIntegrity(r.asset),true);assert.deepEqual(progress,['starting','running']);assert.equal(worker.terminated,1);assert.equal(activeMoleculeExecutions(),0);assert.equal(worker.onmessage,null);
});
test('stale, tampered, and unrelated valid worker assets are rejected without source loss',async()=>{
 for(const change of [(v:any,r:any)=>({protocol:1,id:'stale',status:'complete',result:r}),(v:any,r:any)=>({protocol:1,id:v.id,status:'complete',result:{...r,sourceSha256:'0'.repeat(64)}}),(v:any,r:any)=>{const bad=structuredClone(r);bad.asset.data.vertices[0][0]+=1;return {protocol:1,id:v.id,status:'complete',result:bad};}]){const raw=request(),worker=resultWorker(change);await assert.rejects(executeMoleculeParse(raw,{workerFactory:()=>worker}),/stale|invalid|unrelated/);assert.equal(raw.text,text);assert.equal(worker.terminated,1);assert.equal(activeMoleculeExecutions(),0);}
 const other=await parsePdbCoordinates({...request(),rights:'Different rights'});const worker=resultWorker((v)=>({protocol:1,id:v.id,status:'complete',result:other}));await assert.rejects(executeMoleculeParse(request(),{workerFactory:()=>worker}),/unrelated/);
});
test('abort, timeout and observer failure terminate workers and suppress late replies',async()=>{
 const controller=new AbortController(),worker=new FakeWorker(),p=executeMoleculeParse(request(),{workerFactory:()=>worker,signal:controller.signal});for(let i=0;!worker.posts.length&&i<100;i++)await tick();assert.equal(worker.posts.length,1,'active cancellation waits for actual worker admission');const late=worker.onmessage;controller.abort();await assert.rejects(p,/cancelled/);late?.({data:{protocol:1,id:'stale',status:'complete',result:null}} as MessageEvent);assert.equal(worker.terminated,1);assert.equal(activeMoleculeExecutions(),0);
 const hung=new FakeWorker();await assert.rejects(executeMoleculeParse(request(),{workerFactory:()=>hung,timeoutMs:1}),/time limit/);assert.equal(hung.terminated,1);
 for(const stage of ['starting','running']){const w=resultWorker();await assert.rejects(executeMoleculeParse(request(),{workerFactory:()=>w,onProgress:s=>{if(s===stage)throw Error('private observer data');}}),/observer failed/);assert.equal(w.terminated,1);}assert.equal(activeMoleculeExecutions(),0);
});
test('preabort, unavailable worker, transport failure, cap and UUID failure never leak workers',async()=>{
 const abort=new AbortController();abort.abort();let count=0;await assert.rejects(executeMoleculeParse(request(),{signal:abort.signal,workerFactory:()=>{count++;throw Error();}}),/cancelled/);assert.equal(count,0);
 const bad=new FakeWorker(()=>{throw Error();});await assert.rejects(executeMoleculeParse(request(),{workerFactory:()=>bad}),/transferred/);assert.equal(bad.terminated,1);
 const a=new AbortController(),b=new AbortController(),wa=new FakeWorker(),wb=new FakeWorker(),one=executeMoleculeParse(request(),{workerFactory:()=>wa,signal:a.signal}),two=executeMoleculeParse(request(),{workerFactory:()=>wb,signal:b.signal});for(let i=0;wa.posts.length+wb.posts.length<2&&i<100;i++)await tick();assert.equal(wa.posts.length+wb.posts.length,2,'both workers must be admitted before testing queued cancellation');assert.equal(activeMoleculeExecutions(),2);const queuedController=new AbortController(),queued=executeMoleculeParse(request(),{signal:queuedController.signal,workerFactory:()=>{count++;return new FakeWorker();}});assert.equal(count,0);queuedController.abort();await assert.rejects(queued,/cancelled/);assert.equal(count,0);a.abort();b.abort();await Promise.allSettled([one,two]);assert.equal(activeMoleculeExecutions(),0);assert.equal(count,0);
 const original=crypto.randomUUID;crypto.randomUUID=()=>{throw Error();};try{await assert.rejects(executeMoleculeParse(request(),{workerFactory:()=>{count++;return new FakeWorker();}}),/unavailable/);assert.equal(count,0);}finally{crypto.randomUUID=original;}
});

test('host source pin rejects before creating a worker and direct admission cannot bypass it',async()=>{
 const pinned={...request(),expectedSha256:'0'.repeat(64)};let factories=0;const response=await executeMoleculeParse(pinned,{workerFactory:()=>{factories++;return resultWorker();}});assert.equal(response.status,'invalid');assert.equal(response.code,'source-digest');assert.equal(factories,0);assert.equal(activeMoleculeExecutions(),0);
 const unpinned=await parsePdbCoordinates(request());assert.equal(unpinned.status,'ready');if(unpinned.status!=='ready')return;await assert.rejects(admitMoleculeParseResult(structuredClone(unpinned),pinned,unpinned.sourceSha256),/pinned SHA-256/);
});
