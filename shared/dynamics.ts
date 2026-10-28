import { z } from 'zod';
import { unitIdSchema, type UnitId } from './scientific-quantities';
import { convertValue } from '../lib/quantities/convert';
import { name, text } from './widget-primitives';

export const DYNAMICS_SOLVER_VERSION = 'rk4-step-doubling@1.0.0';
export const DYNAMICS_LIMITS = Object.freeze({ maxStates:8,maxAcceptedSteps:4096,maxAttempts:8192,maxRhsEvaluations:100000,maxOutputRows:2048,maxEvents:32,maxEventIterations:32,maxWallMs:30000,maxResultBytes:3*1024*1024 });
const finite=z.number().finite();
const nonnegative=finite.min(0).max(1e12);
export const dynamicsTimeUnitSchema=z.enum(['s','ms','us','min','h']);
export type DynamicsTimeUnit=z.infer<typeof dynamicsTimeUnitSchema>;
export const dynamicsScalarSchema=z.strictObject({value:finite,unit:unitIdSchema});
export type DynamicsScalar=z.infer<typeof dynamicsScalarSchema>;
const amount=z.strictObject({value:nonnegative,unit:z.enum(['1','mol','mmol','umol','mol/L','mmol/L','umol/L'])});
const concentration=z.strictObject({value:nonnegative,unit:z.enum(['mol/L','mmol/L','umol/L'])});
export const dynamicsDecayRateSchema=z.strictObject({value:nonnegative,per:dynamicsTimeUnitSchema,role:z.literal('decay-rate')});
export const dynamicsAngularRateSchema=z.strictObject({value:nonnegative,per:dynamicsTimeUnitSchema,role:z.literal('angular-frequency')});
export const dynamicsModelSchema=z.discriminatedUnion('id',[
  z.strictObject({id:z.literal('decay'),initial:amount,rate:dynamicsDecayRateSchema}),
  z.strictObject({id:z.literal('oscillator'),position:z.strictObject({value:finite.min(-1e12).max(1e12),unit:z.enum(['m','cm','mm','um','nm','km'])}),velocity:z.strictObject({value:finite.min(-1e12).max(1e12),unit:z.literal('m/s')}),damping:dynamicsDecayRateSchema,angularFrequency:dynamicsAngularRateSchema}),
  z.strictObject({id:z.literal('reaction-chain'),initial:z.tuple([concentration,concentration,concentration]),rates:z.tuple([dynamicsDecayRateSchema,dynamicsDecayRateSchema])}),
  z.strictObject({id:z.literal('threshold-decay'),initial:amount,rate:dynamicsDecayRateSchema,event:z.strictObject({threshold:amount,reset:amount,rateAfter:dynamicsDecayRateSchema,direction:z.literal('falling'),terminal:z.boolean()})}),
]);
export type DynamicsModel=z.infer<typeof dynamicsModelSchema>;
export const dynamicsSolverSchema=z.strictObject({method:z.literal('rk4-step-doubling'),rtol:finite.positive().max(.1),atol:z.array(z.strictObject({value:finite.positive(),unit:unitIdSchema})).min(1).max(8),initialStep:finite.positive(),minStep:finite.positive(),maxStep:finite.positive(),maxAcceptedSteps:z.number().int().min(1).max(4096),maxAttempts:z.number().int().min(1).max(8192),maxRhsEvaluations:z.number().int().min(1).max(100000),maxOutputRows:z.number().int().min(2).max(2048),maxEvents:z.number().int().min(0).max(32),maxEventIterations:z.number().int().min(1).max(32),eventTimeTolerance:finite.positive(),maxWallMs:z.number().int().min(1).max(30000)});
export type DynamicsSolver=z.infer<typeof dynamicsSolverSchema>;
export const dynamicsRequestSchema=z.strictObject({format:z.literal('paperplay-dynamics'),schemaVersion:z.literal(1),model:dynamicsModelSchema,interval:z.strictObject({start:finite.min(0),end:finite.positive(),unit:dynamicsTimeUnitSchema}),solver:dynamicsSolverSchema});
export type DynamicsRequest=z.infer<typeof dynamicsRequestSchema>;
export const dynamicsViewSchema=z.strictObject({title:text.max(200),anchorIds:z.array(name).min(1).max(32),request:dynamicsRequestSchema});
export type DynamicsView=z.infer<typeof dynamicsViewSchema>;
export function createDefaultDynamicsSolver(atol:DynamicsScalar[]):DynamicsSolver{return dynamicsSolverSchema.parse({method:'rk4-step-doubling',rtol:1e-6,atol,initialStep:.01,minStep:1e-10,maxStep:.1,maxAcceptedSteps:4096,maxAttempts:8192,maxRhsEvaluations:100000,maxOutputRows:2048,maxEvents:1,maxEventIterations:32,eventTimeTolerance:1e-8,maxWallMs:3000});}
export const dynamicsStatusSchema=z.enum(['completed','terminal-event','cancelled','limit-reached','tolerance-not-met','invalid-domain','nonfinite','unstable']);
export type DynamicsStatus=z.infer<typeof dynamicsStatusSchema>;
export const dynamicsDiagnosticSchema=z.strictObject({code:z.enum(['step-limit','attempt-limit','rhs-limit','output-limit','event-limit','event-iterations','deadline','minimum-step','time-not-advancing','nonfinite','invalid-domain','unstable','cancelled','event-detection-limit']),message:z.string().min(1).max(500)});
export type DynamicsDiagnostic=z.infer<typeof dynamicsDiagnosticSchema>;
export const dynamicsSampleSchema=z.strictObject({time:finite,state:z.array(finite).min(1).max(8),mode:z.union([z.literal(0),z.literal(1)])});
export const dynamicsEventSchema=z.strictObject({id:z.literal('threshold'),time:finite,bracketWidth:finite.nonnegative(),before:z.array(finite).min(1).max(8),after:z.array(finite).min(1).max(8),modeBefore:z.literal(0),modeAfter:z.union([z.literal(0),z.literal(1)]),terminal:z.boolean()});
export const dynamicsResultSchema=z.strictObject({format:z.literal('paperplay-dynamics-result'),schemaVersion:z.literal(1),solverVersion:z.literal(DYNAMICS_SOLVER_VERSION),request:dynamicsRequestSchema,status:dynamicsStatusSchema,stateIds:z.array(name).min(1).max(8),stateLabels:z.array(z.string().min(1).max(100)).min(1).max(8),stateUnits:z.array(unitIdSchema).min(1).max(8),timeUnit:z.literal('s'),samples:z.array(dynamicsSampleSchema).max(2048),events:z.array(dynamicsEventSchema).max(32),stats:z.strictObject({acceptedSteps:z.number().int().min(0).max(4096),rejectedSteps:z.number().int().min(0).max(8192),attempts:z.number().int().min(0).max(8192),rhsEvaluations:z.number().int().min(0).max(100000),eventIterations:z.number().int().min(0).max(1024),largestAcceptedNormalizedError:finite.nonnegative(),finalTime:finite}),diagnostics:z.array(dynamicsDiagnosticSchema).max(32)});
export type DynamicsResult=z.infer<typeof dynamicsResultSchema>;
export type NormalizedDynamicsModel={id:DynamicsModel['id'];initial:number[];stateIds:string[];stateLabels:string[];stateUnits:UnitId[];parameters:number[];event?:{threshold:number;reset:number;rateAfter:number;direction:'falling';terminal:boolean}};
export type NormalizedDynamicsRequest={request:DynamicsRequest;model:NormalizedDynamicsModel;interval:{start:number;end:number;unit:'s'};solver:Omit<DynamicsSolver,'atol'>&{atol:number[]}};
function requireFinite(values:number[]){if(values.some(value=>!Number.isFinite(value)))throw Error('Dynamics unit normalization exceeded finite values.');}
/** Rate roles stay explicit: these values are s^-1 or rad/s, never cyclic Hz. */
export function normalizeDynamicsRequest(input:unknown):NormalizedDynamicsRequest{
  if(new TextEncoder().encode(JSON.stringify(input)).length>64*1024)throw Error('Dynamics input exceeds 64 KiB.');
  const request=dynamicsRequestSchema.parse(input),m=request.model;
  const rate=(value:z.infer<typeof dynamicsDecayRateSchema>|z.infer<typeof dynamicsAngularRateSchema>)=>value.value/convertValue(1,value.per,'s');
  const canonicalAmount=(unit:UnitId):UnitId=>unit==='1'?'1':['mol','mmol','umol'].includes(unit)?'mol':'mol/L';
  let model:NormalizedDynamicsModel;
  if(m.id==='decay'||m.id==='threshold-decay'){
    const unit=canonicalAmount(m.initial.unit);model={id:m.id,initial:[convertValue(m.initial.value,m.initial.unit,unit)],stateIds:['x'],stateLabels:[unit==='1'?'Level':unit==='mol'?'Amount':'Concentration'],stateUnits:[unit],parameters:[rate(m.rate)]};
    if(m.id==='threshold-decay'){
      const threshold=convertValue(m.event.threshold.value,m.event.threshold.unit,unit),reset=convertValue(m.event.reset.value,m.event.reset.unit,unit);
      if(threshold<=0||threshold>model.initial[0])throw Error('The one-shot falling threshold must be positive and no greater than the initial state.');
      model.event={threshold,reset,rateAfter:rate(m.event.rateAfter),direction:'falling',terminal:m.event.terminal};
    }
  }else if(m.id==='oscillator')model={id:m.id,initial:[convertValue(m.position.value,m.position.unit,'m'),convertValue(m.velocity.value,m.velocity.unit,'m/s')],stateIds:['x','v'],stateLabels:['Position','Velocity'],stateUnits:['m','m/s'],parameters:[rate(m.damping),rate(m.angularFrequency)]};
  else model={id:m.id,initial:m.initial.map(value=>convertValue(value.value,value.unit,'mol/L')),stateIds:['A','B','C'],stateLabels:['A','B','C'],stateUnits:['mol/L','mol/L','mol/L'],parameters:m.rates.map(rate)};
  if(request.solver.atol.length!==model.initial.length)throw Error('Absolute tolerances must match every state component and its units.');
  const seconds=(value:number)=>convertValue(value,request.interval.unit,'s');
  const interval={start:seconds(request.interval.start),end:seconds(request.interval.end),unit:'s' as const};
  const solver={...request.solver,atol:request.solver.atol.map((value,index)=>convertValue(value.value,value.unit,model.stateUnits[index])),initialStep:seconds(request.solver.initialStep),minStep:seconds(request.solver.minStep),maxStep:seconds(request.solver.maxStep),eventTimeTolerance:seconds(request.solver.eventTimeTolerance)};
  requireFinite([...model.initial,...model.parameters,...solver.atol,interval.start,interval.end,solver.initialStep,solver.minStep,solver.maxStep,solver.eventTimeTolerance,...(model.event?[model.event.threshold,model.event.reset,model.event.rateAfter]:[])]);
  if(interval.end<=interval.start)throw Error('Dynamics end time must be strictly after start time.');
  if(solver.minStep<=0||solver.minStep>solver.initialStep||solver.initialStep>solver.maxStep||solver.eventTimeTolerance<=0||solver.atol.some(value=>value<=0))throw Error('Dynamics step/tolerance bounds are invalid after unit conversion.');
  return {request,model,interval,solver};
}
export function validateDynamicsRequest(input:unknown):DynamicsRequest{return normalizeDynamicsRequest(input).request;}
/** Validate a bounded trajectory and bind it to the exact declared settings, not a substituted run. */
export function validateDynamicsResult(input:unknown,expectedRequest:DynamicsRequest):DynamicsResult{
  if(new TextEncoder().encode(JSON.stringify(input)).length>DYNAMICS_LIMITS.maxResultBytes)throw Error('Dynamics output exceeds 3 MiB.');
  const normalized=normalizeDynamicsRequest(expectedRequest),result=dynamicsResultSchema.parse(input);
  if(JSON.stringify(result.request)!==JSON.stringify(normalized.request))throw Error('Dynamics result belongs to different model/settings.');
  const {model,solver,interval}=normalized,s=result.stats;
  if(JSON.stringify(result.stateIds)!==JSON.stringify(model.stateIds)||JSON.stringify(result.stateLabels)!==JSON.stringify(model.stateLabels)||JSON.stringify(result.stateUnits)!==JSON.stringify(model.stateUnits))throw Error('Dynamics output state identities or units differ.');
  const interrupted=s.attempts-s.acceptedSteps-s.rejectedSteps;
  if(result.samples.length>solver.maxOutputRows||result.events.length>solver.maxEvents||s.acceptedSteps>solver.maxAcceptedSteps||s.attempts>solver.maxAttempts||s.rhsEvaluations>solver.maxRhsEvaluations||s.eventIterations>solver.maxEventIterations*Math.max(1,result.events.length)||interrupted<0||interrupted>(result.status==='completed'||result.status==='terminal-event'?0:1)||s.largestAcceptedNormalizedError>1)throw Error('Dynamics output exceeds its declared counters, tolerance or output limits.');
  if(s.finalTime<interval.start||s.finalTime>interval.end||result.status==='completed'&&s.finalTime!==interval.end)throw Error('Dynamics completion/final time is inconsistent with its requested interval.');
  const state=(value:number[])=>{if(value.length!==model.initial.length||model.id!=='oscillator'&&value.some(item=>item<0))throw Error('Dynamics state has an invalid dimension or physical domain.');};
  let previousTime=interval.start;
  for(const [index,sample] of result.samples.entries()){state(sample.state);if(sample.time<previousTime||sample.time<interval.start||sample.time>s.finalTime||index>0&&sample.time===previousTime&&!result.events.some(event=>event.time===sample.time))throw Error('Dynamics trajectory time order is invalid.');previousTime=sample.time;}
  if(result.samples.length){const first=result.samples[0],last=result.samples[result.samples.length-1];if(first.time!==interval.start||first.mode!==0||JSON.stringify(first.state)!==JSON.stringify(model.initial)||last.time!==s.finalTime)throw Error('Dynamics trajectory does not retain its exact initial/final state times.');}
  else if(s.finalTime!==interval.start||result.status==='completed'||result.status==='terminal-event')throw Error('An empty dynamics prefix cannot claim completed integration.');
  if(result.events.length>1||!model.event&&result.events.length)throw Error('This registered model supports at most one declared threshold event.');
  for(const event of result.events){
    state(event.before);state(event.after);
    if(!model.event||event.time<interval.start||event.time>s.finalTime||event.bracketWidth>solver.eventTimeTolerance||event.before[0]!==model.event.threshold||event.terminal!==model.event.terminal||event.modeAfter!==(event.terminal?0:1)||event.terminal&&JSON.stringify(event.after)!==JSON.stringify(event.before)||!event.terminal&&event.after[0]!==model.event.reset)throw Error('Dynamics event/reset metadata is inconsistent with its declared one-shot transition.');
    const same=(left:number[],right:number[])=>JSON.stringify(left)===JSON.stringify(right);
    if(!result.samples.some(sample=>sample.time===event.time&&sample.mode===0&&same(sample.state,event.before))||!event.terminal&&!result.samples.some(sample=>sample.time===event.time&&sample.mode===1&&same(sample.state,event.after)))throw Error('The event must preserve its pre/post state samples at the transition time.');
    if(result.samples.some(sample=>sample.time<event.time&&sample.mode!==0||sample.time>event.time&&sample.mode!==(event.terminal?0:1)))throw Error('Dynamics sample modes do not follow the declared transition.');
    const atEvent=result.samples.filter(sample=>sample.time===event.time);let switched=false;
    for(const sample of atEvent){if(sample.mode===1)switched=true;else if(switched)throw Error('Dynamics trajectory cannot switch back to the previous mode.');if(!same(sample.state,sample.mode===0?event.before:event.after))throw Error('Dynamics event sample differs from its pre/post state.');}
    if(event.terminal&&result.status!=='terminal-event')throw Error('A terminal event must retain its terminal completion status.');
  }
  if(result.status==='terminal-event'&&(!result.events.length||!result.events[0].terminal||result.events[0].time!==s.finalTime))throw Error('Terminal status requires the declared terminal event at final time.');
  if(!result.events.some(event=>!event.terminal)&&result.samples.some(sample=>sample.mode===1))throw Error('A dynamics mode switch requires its event record.');
  return result;
}
