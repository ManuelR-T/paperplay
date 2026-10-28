'use client';
import { generationCandidateSchema,type GenerationCandidate,type GenerationFeedback } from '../../shared/artifact-generation';
import type { SourceDocument } from '../../shared/schema';
import { canonicalArtifactJson,type FigureCompileResult,type FigureCompileRequest } from '../../shared/figure-compilation';
import { sha256Text } from './sdk-source';
import { buildFigureArtifact,runFigureArtifact,type BuiltFigureArtifact,type FigureExecutionAdapter } from './lifecycle';
import { compilerRequestFromBuild } from './compiler-request';
import { compileFigureInWorker } from './compiler-client';
import { createCompiledFigureAdapter,validateFigureEvent } from './runtime-client';
import { figureRuntimeInput } from './runtime-input';
import type { SdkEvent,SdkFrame } from '../../shared/figure-sdk';
export type GenerationCheck={id:string;status:'passed'|'failed'|'skipped';message:string};
export type GenerationCheckResult={feedback:GenerationFeedback;checks:GenerationCheck[];repairable:boolean};
type ReadyCompile=Extract<FigureCompileResult,{status:'ready'}>;
type Options={signal?:AbortSignal;compile?:(request:FigureCompileRequest,options:{signal?:AbortSignal})=>Promise<FigureCompileResult>;adapter?:(built:BuiltFigureArtifact,compiled:ReadyCompile)=>FigureExecutionAdapter};
/** Application-owned smoke scenarios. These check executable structure, never scientific correctness. */
export async function checkGeneratedCandidate(candidate:GenerationCandidate,source:SourceDocument,options:Options={}):Promise<GenerationCheckResult>{
 const checks:GenerationCheck[]=[],feedback:GenerationFeedback={candidateSha256:candidate.sha256,compiler:{status:'not-run',diagnostics:[]},runtime:{status:'not-run'}};
 const result=(repairable=false):GenerationCheckResult=>({feedback,checks,repairable});
 const cancelled=()=>{if(!options.signal?.aborted)return false;feedback.runtime={status:'cancelled'};checks.push({id:'cancelled',status:'skipped',message:'Local checks stopped. No replacement model request was started.'});return true;};
 if(cancelled())return result();
 try{generationCandidateSchema.parse(candidate);if(candidate.sha256!==await sha256Text(canonicalArtifactJson({plan:candidate.plan,artifact:candidate.artifact})))throw Error();}
 catch{feedback.compiler={status:'rejected',diagnostics:[{code:'integrity'}]};checks.push({id:'candidate-integrity',status:'failed',message:'The candidate content digest or contract does not match.'});return result();}
 const built=await buildFigureArtifact(candidate.artifact,source,{signal:options.signal});
 if(cancelled())return result();
 if(built.status!=='ready'||built.value.manifest.kind!=='generated'){feedback.compiler={status:'rejected',diagnostics:[{code:'entry'}]};checks.push({id:'manifest',status:'failed',message:'The generated manifest does not fit the source, SDK or declared interface.'});return result(true);}
 const executable=built.value;
 checks.push({id:'manifest',status:'passed',message:'Exact source, manifest and SDK bindings checked.'});
 let compiled:FigureCompileResult;
 try{compiled=await(options.compile??compileFigureInWorker)(compilerRequestFromBuild(built.value),{signal:options.signal});}
 catch{feedback.compiler={status:'unavailable',diagnostics:[{code:'unavailable'}]};checks.push({id:'compiler',status:'failed',message:'Local compiler infrastructure is unavailable. No paid repair is needed.'});return result();}
 if(cancelled()||compiled.status==='cancelled'){feedback.compiler={status:'cancelled',diagnostics:[]};return result();}
 if(compiled.status!=='ready'){
  feedback.compiler={status:compiled.status,diagnostics:compiled.diagnostics.slice(0,4).map(({code,position})=>({code,...(position===undefined?{}:{position})}))};
  checks.push({id:'compiler',status:'failed',message:'Syntax or execution policy admission failed; inspect the bounded diagnostic codes.'});
  return result(compiled.diagnostics.length>0&&compiled.diagnostics.every(d=>['syntax','entry','dependency','unsupported-syntax','complexity'].includes(d.code)));
 }
 feedback.compiler={status:'ready',diagnostics:[]};checks.push({id:'compiler',status:'passed',message:'The synchronous script passed syntax and dependency admission.'});
 let adapter:FigureExecutionAdapter,input:ReturnType<typeof figureRuntimeInput>;
 try{adapter=options.adapter?.(built.value,compiled)??createCompiledFigureAdapter(built.value,compiled.artifact,compiled.sha256);input=figureRuntimeInput(built.value);}
 catch{feedback.runtime={status:'failed',code:'integrity'};checks.push({id:'runtime-admission',status:'failed',message:'The local execution receipt or input binding could not be admitted.'});return result();}
 async function scenario(id:string,event:SdkEvent,state:unknown):Promise<SdkFrame|null>{
  if(cancelled())return null;
  const run=await runFigureArtifact(executable,source,{executionAdapter:adapter,input,state,event,signal:options.signal});
  if(cancelled()||run.status==='cancelled'){feedback.runtime={status:'cancelled'};return null;}
  if(run.status!=='ready'||!('marks'in run.value)){
   feedback.runtime={status:'failed',code:run.status==='ready'?'invalid-output':run.code??'unavailable'};
   checks.push({id,status:'failed',message:'The local scenario did not return a valid bounded SDK frame. The paper remains unchanged.'});return null;
  }
  checks.push({id,status:'passed',message:id==='initialize'?'Initial frame, values and source links validated.':'A declared interaction returned a valid bounded frame.'});return run.value;
 }
 const initial=await scenario('initialize',{kind:'initialize'},null);
 const failed=()=>result(feedback.runtime.status==='failed'&&['invalid-input','invalid-output','execution'].includes(feedback.runtime.code??''));
 if(!initial)return failed();
 const scenarios:{id:string;event:SdkEvent}[]=[];
 const slider=initial.controls.find(c=>c.kind==='slider');if(slider?.kind==='slider'){scenarios.push({id:'slider-min',event:{kind:'control',id:slider.id,value:slider.min}},{id:'slider-max',event:{kind:'control',id:slider.id,value:slider.max}});}
 const button=initial.controls.find(c=>c.kind==='button'&&!c.disabled);if(button)scenarios.push({id:'button',event:{kind:'control',id:button.id}});
 const entity=initial.marks.find(mark=>mark.entityId);if(entity?.entityId)scenarios.push({id:'entity',event:{kind:'entity',id:entity.entityId}});
 for(const {id,event} of scenarios){validateFigureEvent(initial,event);if(!await scenario(id,event,initial.state))return failed();}
 if(!scenarios.length)checks.push({id:'interactions',status:'skipped',message:'The initial frame declares no enabled interaction. Only initialization was checked.'});
 feedback.runtime={status:'ready'};checks.push({id:'evidence',status:'skipped',message:'These smoke scenarios do not verify equations, experimental claims or scientific accuracy.'});return result();
}
