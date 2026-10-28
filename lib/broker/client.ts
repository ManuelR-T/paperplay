import {z} from 'zod';
import {BROKER_ADAPTER,BROKER_DISCLOSURE,brokerCanonicalJson,brokerBudgetSchema,brokerReviewSchema,brokerJobRefSchema,brokerJobSchema,brokerResultEnvelopeSchema,validateBrokerRun,createDefaultBrokerBudget,type BrokerReview,type BrokerRunRequest,type BrokerJobRef,type BrokerPublicJob,type BrokerResultEnvelope} from '../../shared/external-broker';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import type {ScientificAsset} from '../../shared/scientific-assets';
import {hasCheckedAssetIntegrity,sha256,validateScientificAsset} from '../assets/local';
import {datasetSourceFingerprint} from '../datasets/model';

export type BrokerTransport={fetcher?:typeof fetch;signal?:AbortSignal;timeoutMs?:number};
export type PreparedBrokerRun=Readonly<{review:BrokerReview;payloads:readonly Readonly<{id:string;serialized:string}>[]}>;
export class BrokerClientError extends Error{
 readonly uncertain:boolean;readonly status?:number;readonly original?:string;readonly originalComplete?:boolean;
 constructor(message:string,details:{uncertain?:boolean;status?:number;original?:string;originalComplete?:boolean}={}){super(message);this.name='BrokerClientError';this.uncertain=details.uncertain??false;this.status=details.status;this.original=details.original;this.originalComplete=details.originalComplete;}
}
const preparedHere=new WeakSet<object>();
const freeze=(value:unknown)=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
const bytes=(text:string)=>new TextEncoder().encode(text).byteLength;
const same=(a:unknown,b:unknown)=>brokerCanonicalJson(a)===brokerCanonicalJson(b);
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted){if(signal.reason instanceof BrokerClientError)throw signal.reason;throw new DOMException('Broker operation cancelled locally; an accepted job may still be running.','AbortError');}};

/** Browser-only review preparation. Empty selection is intentional and never means all assets. */
export async function prepareBrokerRun(input:{source:SourceDocument;assets?:readonly ScientificAsset[];budget?:BrokerRunRequest['budget']}):Promise<PreparedBrokerRun>{
 const source=validateDocument(input.source),budget=brokerBudgetSchema.parse(input.budget??createDefaultBrokerBudget()),assets=input.assets??[];
 if(assets.length>8||new Set(assets.map(asset=>asset.id)).size!==assets.length)throw new BrokerClientError('Select at most eight distinct checked assets.');
 const payloads:{id:string;serialized:string}[]=[],selected:BrokerRunRequest['selected']=[];
 for(const asset of assets){
  if(!hasCheckedAssetIntegrity(asset))throw new BrokerClientError('Review requires the exact integrity-checked local asset, not an imported declaration.');
  await validateScientificAsset(asset,source);
  const serialized=JSON.stringify(asset),byteLength=bytes(serialized);
  if(byteLength>budget.maxInputBytes||selected.reduce((sum,item)=>sum+item.byteLength,0)+byteLength>budget.maxInputBytes)throw new BrokerClientError('Selected manifest bytes exceed this run’s upload budget.');
  payloads.push({id:asset.id,serialized});selected.push({id:asset.id,manifestChecksum:asset.checksum.value,byteLength,byteSha256:await sha256(serialized)});
 }
 const run=validateBrokerRun({format:'paperplay-broker-run',schemaVersion:1,runId:crypto.randomUUID(),adapter:{id:BROKER_ADAPTER.id,version:BROKER_ADAPTER.version},source:{documentId:source.id,sourceVersion:source.sourceVersion,fingerprint:await datasetSourceFingerprint(source)},selected,budget});
 const body={format:'paperplay-broker-review' as const,schemaVersion:1 as const,run,requestSha256:await sha256(brokerCanonicalJson(run)),disclosure:BROKER_DISCLOSURE};
 const review=brokerReviewSchema.parse({...body,reviewSha256:await sha256(brokerCanonicalJson(body))});
 const prepared={review,payloads};freeze(prepared);preparedHere.add(prepared);return prepared;
}

