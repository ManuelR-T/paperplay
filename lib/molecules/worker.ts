import {moleculeParseRequestSchema,parsePdbCoordinates} from './parser';
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<unknown>)=>void)|null;postMessage(value:unknown):void};
/** Bounded fixed-column PDB parser only; imported text is never code or a URL. */
scope.onmessage=event=>{
 void(async()=>{let id='';try{const raw=event.data as {protocol?:unknown;id?:unknown;request?:unknown};
 if(!raw||raw.protocol!==1||typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(raw.id)||Object.keys(raw).some(key=>!['protocol','id','request'].includes(key)))throw Error();
 id=raw.id;const request=moleculeParseRequestSchema.parse(raw.request);scope.postMessage({protocol:1,id,status:'started'});scope.postMessage({protocol:1,id,status:'complete',result:await parsePdbCoordinates(request)});
 }catch{if(id)scope.postMessage({protocol:1,id,status:'failed'});}})();
};
