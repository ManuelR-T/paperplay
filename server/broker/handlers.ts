import {brokerPrepareSchema,brokerStartSchema,brokerJobActionSchema,brokerCanonicalJson} from '../../shared/external-broker';
import {AnalysisHttpError,signToken,verifyToken} from '../analysis/security';
import {brokerSigningKey,brokerSession} from './auth';
import {getBrokerStore,type BrokerStore} from './store';
import {createBrokerService,checkBrokerReview,brokerPublicJob} from './service';
import type {FakeAdapter} from './fake-adapter';
export type BrokerHandlerDependencies={store?:BrokerStore;now?:()=>number;signingSecret?:string;signingKeyPath?:string;allowedOrigin?:string;adapter?:FakeAdapter;creationEnabled?:()=>boolean};
/** Count actual streamed bytes; declared lengths and JSON character counts are never admission limits. */
export async function readBrokerJson(request:Request,max=6*1024*1024):Promise<unknown>{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AnalysisHttpError(415,'Broker requests require JSON.');if(request.headers.get('content-encoding')&&!['identity'].includes(request.headers.get('content-encoding')!))throw new AnalysisHttpError(415,'Compressed broker input is unsupported.');
 if(!request.body||Number(request.headers.get('content-length')??0)>max)throw new AnalysisHttpError(413,'Broker transport exceeds its byte limit.');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new AnalysisHttpError(413,'Broker transport exceeds its byte limit.');}chunks.push(value);}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new AnalysisHttpError(400,'Broker JSON is invalid.');}}finally{reader.releaseLock();}
}
export function createBrokerHandlers(dependencies:BrokerHandlerDependencies={}){
 const now=dependencies.now??Date.now;
 const json=(value:unknown,status=200,cookie?:string)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
 const fail=(error:unknown)=>{const safe=error instanceof AnalysisHttpError?error:new AnalysisHttpError(400,'The broker request failed bounded identity validation. Local reading and prior results remain available.');return json({error:safe.message,uncertain:safe.uncertain},safe.status);};
 const context=(request:Request,create=false)=>{const key=brokerSigningKey({secret:dependencies.signingSecret,path:dependencies.signingKeyPath}),session=brokerSession(request,key,now(),create,dependencies.allowedOrigin??process.env.BROKER_APP_ORIGIN);return {key,session};};
 const environment=()=>{const store=dependencies.store??getBrokerStore();return {store,service:createBrokerService({store,now,adapter:dependencies.adapter,creationEnabled:dependencies.creationEnabled??(()=>process.env.BROKER_DISABLE_CREATION!=='1')})};};
 const authorized=(raw:unknown,owner:string,store:BrokerStore)=>{const {job}=brokerJobActionSchema.parse(raw),record=store.get(job.jobId,owner);const expected=brokerPublicJob(record).job;if(brokerCanonicalJson(job)!==brokerCanonicalJson(expected))throw new AnalysisHttpError(409,'This job reference differs from its immutable run/source identity.');return record;};
 return {
  async prepare(request:Request){try{const {key,session}=context(request,true),{review:raw}=brokerPrepareSchema.parse(await readBrokerJson(request,64*1024)),review=checkBrokerReview(raw),expiresAt=now()+600000,reviewToken=signToken({kind:'broker-review',owner:session.sid,reviewSha256:review.reviewSha256,requestSha256:review.requestSha256,exp:expiresAt},key);return json({reviewToken,expiresAt,reviewSha256:review.reviewSha256},200,session.cookie);}catch(error){return fail(error);}},
  async start(request:Request){try{const {key,session}=context(request),input=brokerStartSchema.parse(await readBrokerJson(request)),review=checkBrokerReview(input.review),token=verifyToken(input.reviewToken,key);if(input.consent.reviewSha256!==review.reviewSha256||token.kind!=='broker-review'||token.owner!==session.sid||token.reviewSha256!==review.reviewSha256||token.requestSha256!==review.requestSha256||typeof token.exp!=='number'||now()>=token.exp)throw new AnalysisHttpError(403,'Explicit consent must match this unexpired reviewed run and browser.');const {service}=environment(),record=await service.start(session.sid,review,input.payloads);return json({job:brokerPublicJob(record)});}catch(error){return fail(error);}},
  async status(request:Request){try{const {session}=context(request),input=await readBrokerJson(request,8192),{store,service}=environment(),record=authorized(input,session.sid,store);return json({job:brokerPublicJob(await service.status(record))});}catch(error){return fail(error);}},
  async cancel(request:Request){try{const {session}=context(request),input=await readBrokerJson(request,8192),{store,service}=environment(),record=authorized(input,session.sid,store);return json({job:brokerPublicJob(await service.cancel(record))});}catch(error){return fail(error);}},
  async collect(request:Request){try{const {session}=context(request),input=await readBrokerJson(request,8192),{store,service}=environment(),record=authorized(input,session.sid,store),result=await service.collect(record);return json({job:brokerPublicJob(result.record),result:result.result});}catch(error){return fail(error);}},
  async list(request:Request){try{const {session}=context(request),input=await readBrokerJson(request,1024);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error();const {store}=environment();return json({jobs:store.list(session.sid).map(brokerPublicJob)});}catch(error){return fail(error);}},
 };
}

let singleton:ReturnType<typeof createBrokerHandlers>|undefined;
/** Constructing handlers performs no persistence, key loading or provider work. */
export function getBrokerHandlers(){return singleton??=createBrokerHandlers();}
