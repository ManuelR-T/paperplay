import {adoptionPolicySchema,readAdoptionPolicy,type AdoptionPolicy,type AdoptionPolicySnapshot} from '../../shared/adoption';
export class AdoptionPolicyError extends Error{constructor(){super('Generated execution is unavailable under the current operator policy. Source and recorded replay remain available.');this.name='AdoptionPolicyError';}}
/** The transport is a trusted host dependency; no bundle importer installs policy. */
export function createAdoptionPolicyHost(load:()=>Promise<unknown>){
 let snapshot:AdoptionPolicySnapshot=Object.freeze({state:'unknown',epoch:0,policy:null});
 const listeners=new Set<()=>void>(),active=new Set<AbortController>();let pending:Promise<AdoptionPolicySnapshot>|undefined;
 function publish(policy:AdoptionPolicy|null,state:AdoptionPolicySnapshot['state']){
  const changed=snapshot.state!==state||JSON.stringify(snapshot.policy)!==JSON.stringify(policy);
  if(!changed)return snapshot;
  snapshot=Object.freeze({state,epoch:snapshot.epoch+1,policy:policy?Object.freeze(policy):null});
  if(!policy?.generatedExecution){for(const controller of active)controller.abort(new DOMException('Generated execution disabled by operator','AbortError'));active.clear();}
  for(const listener of listeners)try{listener();}catch{/* UI observers do not own policy. */}return snapshot;
 }
 function refresh(){if(pending)return pending;pending=(async()=>{try{return publish(adoptionPolicySchema.parse(await load()),'ready');}catch{return publish(null,'unavailable');}finally{pending=undefined;}})();return pending;}
 return Object.freeze({getSnapshot:()=>snapshot,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},refresh,
  async acquire(signal?:AbortSignal){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const epoch=snapshot.epoch;const current=await refresh();
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   // A disable/re-enable cycle during preparation must not resurrect old work.
   if(current.state!=='ready'||!current.policy?.generatedExecution||current.epoch>epoch+1)throw new AdoptionPolicyError();
   const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});active.add(controller);
   return Object.freeze({signal:controller.signal,assertCurrent(){if(controller.signal.aborted||!snapshot.policy?.generatedExecution||snapshot.state!=='ready')throw new DOMException('Generated execution stopped by operator policy','AbortError');},dispose(){active.delete(controller);signal?.removeEventListener('abort',abort);}});
  }
 });
}
export type AdoptionPolicyHost=ReturnType<typeof createAdoptionPolicyHost>;
let host:AdoptionPolicyHost|undefined;
function currentHost(){return host??=createAdoptionPolicyHost(async()=>{
 if(typeof window==='undefined')return readAdoptionPolicy(process.env);
 const response=await fetch('/api/adoption-policy',{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new AdoptionPolicyError();
 if(!response.body)throw new AdoptionPolicyError();const reader=response.body.getReader();let text='',bytes=0,chunks=0;const decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096||++chunks>128)throw new AdoptionPolicyError();text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}catch(error){void reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
});}
export const getAdoptionPolicySnapshot=()=>currentHost().getSnapshot();
export const subscribeAdoptionPolicy=(listener:()=>void)=>currentHost().subscribe(listener);
export const refreshAdoptionPolicy=()=>currentHost().refresh();
export async function withGeneratedExecution<T>(signal:AbortSignal|undefined,run:(signal:AbortSignal,assertCurrent:()=>void)=>Promise<T>,trustedHost:AdoptionPolicyHost=currentHost()):Promise<T>{const permit=await trustedHost.acquire(signal);try{permit.assertCurrent();return await run(permit.signal,permit.assertCurrent);}finally{permit.dispose();}}
