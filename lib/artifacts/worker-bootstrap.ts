'use client';
import { artifactInfrastructureSchema,type ArtifactWorkerKind } from '../../shared/artifact-infrastructure';
import { FIGURE_SDK_SOURCE,sha256Text } from './sdk-source';
const completed=new Map<string,string>();
const MAX_METADATA_BYTES=8*1024,MAX_SCRIPT_BYTES=3*1024*1024,BOOTSTRAP_TIMEOUT_MS=8000;
function aborted(signal:AbortSignal){if(signal.aborted)throw signal.reason instanceof Error?signal.reason:new DOMException('Worker bootstrap cancelled.','AbortError');}
function enforceWorkerCsp(response:Response){
 const header=response.headers.get('content-security-policy');if(!header)throw Error('Worker infrastructure requires an enforced CSP.');
 const policies=header.split(',').map(value=>value.trim());if(policies.some(policy=>!policy))throw Error('Worker infrastructure CSP is invalid.');
 for(const policy of policies){const directives=new Map<string,string[]>();for(const declaration of policy.split(';')){const tokens=declaration.trim().split(/\s+/);if(!tokens[0])continue;const name=tokens[0].toLowerCase();if(directives.has(name))throw Error('Worker infrastructure CSP has duplicate directives.');directives.set(name,tokens.slice(1).map(value=>value.toLowerCase()));}
  for(const name of ['connect-src','worker-src']){const tokens=directives.get(name);if(!tokens||tokens.length!==1||tokens[0]!=="'none'")throw Error('Worker infrastructure must deny connections and nested workers.');}
  const scripts=directives.get('script-src');if(!scripts||scripts.length!==2||!scripts.includes("'self'")||!scripts.includes("'wasm-unsafe-eval'"))throw Error('Worker infrastructure must allow only the required WASM evaluation policy.');
 }
}
async function readBounded(response:Response,limit:number,signal:AbortSignal){
 aborted(signal);if(!response.ok||!response.body)throw Error('Worker infrastructure is unavailable.');const declared=response.headers.get('content-length');if(declared&&/^\d+$/.test(declared)&&Number(declared)>limit){void response.body.cancel().catch(()=>{});throw Error('Worker infrastructure exceeds its byte budget.');}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;const cancel=()=>{void reader.cancel(signal.reason).catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{while(true){aborted(signal);const part=await reader.read();aborted(signal);if(part.done)break;if(chunks.length>=4096)throw Error('Worker infrastructure exceeds its streaming chunk budget.');length+=part.value.byteLength;if(length>limit)throw Error('Worker infrastructure exceeds its streaming byte budget.');chunks.push(part.value);}}
 catch(error){void reader.cancel().catch(()=>{});throw error;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
/** Return only a verified same-origin URL. Never evaluates source or constructs a blob worker. */
export async function loadArtifactWorker(kind:ArtifactWorkerKind,signal?:AbortSignal):Promise<string>{
 if(kind!=='compiler'&&kind!=='runtime')throw Error('Unknown artifact infrastructure kind.');if(typeof location==='undefined'||!/^https?:$/.test(new URL(location.origin).protocol))throw Error('Worker infrastructure needs a browser HTTP(S) origin.');
 const origin=location.origin,controller=new AbortController(),cancel=()=>controller.abort(signal?.reason??new DOMException('Worker bootstrap cancelled.','AbortError'));
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(()=>controller.abort(new DOMException('Worker bootstrap timed out.','TimeoutError')),BOOTSTRAP_TIMEOUT_MS);
 try{
  aborted(controller.signal);const sdkSha256=await sha256Text(FIGURE_SDK_SOURCE);aborted(controller.signal);const key=`${origin}|${kind}|${sdkSha256}`,cached=completed.get(key);if(cached)return cached;
  const metadataUrl=new URL('/artifact-workers.json',origin).href,metadataResponse=await fetch(metadataUrl,{cache:'no-store',credentials:'same-origin',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
  if(metadataResponse.url&&metadataResponse.url!==metadataUrl)throw Error('Worker metadata came from an unexpected URL.');
  const metadataBytes=await readBounded(metadataResponse,MAX_METADATA_BYTES,controller.signal);let metadata;try{metadata=artifactInfrastructureSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(metadataBytes)));}catch{throw Error('Worker infrastructure metadata failed validation.');}if(metadata.sdkSha256!==sdkSha256)throw Error('Worker infrastructure does not match the installed SDK.');
  const reference=metadata.workers[kind],url=new URL(reference.url,origin).href;if(new URL(url).origin!==origin)throw Error('Worker infrastructure must stay on the application origin.');
  const response=await fetch(url,{cache:'force-cache',credentials:'same-origin',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});if(response.url&&response.url!==url)throw Error('Worker infrastructure came from an unexpected URL.');enforceWorkerCsp(response);
  const bytes=await readBounded(response,MAX_SCRIPT_BYTES,controller.signal),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');aborted(controller.signal);if(sha256!==reference.sha256)throw Error('Worker infrastructure byte digest differs.');
  completed.set(key,url);return url;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();}
}
