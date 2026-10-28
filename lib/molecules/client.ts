import {runScheduledWorker,type ExecutionScheduleOptions} from '../execution/scheduler';
import {z} from 'zod';
import {MOLECULAR_GEOMETRY_VERSION,validateMolecularGeometry} from '../../shared/molecular-geometry';
import {sha256,validateScientificAsset} from '../assets/local';
import {moleculeParseRequestSchema,parsePdbCoordinates,type MoleculeParseRequest,type MoleculeParseResult,type MolecularAsset} from './parser';
export const MOLECULE_WORKER_PROTOCOL=1;
export type MoleculeWorker={postMessage(value:unknown):void;terminate():void;onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror?:((event:MessageEvent<unknown>)=>void)|null};
export type MoleculeClientOptions={signal?:AbortSignal;timeoutMs?:number;onProgress?:(status:'starting'|'running')=>void;workerFactory?:()=>MoleculeWorker} & ExecutionScheduleOptions;
const active=new Set<MoleculeWorker>();
export function activeMoleculeExecutions(){return active.size;}
const failureSchema=z.strictObject({status:z.enum(['invalid','unsupported','limit-reached','cancelled']),code:z.string().regex(/^[a-z-]{1,60}$/),message:z.string().min(1).max(500),line:z.number().int().min(1).max(10000).optional()});
/** Transport is not an integrity receipt: the host revalidates the transferred geometry and exact source identity. */
export async function admitMoleculeParseResult(raw:unknown,request:MoleculeParseRequest,sourceSha256:string):Promise<MoleculeParseResult>{
 if(!raw||typeof raw!=='object'||!('status'in raw))throw Error('Invalid coordinate response.');
 if(raw.status!=='ready')return failureSchema.parse(raw);
 if(request.expectedSha256&&request.expectedSha256!==sourceSha256)throw Error('Coordinate source differs from its pinned SHA-256.');
 const result=z.strictObject({status:z.literal('ready'),asset:z.unknown(),sourceSha256:z.string(),warnings:z.array(z.string().max(500)).max(8)}).parse(raw);
 const asset=await validateScientificAsset(result.asset),m=validateMolecularGeometry(asset);
 if(asset.kind!=='geometry'||result.sourceSha256!==sourceSha256||m.source.sha256!==sourceSha256||m.source.byteLength!==request.text.length||asset.id!==request.id||asset.label!==request.label||asset.provenance.fileDigest!==sourceSha256||asset.provenance.origin!=='user-supplied'||asset.provenance.source||asset.provenance.attribution!==request.attribution||asset.provenance.rights!==request.rights||m.classification!==(request.classification??'unknown')||JSON.stringify(m.scalarField)!==JSON.stringify(request.scalarField??{kind:'unknown'}))throw Error('Coordinate response differs from its exact source or declarations.');
 return {...result,asset:asset as MolecularAsset};
}
async function executeMoleculeParseUnscheduled(raw:MoleculeParseRequest,options:MoleculeClientOptions={}):Promise<MoleculeParseResult>{
 // Oversized input is rejected by the parser without hashing or transferring it.
 if(raw&&typeof raw.text==='string'&&raw.text.length>256*1024)return parsePdbCoordinates(raw,{signal:options.signal});
 const request=moleculeParseRequestSchema.parse(raw);
 if(options.signal?.aborted)throw new DOMException('Coordinate import cancelled.','AbortError');
 if(typeof window==='undefined'&&!options.workerFactory)return parsePdbCoordinates(request,{signal:options.signal});
 const digest=await sha256(request.text);if(request.expectedSha256&&request.expectedSha256!==digest)return {status:'invalid',code:'source-digest',message:'The original coordinate bytes differ from the expected SHA-256.'};if(options.signal?.aborted)throw new DOMException('Coordinate import cancelled.','AbortError');
 return new Promise((resolve,reject)=>{
  if(active.size>=2){reject(Error('Stop another coordinate import before starting this one.'));return;}
  let worker:MoleculeWorker,id:string;
  try{id=crypto.randomUUID();worker=options.workerFactory?.()??new Worker(`/molecules.worker.mjs?v=${MOLECULAR_GEOMETRY_VERSION}`,{type:'module',name:'paperplay-molecule'});}catch{reject(Error('Background coordinate import is unavailable. The original file remains available.'));return;}
  active.add(worker);let settled=false,started=false,admitting=false;
  const finish=(error:Error|null,result?:MoleculeParseResult)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();active.delete(worker);if(error)reject(error);else resolve(result!);};
  const abort=()=>finish(new DOMException('Coordinate import cancelled.','AbortError'));
  const timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(30000,options.timeoutMs!)):8000;
  const timer=setTimeout(()=>finish(Error('Background coordinate import reached its time limit.')),timeout);
  options.signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=()=>finish(Error('The coordinate worker failed. The original file remains available.'));
  worker.onmessageerror=()=>finish(Error('The coordinate worker result could not be transferred.'));
  worker.onmessage=event=>{
   if(settled)return;const data=event.data as {protocol?:unknown;id?:unknown;status?:unknown;result?:unknown};
   if(!data||data.protocol!==MOLECULE_WORKER_PROTOCOL||data.id!==id||admitting){finish(Error('The coordinate worker returned an incompatible or stale response.'));return;}
   if(data.status==='started'){if(started){finish(Error('The coordinate worker repeated its start response.'));return;}started=true;try{options.onProgress?.('running');}catch{finish(Error('The coordinate progress observer failed.'));}return;}
   if(data.status!=='complete'){finish(Error('The coordinate request could not complete.'));return;}
   admitting=true;void admitMoleculeParseResult(data.result,request,digest).then(result=>{if(!settled)finish(null,result);},()=>finish(Error('The coordinate worker returned invalid or unrelated geometry.')));
  };
  if(options.signal?.aborted){abort();return;}
  try{options.onProgress?.('starting');}catch{finish(Error('The coordinate progress observer failed.'));return;}if(settled)return;try{worker.postMessage({protocol:MOLECULE_WORKER_PROTOCOL,id,request});}catch{finish(Error('The coordinate input could not be transferred.'));}
 });
}

export async function executeMoleculeParse(raw:MoleculeParseRequest,options:MoleculeClientOptions={}):Promise<MoleculeParseResult>{if(raw&&typeof raw.text==='string'&&raw.text.length>256*1024)return executeMoleculeParseUnscheduled(raw,options);const request=moleculeParseRequestSchema.parse(raw),captured={...options};if(typeof window==='undefined'&&!captured.workerFactory)return executeMoleculeParseUnscheduled(request,captured);return runScheduledWorker('molecule',request,{maxResultBytes:2*1024*1024+4096,maxExecutionMs:Number.isFinite(captured.timeoutMs)?captured.timeoutMs!:8000},signal=>executeMoleculeParseUnscheduled(request,{...captured,signal}),captured);}
