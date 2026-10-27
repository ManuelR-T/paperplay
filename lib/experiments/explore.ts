import { engineRegistry, runEngine, type EngineRun } from '../engines';
import { algorithmInputSchema, validateTrace, type AlgorithmInput } from '../../shared/schema';
import { z } from 'zod';

const axisSchema = z.strictObject({ key:z.string().min(1).max(100), values:z.array(z.number().finite()).min(1).max(25) });
export const experimentPlanSchema = z.strictObject({ engineId:z.string().min(1).max(100), engineVersion:z.string(), input:algorithmInputSchema, seed:z.number().int().min(0).max(4294967295), parameters:z.record(z.string(),z.number().finite()), axes:z.array(axisSchema).max(2) });
export type ExperimentPlan = z.infer<typeof experimentPlanSchema>;
export type Trial = { id:string; parameters:Record<string,number>; status:'completed'|'cancelled'|'limit-reached'|'failed'|'unmeasured'; metrics:Array<{id:string;value:number;unit:string}>; error?:string; converged?:boolean };
export type TrialRunner = (plan:ExperimentPlan, parameters:Record<string,number>,signal?:AbortSignal)=>Promise<EngineRun>;
export type PinnedExperiment = {trial:Trial; plan:ExperimentPlan};

export function planTrials(input:unknown) {
  const plan=experimentPlanSchema.parse(input);const engine=engineRegistry.find(x=>x.id===plan.engineId&&x.version===plan.engineVersion);
  if(!engine||engine.inputKind!==plan.input.kind)throw Error('The engine version/input family is incompatible.');
  if(new Set(plan.axes.map(a=>a.key)).size!==plan.axes.length)throw Error('Choose different parameter axes.');
  const validate=(key:string,value:number)=>{const p=engine.parameters.find(p=>p.key===key);if(!p||value<p.min||value>p.max||Math.abs((value-p.min)/p.step-Math.round((value-p.min)/p.step))>1e-7)throw Error(`Parameter ${key} is outside its declared domain or step.`);};
  for(const [key,value]of Object.entries(plan.parameters))validate(key,value);
  for(const p of engine.parameters)if(plan.parameters[p.key]===undefined)throw Error(`Missing parameter ${p.key}.`);
  for(const a of plan.axes)for(const v of a.values)validate(a.key,v);
  let trials=[{...plan.parameters}];for(const axis of plan.axes)trials=trials.flatMap(p=>axis.values.map(value=>({...p,[axis.key]:value})));
  if(trials.length>25)throw Error('A sweep supports at most 25 actual trials.');
  if(trials.reduce((n,p)=>n+(p.operationLimit??10000),0)>250000)throw Error('The combined operation allowance exceeds 250,000.');
  return {plan,parameters:trials};
}

/** UI passes the worker adapter. Tests and CLI cross this same interface using a trusted direct adapter. */
export async function executeSweep(input:unknown,runner:TrialRunner,options:{signal?:AbortSignal;onTrial?:(trial:Trial,index:number)=>void}={}) {
  const {plan,parameters}=planTrials(input);const trials:Trial[]=[];
  for(const [index,p]of parameters.entries()) {
    if(options.signal?.aborted)break;
    let trial:Trial;
    try {
      const run=await runner(plan,p,options.signal);validateTrace(run.trace,engineRegistry);
      const actual=run.trace.binding.parameters;
      if(run.engineId!==plan.engineId||run.trace.binding.engineVersion!==plan.engineVersion||run.trace.seed!==plan.seed||JSON.stringify(run.trace.input)!==JSON.stringify(plan.input)||Object.keys(actual).length!==Object.keys(p).length||Object.keys(p).some(k=>actual[k]!==p[k]))throw Error('The trial returned a different input, seed, parameters or engine version.');
      trial={id:`trial-${index}`,parameters:p,status:run.trace.status,metrics:run.trace.metrics,...(run.result.kind==='matrix'?{converged:run.result.converged}:{})};
    }catch(error){if(options.signal?.aborted)break;trial={id:`trial-${index}`,parameters:p,status:'failed',metrics:[],error:error instanceof Error?error.message:'Trial failed.'};}
    trials.push(trial);options.onTrial?.(trial,index);
  }
  return {plan,trials,cancelled:!!options.signal?.aborted,planned:parameters.length};
}
export const directTrialRunner:TrialRunner=async(plan,parameters,signal)=>runEngine(plan.engineId,plan.input,{seed:plan.seed,parameters,signal});

export function compareTrials(baseline:Trial,branch:Trial) {
  const keys=new Set([...Object.keys(baseline.parameters),...Object.keys(branch.parameters)]);
  return {changed:[...keys].filter(key=>baseline.parameters[key]!==branch.parameters[key]).map(key=>({key,before:baseline.parameters[key],after:branch.parameters[key]})),
    metrics:baseline.metrics.flatMap(a=>{const b=branch.metrics.find(b=>b.id===a.id&&b.unit===a.unit);return b?[{id:a.id,unit:a.unit,baseline:a.value,branch:b.value,delta:b.value-a.value}]:[]}),
    status:`${baseline.status} / ${branch.status}`};
}
export function compareExperiments(baseline:PinnedExperiment,branch:PinnedExperiment) {
  const a=engineRegistry.find(e=>e.id===baseline.plan.engineId&&e.version===baseline.plan.engineVersion),b=engineRegistry.find(e=>e.id===branch.plan.engineId&&e.version===branch.plan.engineVersion);
  if(!a||!b||a.comparisonGroup!==b.comparisonGroup)throw Error('These branches do not declare compatible computation/metric semantics.');
  const result=compareTrials(baseline.trial,branch.trial);
  const changes=Object.entries({input:[baseline.plan.input,branch.plan.input],seed:[baseline.plan.seed,branch.plan.seed],engine:[baseline.plan.engineId,branch.plan.engineId]}).filter(([,v])=>JSON.stringify(v[0])!==JSON.stringify(v[1])).map(([field,v])=>({field,before:JSON.stringify(v[0]),after:JSON.stringify(v[1])}));
  return {...result,changes};
}

/** Source-linked sweep bundles carry settings, never trusted cached metrics or source/PDF bytes. */
export function parseSweepBundle(value:unknown,source:{id:string;sourceVersion:string}) {
  const s=z.strictObject({format:z.literal('paperplay-exploration'),version:z.literal(1),sourceId:z.string(),sourceVersion:z.string(),plan:experimentPlanSchema,pinned:z.array(experimentPlanSchema).max(8)}).parse(value);
  if(s.sourceId!==source.id||s.sourceVersion!==source.sourceVersion)throw Error('This exploration needs the same source version. The existing work was retained.');
  planTrials(s.plan);const group=engineRegistry.find(e=>e.id===s.plan.engineId)!.comparisonGroup;for(const p of s.pinned){planTrials({...p,axes:[]});if(engineRegistry.find(e=>e.id===p.engineId)!.comparisonGroup!==group)throw Error('Pinned branches need compatible engine/metric semantics.');}return s;
}
