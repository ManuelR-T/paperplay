import { DYNAMICS_LIMITS } from '../../shared/dynamics';
import { normalizeDynamicsRequest,validateDynamicsResult } from './model';
import { solveDynamics } from './solver';
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<unknown>)=>void)|null;postMessage(value:unknown):void};
/** This entry is built exclusively from application-owned numerical code. */
scope.onmessage=event=>{
 let id='';
 try{
  const raw=event.data as {protocol?:unknown;id?:unknown;request?:unknown};
  if(!raw||raw.protocol!==1||typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(raw.id)||Object.keys(raw).some(key=>!['protocol','id','request'].includes(key)))throw Error();
  id=raw.id;const request=normalizeDynamicsRequest(raw.request).request;scope.postMessage({protocol:1,id,status:'started'});
  const result=validateDynamicsResult(solveDynamics(request),request);if(new TextEncoder().encode(JSON.stringify(result)).byteLength>DYNAMICS_LIMITS.maxResultBytes)throw Error();
  scope.postMessage({protocol:1,id,status:'complete',result});
 }catch{if(id)scope.postMessage({protocol:1,id,status:'failed'});}
};
