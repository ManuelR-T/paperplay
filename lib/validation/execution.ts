import {validateDocument,validateFigure,type SourceDocument,type FigureSpecification} from '../../shared/schema';
import {validateRepresentationPlan,type RepresentationPlan} from '../../shared/representations';
import {DYNAMICS_SOLVER_VERSION,validateDynamicsRequest,validateDynamicsResult,type DynamicsRequest,type DynamicsResult} from '../../shared/dynamics';
import {engineRegistry,type EngineRun} from '../engines';
import {executeInWorker} from '../execution/client';
import {validateExecutionRequest,validateExecutionResult,type ExecutionResult} from '../execution/protocol';
import {executeDynamics} from '../dynamics/client';
import {hasCheckedAssetIntegrity} from '../assets/local';
import type {ScientificAsset} from '../../shared/scientific-assets';
import {brokerCanonicalJson} from '../../shared/external-broker';
import {sha256} from '../assets/local';
export type ScientificValidationTarget={kind:'legacy-engine';source:SourceDocument;figure:FigureSpecification;seed:number;displayedOutputSha256?:string}|{kind:'dynamics';source:SourceDocument;plan:RepresentationPlan;viewId:string;request?:DynamicsRequest;assets?:readonly ScientificAsset[];displayedOutputSha256?:string};
export function normalizeValidationTarget(raw:ScientificValidationTarget){
 const source=validateDocument(raw.source);
 if(raw.kind==='legacy-engine'){if(!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>4294967295)throw Error('Scientific checks require the exact unsigned seed.');const figure=validateFigure(raw.figure,source,engineRegistry);if(figure.kind==='steps'||figure.kind!=='comparison'&&figure.execution.mode!=='computed')throw Error('No reviewed executable engine exists for this figure.');const bindings=figure.kind==='comparison'?figure.runs.map(r=>r.binding):figure.execution.mode==='computed'?[figure.execution.binding]:[];const request=figure.kind==='comparison'?{kind:'comparison' as const,engineIds:bindings.map(b=>b.engineId),input:figure.input,options:{seed:raw.seed,parametersByEngine:Object.fromEntries(bindings.map(b=>[b.engineId,b.parameters]))}}:{kind:'run' as const,engineId:bindings[0].engineId,input:figure.input,options:{seed:raw.seed,parameters:bindings[0].parameters}};return {kind:'legacy-engine' as const,source,subjectId:figure.id,engines:bindings.map(b=>({id:b.engineId,version:b.engineVersion})),request,identity:{figure:{...figure,...('view'in figure?{view:undefined}:{})},seed:raw.seed},assets:[] as ScientificAsset[]};}
 const plan=validateRepresentationPlan(raw.plan,source),view=plan.views.find(v=>v.id===raw.viewId);if(view?.kind!=='dynamics')throw Error('Scientific checks require the exact selected dynamics view.');const request=validateDynamicsRequest(raw.request??view.dynamics.request),updated={...plan,navigation:undefined,reportedChecks:undefined,views:plan.views.map(v=>v.id===view.id?{...view,dynamics:{...view.dynamics,request}}:v.kind==='molecular-view'?{...v,molecule:{...v.molecule,settings:undefined}}:v.kind==='spatial-view'?{...v,spatial:{...v.spatial,viewport:undefined}}:v.kind==='widget'?{...v,widget:{...v.widget,view:undefined}}:v)};
 const assets=[...(raw.assets??[])];if(assets.some(a=>!hasCheckedAssetIntegrity(a)))throw Error('Scientific checks require integrity-checked selected assets.');return {kind:'dynamics' as const,source,subjectId:view.id,engines:[{id:'dynamics-ode',version:DYNAMICS_SOLVER_VERSION}],request,identity:updated,assets};
}
export type ValidationExecution={kind:'legacy-engine';runs:EngineRun[]}|{kind:'dynamics';result:DynamicsResult};
/** Fixed fresh workers only. Merely accepting a shape-valid caller result would not establish execution authority. */
export async function executeValidationTarget(target:ReturnType<typeof normalizeValidationTarget>,signal?:AbortSignal):Promise<ValidationExecution>{
 if(signal?.aborted)throw new DOMException('Scientific checks cancelled.','AbortError');if(typeof window==='undefined'||typeof Worker==='undefined')throw Error('Independent checking needs a fresh background worker. No server/main-thread fallback was started.');
 if(target.kind==='legacy-engine'){const result=await executeInWorker(target.request,{signal,timeoutMs:30000});const checked=validateExecutionResult(result,validateExecutionRequest({...target.request,version:1,id:'scientific-validation'}));return {kind:'legacy-engine',runs:checked.kind==='run'?[checked.run]:checked.comparison.runs};}
 return {kind:'dynamics',result:validateDynamicsResult(await executeDynamics(target.request,{signal}),target.request)};
}
const semanticRun=(run:EngineRun)=>({engineId:run.engineId,trace:{binding:run.trace.binding,input:run.trace.input,seed:run.trace.seed,status:run.trace.status,steps:run.trace.steps.map(step=>({index:step.index,operations:step.operations,state:step.state})),metrics:run.trace.metrics},result:run.result});
export async function digestValidationOutput(value:EngineRun|EngineRun[]|ExecutionResult|DynamicsResult|ValidationExecution):Promise<string>{
 let projection:unknown;if(Array.isArray(value))projection=value.map(semanticRun);else if('engineId'in value)projection=[semanticRun(value)];else if('format'in value)projection=value;else if(value.kind==='run')projection=[semanticRun(value.run)];else if(value.kind==='comparison')projection=value.comparison.runs.map(semanticRun);else if(value.kind==='legacy-engine')projection=value.runs.map(semanticRun);else if(value.kind==='dynamics')projection=value.result;else projection=value;
 return sha256(brokerCanonicalJson(projection));
}

/** Synchronous scientific request identity for UI cancellation; no execution or authority. */
export function scientificValidationTargetKey(raw:ScientificValidationTarget){const n=normalizeValidationTarget(raw);return brokerCanonicalJson({kind:n.kind,source:{...n.source,anchors:[]},request:n.request,identity:n.identity,assets:n.assets.map(a=>({id:a.id,checksum:a.checksum.value})),displayedOutputSha256:raw.displayedOutputSha256??null});}