async function validatePreparation(prepared:PreparedBrokerRun){
 if(!preparedHere.has(prepared))throw new BrokerClientError('Prepare and inspect a fresh local selection before authorizing a run.');
 const review=brokerReviewSchema.parse(prepared.review),run=validateBrokerRun(review.run),{reviewSha256,...body}=review;
 if(await sha256(brokerCanonicalJson(run))!==review.requestSha256||await sha256(brokerCanonicalJson(body))!==reviewSha256||!same(review.disclosure,BROKER_DISCLOSURE))throw new BrokerClientError('The review changed; inspect and authorize the exact selection again.');
 if(prepared.payloads.length!==run.selected.length)throw new BrokerClientError('The reviewed input selection changed.');
 for(const [index,payload]of prepared.payloads.entries()){
  const expected=run.selected[index];if(payload.id!==expected.id||bytes(payload.serialized)!==expected.byteLength||await sha256(payload.serialized)!==expected.byteSha256)throw new BrokerClientError('The selected bytes differ from the immutable review.');
 }
 return review;
}

const RESPONSE_BYTES=6*1024*1024;
type BrokerAction='prepare'|'start'|'status'|'cancel'|'collect'|'list';
async function post(path:BrokerAction,body:unknown,options:BrokerTransport={},recoverOriginal=false):Promise<{value:unknown;text:string}>{
 aborted(options.signal);const controller=new AbortController(),forward=()=>controller.abort();
 options.signal?.addEventListener('abort',forward,{once:true});
 const timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(30000,options.timeoutMs!)):30000;
 const timer=setTimeout(()=>controller.abort(new BrokerClientError('The broker transport reached its time limit. Recover the existing job; no replacement was submitted.',{uncertain:path==='start'})),timeout);
 try{return await postBounded(path,body,{...options,signal:controller.signal},recoverOriginal);}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',forward);}
}
async function postBounded(path:BrokerAction,body:unknown,options:BrokerTransport,recoverOriginal:boolean):Promise<{value:unknown;text:string}>{
 aborted(options.signal);let response:Response;
 try{response=await (options.fetcher??fetch)(`/api/broker/${path}`,{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:options.signal});}
 catch{aborted(options.signal);throw new BrokerClientError(path==='start'?'Submission outcome is unknown. Recover the existing job; no replacement was submitted.':'The broker could not be reached. Local data and the previous result remain available.',{uncertain:path==='start'});}
 let text='';
 try{
  if(!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{while(true){aborted(options.signal);const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>RESPONSE_BYTES){await reader.cancel();throw new BrokerClientError('Broker response exceeds its transport limit.');}chunks.push(item.value);}}
  finally{reader.releaseLock();}
  const combined=new Uint8Array(length);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.length;}text=new TextDecoder('utf-8',{fatal:true}).decode(combined);
  const value:unknown=JSON.parse(text);
  if(!response.ok){const message=value&&typeof value==='object'&&'error'in value&&typeof value.error==='string'&&value.error.length<=500?value.error:'The broker rejected this action. Local inputs and previous results remain available.';throw new BrokerClientError(message,{status:response.status,uncertain:path==='start'&&response.status>=500,...(recoverOriginal?{original:text,originalComplete:true}:{})});}
  return {value,text};
 }catch(error){aborted(options.signal);if(error instanceof BrokerClientError)throw error;throw new BrokerClientError('The broker returned an unreadable or interrupted response. Previous results remain available.',{uncertain:path==='start',...(recoverOriginal&&text?{original:text,originalComplete:true}:{})});}
}
function publicJob(raw:unknown,expected?:BrokerJobRef){
 const job=brokerJobSchema.parse(raw);
 if(expected&&!same(job.job,expected))throw new BrokerClientError('The broker returned another run or source.');
 if(job.deadlineAt<job.createdAt||job.deadlineAt-job.createdAt>job.budget.maxWallMs||job.resources.inputBytes>job.budget.maxInputBytes||job.resources.outputBytes>job.budget.maxOutputBytes||job.resources.statusCalls>job.budget.maxStatusCalls||job.resources.collects>job.budget.maxCollects)throw new BrokerClientError('The broker returned resource accounting outside the authorized budget.');
 freeze(job);return job;
}

