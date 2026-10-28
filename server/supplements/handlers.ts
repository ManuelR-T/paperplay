import {requireSameOrigin,AnalysisHttpError} from '../analysis/security';
import {supplementRetrieveSchema} from '../../lib/extraction/supplements';
import {createSupplementService} from './service';

/** Public read-only file retrieval needs no provider key, private upload or arbitrary URL. */
export function createSupplementHandlers(options:{service?:ReturnType<typeof createSupplementService>;allowedOrigin?:string}={}){
 const service=options.service??createSupplementService();
 return {async retrieve(request:Request){
  try{
   requireSameOrigin(request,options.allowedOrigin);
   if(!request.headers.get('content-type')?.includes('application/json')||request.headers.get('content-encoding')&&request.headers.get('content-encoding')!=='identity')throw new AnalysisHttpError(415,'Supplement review requires uncompressed JSON.');
   if(!request.body||Number(request.headers.get('content-length')??0)>16384)throw new AnalysisHttpError(413,'Supplement review exceeds 16 KiB.');
   const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>16384){await reader.cancel();throw new AnalysisHttpError(413,'Supplement review exceeds 16 KiB.');}chunks.push(part.value);}}finally{reader.releaseLock();}
   const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))),input=supplementRetrieveSchema.parse(raw);
   if(input.consent.reviewSha256!==input.review.reviewSha256)throw new AnalysisHttpError(403,'Explicit consent differs from this supplement disclosure.');
   const result=await service.retrieve(input.review,request.signal);
   return Response.json({metadata:result.metadata,base64:Buffer.from(result.bytes).toString('base64')},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){const status=error instanceof AnalysisHttpError?error.status:502;return Response.json({error:status===502?'The reviewed supplement could not be retrieved or its pinned bytes did not match. Open its original record or choose a local file.':'The bounded supplement review or explicit consent was rejected.'},{status,headers:{'Cache-Control':'no-store'}});}
 }};
}
let handlers:ReturnType<typeof createSupplementHandlers>|undefined;
export function getSupplementHandlers(){return handlers??=createSupplementHandlers();}
