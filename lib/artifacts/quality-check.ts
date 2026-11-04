'use client';
import type { SourceDocument } from '../../shared/schema';
import type { ScientificAsset } from '../../shared/scientific-assets';
import type { FigureCompileRequest,FigureCompileResult } from '../../shared/figure-compilation';
import type { SdkFrame,SdkEvent } from '../../shared/figure-sdk';
import { FIGURE_QUALITY_POLICY,figureQualityDiagnosticSchema,type FigureQualityDiagnostic,type FigureQualityViewport,type FigureTextBounds,type FigureQualityStepId,type FigureQualityFeedback } from '../../shared/figure-quality';
import { buildFigureArtifact,runFigureArtifact,type BuiltFigureArtifact,type FigureExecutionAdapter } from './lifecycle';
import { compileFigureInWorker } from './compiler-client';
import { compilerRequestFromBuild } from './compiler-request';
import { createCompiledFigureAdapter,validateFigureEvent } from './runtime-client';
import { figureRuntimeInput } from './runtime-input';
export type QualityFrameContext={step:number;id:FigureQualityStepId;event:SdkEvent;viewport?:FigureQualityViewport;signal:AbortSignal};
export type QualityObservation={textBounds?:readonly FigureTextBounds[];diagnostics?:readonly FigureQualityDiagnostic[]};
export type FigureQualityOptions={signal?:AbortSignal;adapter?:FigureExecutionAdapter;compile?:(request:FigureCompileRequest,options:{signal?:AbortSignal})=>Promise<FigureCompileResult>;onFrame?:(frame:SdkFrame,context:QualityFrameContext)=>void|QualityObservation|Promise<void|QualityObservation>;viewport?:FigureQualityViewport;promisedInteractions?:boolean;expectNonempty?:boolean;maxFrames?:number;maxDurationMs?:number};
export type FigureQualityResult=Omit<FigureQualityFeedback,'status'>&{status:'passed'|'failed'|'cancelled'|'unavailable';repairable:boolean;steps:{step:number;id:FigureQualityStepId;status:'passed'|'failed'|'skipped'}[]};
export function inspectFigureFrame(frame:SdkFrame,options:{step:number;promisedInteractions?:boolean;expectNonempty?:boolean;textBounds?:readonly FigureTextBounds[];viewport?:FigureQualityViewport}):FigureQualityDiagnostic[]{
 const diagnostics:FigureQualityDiagnostic[]=[];
 const add=(code:FigureQualityDiagnostic['code'],scope:FigureQualityDiagnostic['scope']='artifact',extra:Partial<FigureQualityDiagnostic>={})=>diagnostics.push({code,scope,step:options.step,...(options.viewport?{viewport:options.viewport}:{}),...extra});
 const useful=frame.controls.some(c=>c.kind==='slider'||!c.disabled),entity=frame.marks.some(m=>!!m.entityId),content=frame.marks.length>0||frame.table.rows.length>0;
 if(!content&&(options.expectNonempty||!useful))add('blank-scene');
 if(options.promisedInteractions&&!useful&&!entity)add('unreachable-control','artifact',frame.controls.length?{controlIndex:0}:{});
 if(options.textBounds!==undefined){
  const measured:FigureTextBounds[]=[];
  frame.marks.forEach((mark,markIndex)=>{if(mark.kind!=='text')return;const matches=options.textBounds!.filter(b=>b.markIndex===markIndex);const b=matches[0];
   if(matches.length!==1||!b||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<0||b.height<0){add('missing-text-measurement','host',{markIndex});return;}
   measured.push(b);
   const p=FIGURE_QUALITY_POLICY.viewBoxPadding;
   if(b.x< -p-.5||b.y< -p-.5||b.x+b.width>frame.coordinateSpace.width+p+.5||b.y+b.height>frame.coordinateSpace.height+p+.5)add('text-clipped','artifact',{markIndex});
  });
  // Use host-measured ink, not label strings or guessed font metrics. Mere touching
  // is allowed; a shared strip of ink in both dimensions is not readable.
  const flagged=new Set<string>();
  const overlap=(code:'text-overlap'|'legend-overlap',markIndex:number)=>{const key=`${code}:${markIndex}`;if(!flagged.has(key)){flagged.add(key);add(code,'artifact',{markIndex});}};
  for(let i=0;i<measured.length;i++)for(let j=i+1;j<measured.length;j++){
   const a=measured[i],b=measured[j];
   const width=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
   const height=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
   if(width>Math.min(8,Math.min(a.width,b.width)*.15)&&height>Math.min(3,Math.min(a.height,b.height)*.15)){overlap('text-overlap',a.markIndex);overlap('text-overlap',b.markIndex);}
  }
  const lines=frame.marks.filter((mark):mark is Extract<SdkFrame['marks'][number],{kind:'line'}>=>mark.kind==='line');
  const close=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1])<=3;
  // Only isolated short horizontal segments are legend-swatch candidates. Long
  // axes, attached ticks and joined plot segments remain ordinary drawing marks.
  const swatches=lines.filter(line=>Math.abs(line.to[1]-line.from[1])<=1&&Math.abs(line.to[0]-line.from[0])>=8&&Math.abs(line.to[0]-line.from[0])<=64&&!lines.some(other=>other!==line&&(close(line.from,other.from)||close(line.from,other.to)||close(line.to,other.from)||close(line.to,other.to))));
  for(const b of measured)for(const line of swatches){
   const y=(line.from[1]+line.to[1])/2;
   const width=Math.min(b.x+b.width,Math.max(line.from[0],line.to[0]))-Math.max(b.x,Math.min(line.from[0],line.to[0]));
   if(y>b.y+b.height*.2&&y<b.y+b.height*.8&&width>Math.min(8,b.width*.2))overlap('legend-overlap',b.markIndex);
  }
 }
 return diagnostics.slice(0,FIGURE_QUALITY_POLICY.maxDiagnostics);
}
function bounded(value:number|undefined,fallback:number){return Number.isFinite(value)?Math.max(1,Math.min(fallback,Math.floor(value!))):fallback;}
/** Race host callbacks too: hidden-tab rendering must not hold the session indefinitely. */
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{return new Promise((resolve,reject)=>{const stop=()=>{cleanup();reject(new Error('stopped'));};const cleanup=()=>signal.removeEventListener('abort',stop);signal.addEventListener('abort',stop,{once:true});if(signal.aborted){stop();return;}promise.then(value=>{cleanup();if(signal.aborted)reject(new Error('stopped'));else resolve(value);},error=>{cleanup();reject(error);});});}
export async function runFigureQuality(built:BuiltFigureArtifact,source:SourceDocument,options:FigureQualityOptions={}):Promise<FigureQualityResult>{
 const controller=new AbortController(),signal=controller.signal;let expired=false;
 const cancel=()=>controller.abort();options.signal?.addEventListener('abort',cancel,{once:true});if(options.signal?.aborted)cancel();
 const timer=setTimeout(()=>{expired=true;controller.abort();},bounded(options.maxDurationMs,FIGURE_QUALITY_POLICY.maxDurationMs));
 const diagnostics:FigureQualityDiagnostic[]=[],steps:FigureQualityResult['steps']=[];let framesChecked=0,measured=false,unmeasured=false;
 const push=(d:FigureQualityDiagnostic)=>{if(diagnostics.length>=32)return;const parsed=figureQualityDiagnosticSchema.safeParse(d);if(parsed.success)diagnostics.push(parsed.data);};
 const finish=(status:FigureQualityResult['status']):FigureQualityResult=>({status,diagnostics,framesChecked,textMeasurements:measured&&!unmeasured?'provided':'not-run',repairable:status==='failed'&&diagnostics.length>0&&diagnostics.every(d=>d.scope==='artifact'&&['blank-scene','text-clipped','text-overlap','legend-overlap','unreachable-control','invalid-input','invalid-output','execution'].includes(d.code)),steps});
 const fail=(code:FigureQualityDiagnostic['code'],scope:'host'|'artifact',step=0)=>{push({code,scope,step,...(options.viewport?{viewport:options.viewport}:{})});return finish(scope==='host'?'unavailable':'failed');};
 try{
  if(signal.aborted)throw Error();
  let adapter=options.adapter;
  if(!adapter){
   const compiled=await abortable((options.compile??compileFigureInWorker)(compilerRequestFromBuild(built),{signal}),signal);
   if(compiled.status!=='ready'){
    if(compiled.status==='cancelled')throw Error();
    const repairable=compiled.diagnostics.length>0&&compiled.diagnostics.every(d=>['syntax','entry','dependency','unsupported-syntax','complexity'].includes(d.code));
    return fail(repairable?'invalid-input':'infrastructure',repairable?'artifact':'host');
   }
   adapter=createCompiledFigureAdapter(built,compiled.artifact,compiled.sha256);
  }
  const input=figureRuntimeInput(built),maxFrames=bounded(options.maxFrames,FIGURE_QUALITY_POLICY.maxFrames);
  let frame:SdkFrame|undefined,event:SdkEvent={kind:'initialize'},id:FigureQualityStepId='initialize';let phase=0;
  for(let step=0;step<maxFrames;step++){
   if(signal.aborted)throw Error();
   if(frame)validateFigureEvent(frame,event);
   const run:Awaited<ReturnType<typeof runFigureArtifact>>=await abortable(runFigureArtifact(built,source,{input,state:frame?.state??null,event,signal,executionAdapter:adapter}),signal);
   if(run.status!=='ready'||!('marks'in run.value)){
    if(run.status==='cancelled')throw Error();
    const code=run.status==='ready'?'invalid-output':run.code;
    return ['invalid-input','invalid-output','execution'].includes(code??'')?fail(code as 'execution','artifact',step):fail(code==='integrity'?'integrity':'infrastructure','host',step);
   }
   frame=run.value;framesChecked++;
   const observation=await abortable(Promise.resolve(options.onFrame?.(frame,{step,id,event,viewport:options.viewport,signal})),signal);
   if(frame.marks.some(m=>m.kind==='text')){if(observation?.textBounds!==undefined)measured=true;else unmeasured=true;}
   const found=inspectFigureFrame(frame,{step,promisedInteractions:step===0&&options.promisedInteractions,expectNonempty:options.expectNonempty,textBounds:observation?.textBounds,viewport:options.viewport});
   found.forEach(push);
   observation?.diagnostics?.forEach(d=>{const parsed=figureQualityDiagnosticSchema.safeParse({...d,step,...(options.viewport?{viewport:options.viewport}:{})});if(parsed.success)push(parsed.data);});
   steps.push({step,id,status:diagnostics.length?'failed':'passed'});
   if(diagnostics.length)return finish(diagnostics.some(d=>d.scope==='artifact')?'failed':'unavailable');
   let next:SdkEvent|undefined;
   while(phase<4&&!next){const current=phase++;const slider=frame.controls.find(c=>c.kind==='slider');if(current<2&&slider?.kind==='slider'){id=current===0?'slider-min':'slider-max';next={kind:'control',id:slider.id,value:current===0?slider.min:slider.max};}
    if(current===2){const button=frame.controls.find(c=>c.kind==='button'&&!c.disabled);if(button){id='button';next={kind:'control',id:button.id};}}
    if(current===3){const mark=frame.marks.find(m=>m.entityId);if(mark?.entityId){id='entity';next={kind:'entity',id:mark.entityId};}}
   }
   if(!next){const button=frame.controls.find(c=>c.kind==='button'&&!c.disabled),slider=frame.controls.find(c=>c.kind==='slider');id='sequential';if(button)next={kind:'control',id:button.id};else if(slider?.kind==='slider')next={kind:'control',id:slider.id,value:step%2?slider.min:slider.max};}
   if(!next)break;event=next;
  }
  return finish('passed');
 }catch{
  if(signal.aborted){push({code:expired?'deadline':'cancelled',scope:'host',step:Math.min(framesChecked,11)});return finish(expired?'unavailable':'cancelled');}
  return fail('infrastructure','host',Math.min(framesChecked,11));
 }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);controller.abort();}
}
export async function checkArtifactQuality(artifact:unknown,source:SourceDocument,options:FigureQualityOptions&{assets?:readonly ScientificAsset[]}={}):Promise<FigureQualityResult>{
 const built=await buildFigureArtifact(artifact,source,{assets:options.assets,signal:options.signal});
 if(built.status!=='ready')return {status:options.signal?.aborted?'cancelled':'unavailable',diagnostics:[{code:options.signal?.aborted?'cancelled':'integrity',scope:'host',step:0}],framesChecked:0,textMeasurements:'not-run',repairable:false,steps:[]};
 return runFigureQuality(built.value,source,options);
}
