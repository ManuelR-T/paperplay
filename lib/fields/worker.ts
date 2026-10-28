import {normalizeFieldRequest,validateFieldResult} from './model';
import {solveField} from './solver';
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<unknown>)=>void)|null;postMessage(value:unknown):void};
/** Built solely from application-owned fixed thermal-diffusion code, never an imported PDE. */
scope.onmessage=event=>{
 let id='';try{const raw=event.data as {protocol?:unknown;id?:unknown;request?:unknown};
  if(!raw||raw.protocol!==1||typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(raw.id)||Object.keys(raw).some(key=>!['protocol','id','request'].includes(key)))throw Error();
  id=raw.id;const request=normalizeFieldRequest(raw.request).request;scope.postMessage({protocol:1,id,status:'started'});const result=validateFieldResult(solveField(request),request);scope.postMessage({protocol:1,id,status:'complete',result});
 }catch{if(id)scope.postMessage({protocol:1,id,status:'failed'});}
};