/** Call only from the explicit per-run consent action. No automatic retry or repair is performed. */
export async function startBrokerRun(prepared:PreparedBrokerRun,consent:{accepted:true;reviewSha256:string},options:BrokerTransport={}):Promise<BrokerPublicJob>{
 const review=await validatePreparation(prepared);
 if(consent.accepted!==true||consent.reviewSha256!==review.reviewSha256)throw new BrokerClientError('Explicit consent must match the exact reviewed upload and budget.');
 const tokenReply=await post('prepare',{review},options);
 const token=z.strictObject({reviewToken:z.string().min(1).max(5000),expiresAt:z.number().int().nonnegative(),reviewSha256:z.string().regex(/^[a-f0-9]{64}$/)}).parse(tokenReply.value);
 if(token.reviewSha256!==review.reviewSha256||token.expiresAt<=Date.now())throw new BrokerClientError('The upload review is stale; inspect and authorize it again.');
 const response=await post('start',{review,reviewToken:token.reviewToken,consent,payloads:prepared.payloads},options);
 const envelope=z.strictObject({job:brokerJobSchema}).parse(response.value),job=publicJob(envelope.job);
 if(job.job.runId!==review.run.runId||job.job.requestSha256!==review.requestSha256||job.job.sourceFingerprint!==review.run.source.fingerprint||!same(job.adapter,review.run.adapter)||!same(job.budget,review.run.budget)||job.resources.inputBytes!==review.run.selected.reduce((sum,item)=>sum+item.byteLength,0))throw new BrokerClientError('Accepted job identity differs from the reviewed run.',{uncertain:true});
 return job;
}
export async function listBrokerJobs(options:BrokerTransport={}):Promise<BrokerPublicJob[]>{
 const response=await post('list',{},options),envelope=z.strictObject({jobs:z.array(brokerJobSchema).max(128)}).parse(response.value);
 const jobs=envelope.jobs.map(job=>publicJob(job));if(new Set(jobs.map(job=>job.job.jobId)).size!==jobs.length)throw new BrokerClientError('The broker returned duplicate job identities.');return jobs;
}
async function action(path:'status'|'cancel',raw:BrokerJobRef,options:BrokerTransport){
 const ref=brokerJobRefSchema.parse(raw),response=await post(path,{job:ref},options),envelope=z.strictObject({job:brokerJobSchema}).parse(response.value);return publicJob(envelope.job,ref);
}
export function getBrokerStatus(job:BrokerJobRef,options:BrokerTransport={}){return action('status',job,options);}
export function cancelBrokerJob(job:BrokerJobRef,options:BrokerTransport={}){return action('cancel',job,options);}

/** Collection is inert validation. It neither creates a new job nor executes returned code. */
export async function collectBrokerResult(expected:BrokerPublicJob,options:BrokerTransport&{source:SourceDocument;prepared?:PreparedBrokerRun}):Promise<{job:BrokerPublicJob;result:BrokerResultEnvelope;asset:ScientificAsset}>{
 const previous=publicJob(expected),source=validateDocument(options.source),fingerprint=await datasetSourceFingerprint(source);
 if(previous.job.sourceFingerprint!==fingerprint)throw new BrokerClientError('Open the exact original source before collecting this result.');
 const response=await post('collect',{job:previous.job},options,true);let original=response.text;
 try{
  const envelope=z.strictObject({job:brokerJobSchema,result:brokerResultEnvelopeSchema}).parse(response.value),job=publicJob(envelope.job,previous.job),result=envelope.result;
  original=result.output.serialized;
  if(job.state!=='completed'||!same(job.budget,previous.budget)||!same(result.job,job.job)||!same(result.adapter,job.adapter)||!same(result.source,{documentId:source.id,sourceVersion:source.sourceVersion,fingerprint})||result.output.byteLength>job.budget.maxOutputBytes||bytes(result.output.serialized)!==result.output.byteLength||await sha256(result.output.serialized)!==result.output.byteSha256||job.resources.outputBytes!==result.output.byteLength)throw Error();
  const run=validateBrokerRun({format:'paperplay-broker-run',schemaVersion:1,runId:job.job.runId,adapter:result.adapter,source:result.source,selected:result.inputs,budget:job.budget});
  const requestSha256=await sha256(brokerCanonicalJson(run));if(requestSha256!==job.job.requestSha256||run.selected.reduce((sum,item)=>sum+item.byteLength,0)!==job.resources.inputBytes)throw Error();
  const reviewBody={format:'paperplay-broker-review',schemaVersion:1,run,requestSha256,disclosure:BROKER_DISCLOSURE};
  if(await sha256(brokerCanonicalJson(reviewBody))!==result.reviewSha256)throw Error();
  if(options.prepared){const prepared=await validatePreparation(options.prepared);if(prepared.requestSha256!==requestSha256||prepared.reviewSha256!==result.reviewSha256||!same(prepared.run,run))throw Error();}
  const parsed:unknown=JSON.parse(result.output.serialized),asset=await validateScientificAsset(parsed,source);
  if(asset.checksum.value!==result.output.manifestChecksum||asset.provenance.origin!=='illustrative')throw Error();
  aborted(options.signal);freeze(result);return {job,result,asset};
 }catch(error){aborted(options.signal);throw new BrokerClientError('The returned engineering result failed exact identity, byte, schema or source validation. The previous result is retained; original returned bytes are available for explicit recovery.',{original,originalComplete:true});}
}
