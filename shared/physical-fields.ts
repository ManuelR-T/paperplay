import { z } from 'zod';
import { convertValue } from '../lib/quantities/convert';
import { name,text } from './widget-primitives';

export const FIELD_SOLVER_VERSION='temperature-fv-euler@1.0.0';
export const FIELD_LIMITS=Object.freeze({maxInputBytes:256*1024,maxResultBytes:3*1024*1024,maxCells:4096,maxSnapshots:64,maxRetainedScalars:32768,maxSteps:20000,maxCellUpdates:10000000,maxWallMs:30000});
const finite=z.number().finite(),lengthUnit=z.enum(['m','cm','mm','um','nm','km']),timeUnit=z.enum(['s','ms','us','min','h']);
const length=z.strictObject({value:finite,unit:lengthUnit}),extent=z.strictObject({value:finite.positive(),unit:lengthUnit});
export const fieldGridSchema=z.discriminatedUnion('dimension',[
 z.strictObject({dimension:z.literal(1),nx:z.number().int().min(4).max(128),ny:z.literal(1),origin:z.tuple([length]),extent:z.tuple([extent]),boundary:z.enum(['periodic','no-flux'])}),
 z.strictObject({dimension:z.literal(2),nx:z.number().int().min(4).max(64),ny:z.number().int().min(4).max(64),origin:z.tuple([length,length]),extent:z.tuple([extent,extent]),boundary:z.literal('periodic')}),
]);
const absoluteTemperature=z.strictObject({value:finite,unit:z.enum(['K','degC']),temperatureMode:z.literal('absolute')});
const temperatureDifference=z.strictObject({value:finite,unit:z.enum(['K','degC']),temperatureMode:z.literal('difference')});
export const fieldInitialSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('constant'),temperature:absoluteTemperature}),
 z.strictObject({kind:z.literal('cosine'),mean:absoluteTemperature,amplitude:temperatureDifference}),
 z.strictObject({kind:z.literal('cell-averages'),values:z.array(finite).min(4).max(4096),unit:z.enum(['K','degC']),temperatureMode:z.literal('absolute')}),
]);
export const fieldSolverSchema=z.strictObject({scheme:z.literal('fv-euler-centered'),dt:finite.positive(),snapshotSteps:z.array(z.number().int().min(0).max(1000000000)).min(2).max(64),maxSteps:z.number().int().min(1).max(20000),maxCellUpdates:z.number().int().min(1).max(10000000),maxWallMs:z.number().int().min(1).max(30000)});
export const fieldRequestSchema=z.strictObject({format:z.literal('paperplay-physical-field'),schemaVersion:z.literal(1),model:z.literal('temperature-diffusion'),grid:fieldGridSchema,coefficient:z.strictObject({value:finite.nonnegative(),lengthUnit,timeUnit,role:z.literal('thermal-diffusivity')}),initial:fieldInitialSchema,interval:z.strictObject({start:finite.min(0),end:finite.positive(),unit:timeUnit}),solver:fieldSolverSchema});
export type FieldRequest=z.infer<typeof fieldRequestSchema>;
export type FieldSolver=z.infer<typeof fieldSolverSchema>;
export const physicalFieldViewSchema=z.strictObject({title:text.max(200),anchorIds:z.array(name).min(1).max(32),request:fieldRequestSchema});
export const fieldViewSchema=physicalFieldViewSchema;
export type PhysicalFieldView=z.infer<typeof physicalFieldViewSchema>;
export function createDefaultFieldSolver(dt:number,snapshotSteps:number[]):FieldSolver{return fieldSolverSchema.parse({scheme:'fv-euler-centered',dt,snapshotSteps,maxSteps:20000,maxCellUpdates:10000000,maxWallMs:3000});}
export const normalizedFieldGridSchema=z.strictObject({dimension:z.union([z.literal(1),z.literal(2)]),nx:z.number().int().min(4).max(128),ny:z.number().int().min(1).max(64),shape:z.array(z.number().int().positive()).min(1).max(2),origin:z.array(finite).min(1).max(2),extent:z.array(finite.positive()).min(1).max(2),dx:finite.positive(),dy:finite.positive(),boundary:z.enum(['periodic','no-flux'])});
export type NormalizedFieldGrid=z.infer<typeof normalizedFieldGridSchema>;
export type NormalizedFieldRequest={request:FieldRequest;grid:NormalizedFieldGrid;initial:number[];coefficient:number;interval:{start:number;end:number;unit:'s'};solver:FieldSolver;targetSteps:number;snapshotTimes:number[]};
export const fieldStatusSchema=z.enum(['completed','cancelled','limit-reached','unstable','nonfinite','invalid-domain','time-not-advancing']);
export type FieldStatus=z.infer<typeof fieldStatusSchema>;
export const fieldDiagnosticSchema=z.strictObject({code:z.enum(['unstable','step-limit','work-limit','deadline','nonfinite','invalid-domain','time-not-advancing','cancelled','conservation','maximum-principle']),message:z.string().min(1).max(500)});
export type FieldDiagnostic=z.infer<typeof fieldDiagnosticSchema>;
export const fieldSnapshotSchema=z.strictObject({step:z.number().int().min(0).max(20000),time:finite,values:z.array(finite.nonnegative()).min(4).max(4096),mean:finite.nonnegative(),minimum:finite.nonnegative(),maximum:finite.nonnegative(),meanDrift:finite});
export const fieldResultSchema=z.strictObject({format:z.literal('paperplay-field-result'),schemaVersion:z.literal(1),solverVersion:z.literal(FIELD_SOLVER_VERSION),request:fieldRequestSchema,status:fieldStatusSchema,grid:normalizedFieldGridSchema,timeUnit:z.literal('s'),valueUnit:z.literal('K'),valueMeaning:z.literal('cell-averages'),snapshots:z.array(fieldSnapshotSchema).min(1).max(64),stats:z.strictObject({steps:z.number().int().min(0).max(20000),cellUpdates:z.number().int().min(0).max(10000000),finalTime:finite,stabilityNumber:finite.nonnegative(),stabilityLimit:finite.positive().nullable(),initialMean:finite.nonnegative(),maxMeanDrift:finite.nonnegative(),maxPrincipleViolation:finite.nonnegative()}),diagnostics:z.array(fieldDiagnosticSchema).max(32)});
export type FieldResult=z.infer<typeof fieldResultSchema>;
function finiteValues(values:number[],label:string){if(values.some(value=>!Number.isFinite(value)))throw Error(`Field ${label} exceeds finite representable values.`);}
export function fieldValueStatistics(values:readonly number[]){let mean=0,minimum=Infinity,maximum=-Infinity;values.forEach((value,index)=>{mean+=(value-mean)/(index+1);minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);});return {mean,minimum,maximum};}
export function fieldTimeAtStep(normalized:NormalizedFieldRequest,step:number){return step===normalized.targetSteps?normalized.interval.end:Math.min(normalized.interval.end,normalized.interval.start+normalized.solver.dt*step);}
export function fieldStepCount(duration:number,dt:number){if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(dt)||dt<=0)throw Error('Field duration/step must be finite and positive.');const ratio=duration/dt,nearest=Math.round(ratio);const roundedRatio=Math.abs(ratio-nearest)<=32*Number.EPSILON*Math.max(1,Math.abs(ratio))?nearest:ratio;const steps=Math.max(1,Math.ceil(roundedRatio));if(!Number.isSafeInteger(steps)||steps<1||steps>1e9)throw Error('The requested field integration has an unrepresentable or excessive step schedule.');return steps;}
/** Explicit presentation schedule; does not change the Euler trajectory or its chosen full dt. */
export function fieldSnapshotSchedule(interval:FieldRequest['interval'],dt:number,count:number):number[]{
 fieldRequestSchema.shape.interval.parse(interval);if(!Number.isFinite(dt)||dt<=0||!Number.isInteger(count)||count<2||count>64)throw Error('Invalid field snapshot schedule parameters.');
 const start=convertValue(interval.start,interval.unit,'s'),end=convertValue(interval.end,interval.unit,'s'),step=convertValue(dt,interval.unit,'s');if(end<=start||step<=0)throw Error('Field snapshot interval/step is not ordered.');
 const steps=fieldStepCount(end-start,step),retained=Math.min(count,steps+1);return Array.from({length:retained},(_,index)=>index===retained-1?steps:Math.round(steps*(index/(retained-1))));
}
export function normalizeFieldRequest(input:unknown):NormalizedFieldRequest{
 if(new TextEncoder().encode(JSON.stringify(input)).length>FIELD_LIMITS.maxInputBytes)throw Error('Field input exceeds 256 KiB.');
 const request=fieldRequestSchema.parse(input),g=request.grid;
 const origin=g.origin.map(value=>convertValue(value.value,value.unit,'m')),extent=g.extent.map(value=>convertValue(value.value,value.unit,'m')),dx=extent[0]/g.nx,dy=g.dimension===2?extent[1]/g.ny:1;
 const grid:NormalizedFieldGrid={dimension:g.dimension,nx:g.nx,ny:g.ny,shape:g.dimension===1?[g.nx]:[g.ny,g.nx],origin,extent,dx,dy,boundary:g.boundary};
 finiteValues([...origin,...extent,dx,dy],'grid');if(dx<=0||dy<=0)throw Error('Field spacing is not positive after conversion.');
 for(let axis=0;axis<g.dimension;axis++){const n=axis===0?g.nx:g.ny,spacing=axis===0?dx:dy;let previous=origin[axis];if(!Number.isFinite(origin[axis]+extent[axis])||origin[axis]+extent[axis]<=origin[axis])throw Error('The physical grid extent does not advance.');for(let index=0;index<n;index++){const center=origin[axis]+(index+.5)*spacing;if(!Number.isFinite(center)||center<=previous)throw Error('The physical cell centers lose coordinate precision.');previous=center;}}
 const lengthScale=convertValue(1,request.coefficient.lengthUnit,'m'),timeScale=convertValue(1,request.coefficient.timeUnit,'s'),coefficient=request.coefficient.value*lengthScale*lengthScale/timeScale;
 const interval={start:convertValue(request.interval.start,request.interval.unit,'s'),end:convertValue(request.interval.end,request.interval.unit,'s'),unit:'s' as const},solver={...request.solver,dt:convertValue(request.solver.dt,request.interval.unit,'s')};
 finiteValues([coefficient,interval.start,interval.end,solver.dt],'time/coefficient');if(coefficient<0||solver.dt<=0||interval.end<=interval.start)throw Error('Field interval/step/coefficient is invalid.');
 // Decimal inputs can produce a ratio a few ulps above an intended integer.
 // Treat <=32eps*max(1,ratio) as that integer; the final target is exact end.
 const targetSteps=fieldStepCount(interval.end-interval.start,solver.dt);
 const schedule=solver.snapshotSteps;if(schedule[0]!==0||schedule[schedule.length-1]!==targetSteps||schedule.some((step,index)=>step>targetSteps||index>0&&step<=schedule[index-1]))throw Error('Field snapshot steps must be strictly ordered and include initial and requested final step.');
 const cells=g.nx*g.ny;if(cells>FIELD_LIMITS.maxCells||cells*schedule.length>FIELD_LIMITS.maxRetainedScalars)throw Error('Field grid/snapshot scalar budget exceeds its limit.');
 const initialProfile=request.initial;let initial:number[];
 if(initialProfile.kind==='constant'){const value=convertValue(initialProfile.temperature.value,initialProfile.temperature.unit,'K','absolute');initial=Array(cells).fill(value);}
 else if(initialProfile.kind==='cell-averages'){if(initialProfile.values.length!==cells)throw Error('Initial cell averages do not match the exact grid shape.');initial=initialProfile.values.map(value=>convertValue(value,initialProfile.unit,'K','absolute'));}
 else{
  const mean=convertValue(initialProfile.mean.value,initialProfile.mean.unit,'K','absolute'),amplitude=convertValue(initialProfile.amplitude.value,initialProfile.amplitude.unit,'K','difference');
  if(mean<Math.abs(amplitude))throw Error('The initial temperature cosine becomes negative in absolute Kelvin.');
  const angleX=g.boundary==='no-flux'?Math.PI:2*Math.PI,sinc=(angle:number)=>Math.sin(angle)/angle,factorX=sinc(angleX/(2*g.nx)),factorY=g.dimension===2?sinc(Math.PI/g.ny):1;
  initial=Array.from({length:cells},(_,index)=>{const i=index%g.nx,j=Math.floor(index/g.nx);return mean+amplitude*factorX*factorY*Math.cos(angleX*(i+.5)/g.nx)*(g.dimension===2?Math.cos(2*Math.PI*(j+.5)/g.ny):1);});
 }
 finiteValues(initial,'initial temperature');if(initial.some(value=>value<0))throw Error('Initial absolute temperatures must be nonnegative Kelvin.');
 const normalized:NormalizedFieldRequest={request,grid,initial,coefficient,interval,solver,targetSteps,snapshotTimes:[]};normalized.snapshotTimes=schedule.map(step=>fieldTimeAtStep(normalized,step));
 fieldStability(normalized);return normalized;
}
export function validateFieldRequest(input:unknown):FieldRequest{return normalizeFieldRequest(input).request;}
/** Presentation identity only; full exact request/version binding remains mandatory for cached computation. */
export function fieldGridIdentity(input:FieldRequest|NormalizedFieldRequest){const grid='request' in input?input.grid:normalizeFieldRequest(input).grid;let hash=0xcbf29ce484222325n;for(const byte of new TextEncoder().encode(JSON.stringify(grid)))hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);return `field-${hash.toString(16).padStart(16,'0')}`;}
export function fieldGridGeometry(input:FieldRequest|NormalizedFieldRequest){const normalized='request' in input?input:normalizeFieldRequest(input),g=normalized.grid;return {frame:fieldGridIdentity(normalized),dimension:g.dimension,nx:g.nx,ny:g.ny,origin:[g.origin[0]+g.dx/2,g.dimension===2?g.origin[1]+g.dy/2:0] as [number,number],spacing:[g.dx,g.dy] as [number,number],extent:[g.extent[0],g.dimension===2?g.extent[1]:0] as [number,number],syntheticRow:g.dimension===1};}
/** Actual diffusion Fourier number, plus the maximum stable full time step. */
export function fieldStability(normalized:NormalizedFieldRequest,dt=normalized.solver.dt){const {grid:g,coefficient:alpha}=normalized;if(alpha===0)return {number:0,limit:null};const inverseRate=alpha/g.dx/g.dx+(g.dimension===2?alpha/g.dy/g.dy:0),number=inverseRate*dt,limit=.5/inverseRate;finiteValues([number,limit],'stability metadata');if(limit<=0)throw Error('Field stability limit cannot be represented.');return {number,limit};}
/** Structural/numerical metadata checks, not a receipt of scientific reproduction. */
export function validateFieldResult(input:unknown,expectedRequest:FieldRequest):FieldResult{
 if(new TextEncoder().encode(JSON.stringify(input)).length>FIELD_LIMITS.maxResultBytes)throw Error('Field output exceeds 3 MiB.');
 const n=normalizeFieldRequest(expectedRequest),out=fieldResultSchema.parse(input),{grid:g,solver,interval}=n,stats=out.stats,cells=g.nx*g.ny,stability=fieldStability(n),initialStats=fieldValueStatistics(n.initial);
 const near=(a:number,b:number)=>Math.abs(a-b)<=128*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
 if(JSON.stringify(out.request)!==JSON.stringify(n.request)||JSON.stringify(out.grid)!==JSON.stringify(g))throw Error('Field output belongs to different exact request or normalized grid.');
 if(stats.steps>solver.maxSteps||stats.steps>n.targetSteps||stats.cellUpdates>solver.maxCellUpdates||stats.cellUpdates<stats.steps*cells||stats.cellUpdates>stats.steps*cells+(out.status==='completed'?0:cells)||stats.finalTime!==fieldTimeAtStep(n,stats.steps)||!near(stats.stabilityNumber,stability.number)||stats.stabilityLimit!==stability.limit||!near(stats.initialMean,initialStats.mean))throw Error('Field output time/work/stability metadata is inconsistent with its request.');
 if(out.status==='completed'&&(stats.steps!==n.targetSteps||stats.finalTime!==interval.end||out.snapshots.length!==solver.snapshotSteps.length))throw Error('A completed field result must reach the requested final step/time and retain its full snapshot schedule.');
 if(stability.number>.5&&(stats.steps!==0||stats.cellUpdates!==0||out.status==='completed'))throw Error('An unstable declared time step cannot perform or claim completed cell updates.');
 if(out.status==='unstable'){
  if(!out.diagnostics.some(item=>item.code==='unstable'))throw Error('An unstable result must retain its visible diagnostic.');
  if(stability.number<=.5){const h=fieldTimeAtStep(n,stats.steps+1)-stats.finalTime,actual=h>0?fieldStability(n,h).number:0;if(stats.steps>=n.targetSteps||actual<=.5+32*Number.EPSILON*Math.max(1,actual))throw Error('The next actual rounded step does not justify an unstable prefix outcome.');}
 }
 const expectedSteps=solver.snapshotSteps.filter(step=>step<=stats.steps);
 if(out.snapshots.length!==expectedSteps.length||out.snapshots.length*cells>FIELD_LIMITS.maxRetainedScalars)throw Error('Field snapshot coverage exceeds or differs from the retained schedule/scalar budget.');
 let observedMeanDrift=0,observedViolation=0;
 for(const [index,snapshot] of out.snapshots.entries()){
  const step=expectedSteps[index];if(snapshot.step!==step||snapshot.time!==fieldTimeAtStep(n,step)||snapshot.values.length!==cells)throw Error('Field snapshot time/shape/order differs from its exact cell-average schedule.');
  if(index===0&&JSON.stringify(snapshot.values)!==JSON.stringify(n.initial))throw Error('The field initial snapshot differs from its declared temperature profile.');
  const actual=fieldValueStatistics(snapshot.values),drift=actual.mean-initialStats.mean;
  if(!near(snapshot.mean,actual.mean)||snapshot.minimum!==actual.minimum||snapshot.maximum!==actual.maximum||!near(snapshot.meanDrift,drift))throw Error('Field snapshot extrema/mean/conservation diagnostic differs from its retained values.');
  observedMeanDrift=Math.max(observedMeanDrift,Math.abs(drift));observedViolation=Math.max(observedViolation,initialStats.minimum-actual.minimum,actual.maximum-initialStats.maximum);
 }
 if(stats.maxMeanDrift+128*Number.EPSILON*Math.max(1,initialStats.maximum)<observedMeanDrift||stats.maxPrincipleViolation+128*Number.EPSILON*Math.max(1,initialStats.maximum)<observedViolation)throw Error('Field aggregate diagnostics under-report retained conservation/extrema differences.');
 const allowance=128*Number.EPSILON*Math.max(1,initialStats.maximum)*Math.max(1,stats.steps)*cells;
 if(stats.maxMeanDrift>allowance&&!out.diagnostics.some(item=>item.code==='conservation')||stats.maxPrincipleViolation>allowance&&!out.diagnostics.some(item=>item.code==='maximum-principle'))throw Error('Field numerical invariant deviations require explicit visible diagnostics.');
 return out;
}
