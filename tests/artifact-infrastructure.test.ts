import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { artifactInfrastructureSchema,type ArtifactInfrastructure } from '../shared/artifact-infrastructure';
import { loadArtifactWorker } from '../lib/artifacts/worker-bootstrap';
import { FIGURE_SDK_SOURCE } from '../lib/artifacts/sdk-source';
import { buildArtifactInfrastructure } from '../scripts/artifact-infrastructure.mjs';
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const policy="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'";
function fixture(script:Uint8Array=new TextEncoder().encode('self.onmessage=()=>{};')){const sha256=digest(script),metadata:ArtifactInfrastructure={format:'paperplay-artifact-infrastructure',schemaVersion:1,sdkSha256:digest(FIGURE_SDK_SOURCE),workers:{compiler:{url:`/artifact-compiler.${sha256}.worker.mjs`,sha256},runtime:{url:`/artifact-runtime.${sha256}.worker.mjs`,sha256}}};return {script,metadata};}
let originCounter=0;
async function mockBrowser(run:(origin:string)=>Promise<void>){const previousFetch=globalThis.fetch,previousLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),origin=`https://infrastructure-${++originCounter}.paperplay.invalid`;Object.defineProperty(globalThis,'location',{value:{origin},configurable:true});try{await run(origin);}finally{globalThis.fetch=previousFetch;if(previousLocation)Object.defineProperty(globalThis,'location',previousLocation);else Reflect.deleteProperty(globalThis,'location');}}
function scriptResponse(bytes:Uint8Array,csp=policy){return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'text/javascript','Content-Security-Policy':csp}});}
test('metadata admits only exact kind/hash relative URLs and strict known fields',()=>{
 const {metadata}=fixture();artifactInfrastructureSchema.parse(metadata);
 for(const url of ['https://other.invalid/runtime.mjs','//other.invalid/runtime.mjs','/artifact-compiler.worker.mjs',metadata.workers.runtime.url,metadata.workers.compiler.url+'?x=1',metadata.workers.compiler.url+'#x'])assert.throws(()=>artifactInfrastructureSchema.parse({...metadata,workers:{...metadata.workers,compiler:{...metadata.workers.compiler,url}}}));
 assert.throws(()=>artifactInfrastructureSchema.parse({...metadata,workers:{...metadata.workers,compiler:{...metadata.workers.compiler,sha256:'0'.repeat(64)}}}));assert.throws(()=>artifactInfrastructureSchema.parse({...metadata,privileged:true}));
});
test('trusted infrastructure builds reproducibly, retains hash files, and derives the installed SDK digest',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'paperplay-infrastructure-test-'));try{const old=join(directory,`artifact-runtime.${'e'.repeat(64)}.worker.mjs`);await writeFile(old,'retained historical infrastructure');const one=artifactInfrastructureSchema.parse(await buildArtifactInfrastructure({outputDirectory:directory})),two=artifactInfrastructureSchema.parse(await buildArtifactInfrastructure({outputDirectory:directory}));assert.deepEqual(two,one);assert.equal(one.sdkSha256,digest(FIGURE_SDK_SOURCE));assert.equal(await readFile(old,'utf8'),'retained historical infrastructure');
 for(const kind of ['compiler','runtime'] as const){const reference=one.workers[kind],bytes=await readFile(join(directory,reference.url.slice(1)));assert.equal(digest(bytes),reference.sha256);assert.deepEqual(await readFile(join(directory,`artifact-${kind}.worker.mjs`)),bytes);}assert.deepEqual(JSON.parse(await readFile(join(directory,'artifact-workers.json'),'utf8')),one);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('verified cached URL avoids repeated metadata/script fetches, with fixed same-origin fetch policy',async()=>mockBrowser(async origin=>{
 const {metadata,script}=fixture(),requests:{url:string;init?:RequestInit}[]=[];globalThis.fetch=(async(input,init)=>{const url=String(input);requests.push({url,init});return url.endsWith('/artifact-workers.json')?Response.json(metadata):scriptResponse(script);}) as typeof fetch;
 const url=await loadArtifactWorker('runtime');assert.equal(url,origin+metadata.workers.runtime.url);assert.equal(await loadArtifactWorker('runtime'),url);assert.equal(requests.length,2);assert.equal(requests[0].init?.cache,'no-store');assert.equal(requests[1].init?.cache,'force-cache');assert.ok(requests.every(({url,init})=>url.startsWith(origin+'/')&&init?.redirect==='error'&&init.referrerPolicy==='no-referrer'&&init.credentials==='same-origin'));
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(()=>loadArtifactWorker('runtime',cancelled.signal),{name:'AbortError'});assert.equal(requests.length,2);
}));
test('SDK mismatch and actual source digest mismatch fail before caching a worker',async()=>{
 await mockBrowser(async()=>{const {metadata}=fixture();globalThis.fetch=(async()=>Response.json({...metadata,sdkSha256:'0'.repeat(64)})) as typeof fetch;await assert.rejects(()=>loadArtifactWorker('compiler'),/installed SDK/);});
 await mockBrowser(async()=>{const {metadata}=fixture();let calls=0;globalThis.fetch=(async(input)=>{calls++;return String(input).endsWith('/artifact-workers.json')?Response.json(metadata):scriptResponse(new TextEncoder().encode('different bytes'));}) as typeof fetch;await assert.rejects(()=>loadArtifactWorker('compiler'),/digest differs/);await assert.rejects(()=>loadArtifactWorker('compiler'),/digest differs/);assert.equal(calls,4);});
});
test('worker policy rejects absent, permissive, ambiguous and unsafe-eval CSP before accepting bytes',async()=>{
 for(const csp of ['',"script-src 'self' 'wasm-unsafe-eval' https:; connect-src 'none'; worker-src 'none'","script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; connect-src 'none'; worker-src 'none'","script-src 'self' 'unsafe-eval'; connect-src 'none'; worker-src 'none'","script-src 'self' 'wasm-unsafe-eval'; connect-src 'none' https:; worker-src 'none'","script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'self'","script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; connect-src 'none'; worker-src 'none'"]){await mockBrowser(async()=>{const {metadata,script}=fixture();globalThis.fetch=(async(input)=>String(input).endsWith('/artifact-workers.json')?Response.json(metadata):scriptResponse(script,csp)) as typeof fetch;await assert.rejects(()=>loadArtifactWorker('runtime'),/CSP|deny|policy/);});}
});
test('metadata and script streaming limits override missing or forged Content-Length',async()=>{
 for(const kind of ['metadata','script'] as const)await mockBrowser(async()=>{const script=new Uint8Array(3*1024*1024+1),{metadata}=fixture(script);let cancelled=false;const oversized=new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(kind==='script'?script:new TextEncoder().encode(' '.repeat(8193)));},cancel(){cancelled=true;}}),{headers:{'content-length':'1','Content-Security-Policy':policy}});
 globalThis.fetch=(async input=>String(input).endsWith('/artifact-workers.json')?(kind==='metadata'?oversized:Response.json(metadata)):oversized) as typeof fetch;await assert.rejects(()=>loadArtifactWorker('runtime'),/byte budget/);assert.equal(cancelled,true);
 });
});
test('aborting one caller does not poison an independent successful bootstrap or completed cache',async()=>mockBrowser(async origin=>{
 const {metadata,script}=fixture();let metadataCalls=0,started!:()=>void;const firstStarted=new Promise<void>(resolve=>{started=resolve;});globalThis.fetch=(async(input,init)=>{if(String(input).endsWith('/artifact-workers.json')){if(++metadataCalls===1){started();return new Promise<Response>((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(init.signal!.reason),{once:true}));}return Response.json(metadata);}return scriptResponse(script);}) as typeof fetch;
 const controller=new AbortController(),first=loadArtifactWorker('compiler',controller.signal);await firstStarted;const second=await loadArtifactWorker('compiler');assert.equal(second,origin+metadata.workers.compiler.url);controller.abort();await assert.rejects(()=>first,{name:'AbortError'});assert.equal(await loadArtifactWorker('compiler'),second);assert.equal(metadataCalls,2);
}));
test('owned eight-second deadline aborts an unfinished fetch and is removed after failure',async()=>mockBrowser(async()=>{
 const originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;let deadline:(()=>void)|undefined,aborted=false,cleared=false;
 globalThis.setTimeout=((callback:()=>void,delay:number)=>{assert.equal(delay,8000);deadline=callback;return 1 as unknown as ReturnType<typeof setTimeout>;}) as typeof setTimeout;globalThis.clearTimeout=(()=>{cleared=true;}) as typeof clearTimeout;
 globalThis.fetch=(async(_input,init)=>new Promise<Response>((_,reject)=>{init?.signal?.addEventListener('abort',()=>{aborted=true;reject(init.signal!.reason);},{once:true});queueMicrotask(()=>deadline?.());})) as typeof fetch;
 try{await assert.rejects(()=>loadArtifactWorker('runtime'),{name:'TimeoutError'});assert.equal(aborted,true);assert.equal(cleared,true);}finally{globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}
}));

test('highly fragmented streams have a bounded chunk count as well as a byte ceiling',async()=>mockBrowser(async()=>{
 const {metadata}=fixture();let cancelled=false;globalThis.fetch=(async input=>String(input).endsWith('/artifact-workers.json')?Response.json(metadata):new Response(new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(Uint8Array.of(32));},cancel(){cancelled=true;}}),{headers:{'Content-Security-Policy':policy}})) as typeof fetch;
 await assert.rejects(()=>loadArtifactWorker('runtime'),/chunk budget/);assert.equal(cancelled,true);
}));
