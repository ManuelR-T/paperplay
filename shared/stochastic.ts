import { z } from 'zod';
import { convertValue } from '../lib/quantities/convert';
import { name,text } from './widget-primitives';

export const STOCHASTIC_SOLVER_VERSION='ssa-direct@1.0.0';
export const STOCHASTIC_PRNG_VERSION='pcg32-xsh-rr-64-32@1.0.0';
export const STOCHASTIC_UNIFORM_VERSION='pcg32-u53-open-both@1.0.0';
/** Scalar budget counts sample counts + five summary vectors + two analytic-moment vectors; timestamps and diagnostic counters have their own array/byte bounds. */
export const STOCHASTIC_LIMITS=Object.freeze({maxPopulation:4096,maxReplicates:32,maxObservationCount:256,maxEventsPerReplicate:10000,maxEvents:200000,maxDrawWords:1000000,maxScalarValues:32768,maxWallMs:30000,maxResultBytes:3*1024*1024});
const finite=z.number().finite(),count=z.number().int().min(0).max(4096),timeUnit=z.enum(['s','ms','us','min','h']);
const canonicalInteger=(max:bigint)=>z.string().min(1).max(20).regex(/^(0|[1-9][0-9]*)$/).refine(value=>value.length<=20&&/^(0|[1-9][0-9]*)$/.test(value)&&BigInt(value)<=max,'Canonical unsigned integer string exceeds its range.');
export const stochasticSeedSchema=canonicalInteger((1n<<64n)-1n);
export const stochasticSequenceSchema=canonicalInteger((1n<<63n)-1n);
export const stochasticRateSchema=z.strictObject({value:finite.min(0).max(1e12),per:timeUnit,role:z.literal('per-item-hazard')});
export const stochasticModelSchema=z.discriminatedUnion('id',[
 z.strictObject({id:z.literal('pure-death'),initial:count,countUnit:z.literal('count'),rate:stochasticRateSchema}),
 z.strictObject({id:z.literal('two-state-pool'),total:count,initialActive:count,countUnit:z.literal('count'),opening:stochasticRateSchema,closing:stochasticRateSchema}),
]);
export const stochasticSolverSchema=z.strictObject({method:z.literal('ssa-direct'),maxEventsPerReplicate:z.number().int().min(0).max(10000),maxEvents:z.number().int().min(0).max(200000),maxDrawWords:z.number().int().min(0).max(1000000),maxWallMs:z.number().int().min(1).max(30000)});
export const stochasticRequestSchema=z.strictObject({format:z.literal('paperplay-stochastic'),schemaVersion:z.literal(1),model:stochasticModelSchema,assumptions:z.strictObject({wellMixed:z.literal(true),independentEntities:z.literal(true),constantRates:z.literal(true),description:z.string().trim().min(16).max(1000)}),interval:z.strictObject({start:finite.min(0),end:finite.positive(),unit:timeUnit}),replicates:z.number().int().min(1).max(32),observationCount:z.number().int().min(2).max(256),random:z.strictObject({seed:stochasticSeedSchema,sequence:stochasticSequenceSchema}),solver:stochasticSolverSchema});
export type StochasticRequest=z.infer<typeof stochasticRequestSchema>;
export type StochasticModel=z.infer<typeof stochasticModelSchema>;
export type StochasticSolver=z.infer<typeof stochasticSolverSchema>;
export const stochasticViewSchema=z.strictObject({title:text.max(200),anchorIds:z.array(name).min(1).max(32),request:stochasticRequestSchema});
export type StochasticView=z.infer<typeof stochasticViewSchema>;
export function createDefaultStochasticSolver():StochasticSolver{return {method:'ssa-direct',maxEventsPerReplicate:10000,maxEvents:200000,maxDrawWords:1000000,maxWallMs:3000};}
export const stochasticStatusSchema=z.enum(['completed','cancelled','limit-reached','nonfinite','time-not-advancing','invalid-domain']);
export const stochasticReplicateStatusSchema=z.enum(['completed','absorbed','cancelled','limit-reached','nonfinite','time-not-advancing','invalid-domain','not-started']);
export type StochasticStatus=z.infer<typeof stochasticStatusSchema>;
export type StochasticReplicateStatus=z.infer<typeof stochasticReplicateStatusSchema>;
export const stochasticDiagnosticSchema=z.strictObject({code:z.enum(['event-limit','draw-limit','deadline','population-limit','nonfinite','time-not-advancing','invalid-domain','cancelled','incomplete-ensemble']),message:z.string().min(1).max(500),replicate:z.number().int().min(0).max(31).optional()});
export type StochasticDiagnostic=z.infer<typeof stochasticDiagnosticSchema>;
const countVector=z.array(count).min(1).max(2),vector=z.array(finite).min(1).max(2);
export const stochasticSampleSchema=z.strictObject({time:finite,counts:countVector});
export const stochasticReplicateSchema=z.strictObject({id:z.number().int().min(0).max(31),sequence:stochasticSequenceSchema,status:stochasticReplicateStatusSchema,finalTime:finite,samples:z.array(stochasticSampleSchema).max(256),stats:z.strictObject({events:z.number().int().min(0).max(10000),proposals:z.number().int().min(0).max(10001),drawWords:z.number().int().min(0).max(1000000)})});
export const stochasticSummarySchema=z.strictObject({time:finite,n:z.number().int().min(1).max(32),mean:vector,sd:z.array(finite.nonnegative().nullable()).min(1).max(2),mcse:z.array(finite.nonnegative().nullable()).min(1).max(2),min:countVector,max:countVector});
export const stochasticExpectationSchema=z.strictObject({time:finite,mean:vector,variance:z.array(finite.nonnegative()).min(1).max(2)});
export const stochasticResultSchema=z.strictObject({format:z.literal('paperplay-stochastic-result'),schemaVersion:z.literal(1),solverVersion:z.literal(STOCHASTIC_SOLVER_VERSION),prngVersion:z.literal(STOCHASTIC_PRNG_VERSION),uniformVersion:z.literal(STOCHASTIC_UNIFORM_VERSION),request:stochasticRequestSchema,status:stochasticStatusSchema,stateIds:z.array(name).min(1).max(2),stateLabels:z.array(z.string().min(1).max(100)).min(1).max(2),stateUnits:z.array(z.literal('count')).min(1).max(2),timeUnit:z.literal('s'),replicates:z.array(stochasticReplicateSchema).min(1).max(32),summary:z.array(stochasticSummarySchema).max(256),expectation:z.array(stochasticExpectationSchema).min(2).max(256),stats:z.strictObject({events:z.number().int().min(0).max(200000),proposals:z.number().int().min(0).max(200032),drawWords:z.number().int().min(0).max(1000000),completedReplicates:z.number().int().min(0).max(32),commonFinalTime:finite}),diagnostics:z.array(stochasticDiagnosticSchema).max(64)});
export type StochasticResult=z.infer<typeof stochasticResultSchema>;
export type StochasticReplicate=z.infer<typeof stochasticReplicateSchema>;
export type StochasticSummary=z.infer<typeof stochasticSummarySchema>;
export type NormalizedStochasticModel={id:StochasticModel['id'];initial:number[];stateIds:string[];stateLabels:string[];stateUnits:Array<'count'>;parameters:number[];total:number};
export type NormalizedStochasticRequest={request:StochasticRequest;model:NormalizedStochasticModel;interval:{start:number;end:number;unit:'s'};grid:number[];sequences:string[];solver:StochasticSolver};
export function normalizeStochasticRequest(input:unknown):NormalizedStochasticRequest{
 if(new TextEncoder().encode(JSON.stringify(input)).length>64*1024)throw Error('Stochastic request exceeds 64 KiB.');
 const request=stochasticRequestSchema.parse(input),m=request.model;
 const rate=(value:z.infer<typeof stochasticRateSchema>)=>value.value/convertValue(1,value.per,'s');
 if(m.id==='two-state-pool'&&m.initialActive>m.total)throw Error('Initial active count exceeds the fixed population.');
 const model:NormalizedStochasticModel=m.id==='pure-death'?{id:m.id,initial:[m.initial],stateIds:['X'],stateLabels:['Remaining'],stateUnits:['count'],parameters:[rate(m.rate)],total:m.initial}:{id:m.id,initial:[m.total-m.initialActive,m.initialActive],stateIds:['inactive','active'],stateLabels:['Inactive','Active'],stateUnits:['count','count'],parameters:[rate(m.opening),rate(m.closing)],total:m.total};
 const interval={start:convertValue(request.interval.start,request.interval.unit,'s'),end:convertValue(request.interval.end,request.interval.unit,'s'),unit:'s' as const};
 if(!Number.isFinite(interval.start)||!Number.isFinite(interval.end)||interval.end<=interval.start||model.parameters.some(value=>!Number.isFinite(value)))throw Error('Stochastic time/rate normalization is not finite or ordered.');
 if(BigInt(request.random.sequence)+BigInt(request.replicates-1)>(1n<<63n)-1n)throw Error('Replicate sequence selectors exceed their uint63 range.');
 const grid=Array.from({length:request.observationCount},(_,index)=>index===0?interval.start:index===request.observationCount-1?interval.end:interval.start+(interval.end-interval.start)*(index/(request.observationCount-1)));
 if(grid.some((value,index)=>!Number.isFinite(value)||index>0&&value<=grid[index-1]))throw Error('The observation grid does not advance at floating-point resolution.');
 if(request.replicates*grid.length*model.initial.length+grid.length*model.initial.length*7>STOCHASTIC_LIMITS.maxScalarValues)throw Error('Stochastic retained scalar limit exceeded.');
 return {request,model,interval,grid,sequences:Array.from({length:request.replicates},(_,index)=>(BigInt(request.random.sequence)+BigInt(index)).toString()),solver:request.solver};
}
export function validateStochasticRequest(input:unknown):StochasticRequest{return normalizeStochasticRequest(input).request;}
/** Closed-form moments of the two registered independent-entity models, not measurement uncertainty. */
export function stochasticExpectation(normalized:NormalizedStochasticRequest):StochasticResult['expectation']{
 const {model,interval,grid}=normalized;
 return grid.map(time=>{const elapsed=time-interval.start;
  if(model.id==='pure-death'){const p=Math.exp(-model.parameters[0]*elapsed);return {time,mean:[model.initial[0]*p],variance:[model.initial[0]*p*(1-p)]};}
  const [alpha,beta]=model.parameters,c=alpha+beta,initialActive=model.initial[1];
  if(c===0)return {time,mean:[...model.initial],variance:[0,0]};
  const equilibrium=alpha/c,survival=Math.exp(-c*elapsed),q11=equilibrium+(1-equilibrium)*survival,q01=equilibrium*(1-survival);
  const active=initialActive*q11+(model.total-initialActive)*q01,variance=initialActive*q11*(1-q11)+(model.total-initialActive)*q01*(1-q01);
  return {time,mean:[model.total-active,active],variance:[variance,variance]};
 });
}
/** Summary uses every requested replicate on their common available grid prefix. */
export function summarizeStochasticReplicates(replicates:StochasticReplicate[]):StochasticSummary[]{
 if(!replicates.length)return [];const length=Math.min(...replicates.map(run=>run.samples.length));
 return Array.from({length},(_,index)=>{const n=replicates.length,time=replicates[0].samples[index].time,width=replicates[0].samples[index].counts.length;
  const means:number[]=[],sd:Array<number|null>=[],mcse:Array<number|null>=[],min:number[]=[],max:number[]=[];
  for(let column=0;column<width;column++){const values=replicates.map(run=>run.samples[index].counts[column]),mean=values.reduce((sum,value)=>sum+value,0)/n;means.push(mean);min.push(Math.min(...values));max.push(Math.max(...values));const deviation=n===1?null:Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/(n-1));sd.push(deviation);mcse.push(deviation===null?null:deviation/Math.sqrt(n));}
  return {time,n,mean:means,sd,mcse,min,max};
 });
}
export function validateStochasticResult(input:unknown,expectedRequest:StochasticRequest):StochasticResult{
 if(new TextEncoder().encode(JSON.stringify(input)).length>STOCHASTIC_LIMITS.maxResultBytes)throw Error('Stochastic output exceeds 3 MiB.');
 const normalized=normalizeStochasticRequest(expectedRequest),out=stochasticResultSchema.parse(input),{model,request,interval,grid,solver}=normalized;
 if(JSON.stringify(out.request)!==JSON.stringify(request))throw Error('Stochastic result belongs to different exact request/settings.');
 if(JSON.stringify(out.stateIds)!==JSON.stringify(model.stateIds)||JSON.stringify(out.stateLabels)!==JSON.stringify(model.stateLabels)||JSON.stringify(out.stateUnits)!==JSON.stringify(model.stateUnits))throw Error('Stochastic state identities or count units differ.');
 if(out.replicates.length!==request.replicates)throw Error('A stochastic result must retain every requested replicate, including interrupted/not-started runs.');
 let events=0,proposals=0,drawWords=0,completed=0,scalarValues=0;
 for(const [index,run] of out.replicates.entries()){
  if(run.id!==index||run.sequence!==normalized.sequences[index])throw Error('Stochastic replicate identities/sequence selectors differ.');
  if(run.finalTime<interval.start||run.finalTime>interval.end||run.samples.length>grid.length||run.stats.events>solver.maxEventsPerReplicate||run.stats.proposals<run.stats.events||run.stats.proposals>run.stats.events+1||run.stats.drawWords<(run.stats.events?4*run.stats.events+2:0))throw Error('Stochastic run time, counter or event limits differ.');
  if(run.status==='completed'||run.status==='absorbed'){
   completed++;if(run.finalTime!==interval.end||run.samples.length!==grid.length)throw Error('A completed/absorbed replicate must cover the whole requested observation grid.');
   const initialPropensity=model.id==='pure-death'?model.parameters[0]*model.initial[0]:model.parameters[0]*model.initial[0]+model.parameters[1]*model.initial[1];
   if(initialPropensity>0&&!run.stats.proposals||run.stats.proposals>0&&run.stats.drawWords<4*run.stats.proposals+2)throw Error('A completed active replicate must account for initialization and both uniforms for every proposal.');
  }
  if(run.status==='not-started'&&(run.finalTime!==interval.start||run.stats.events||run.stats.proposals||run.stats.drawWords||run.samples.length>1))throw Error('A not-started replicate cannot claim simulation work or future observations.');
  let previous=model.initial,minimumEvents=0;
  for(const [rowIndex,sample] of run.samples.entries()){
   scalarValues+=sample.counts.length;
   if(sample.time!==grid[rowIndex]||sample.time>run.finalTime||sample.counts.length!==model.initial.length||rowIndex===0&&JSON.stringify(sample.counts)!==JSON.stringify(model.initial))throw Error('Stochastic samples must retain the exact initial state and a valid fixed-grid prefix.');
   if(sample.counts.some(value=>value>model.total)||model.id==='two-state-pool'&&sample.counts[0]+sample.counts[1]!==model.total)throw Error('Stochastic counts exceed the declared population or violate conservation.');
   if(model.id==='pure-death'&&sample.counts[0]>previous[0]||model.id==='two-state-pool'&&(model.parameters[0]===0&&sample.counts[1]>previous[1]||model.parameters[1]===0&&sample.counts[1]<previous[1]))throw Error('Stochastic boundary/zero-rate transitions violate the registered model.');
   minimumEvents+=Math.abs(sample.counts[model.id==='pure-death'?0:1]-previous[model.id==='pure-death'?0:1]);previous=sample.counts;
  }
  if(run.stats.events<minimumEvents||model.id==='pure-death'&&run.stats.events>model.initial[0])throw Error('Observed count changes exceed the reported event work.');
  if(model.id==='pure-death'&&model.parameters[0]===0&&(run.stats.events||run.samples.some(sample=>sample.counts[0]!==model.initial[0])))throw Error('Zero-hazard pure death cannot change counts or fire events.');
  if(model.id==='two-state-pool'){
   const [alpha,beta]=model.parameters;
   if((model.total===0||alpha===0&&beta===0)&&run.stats.events)throw Error('Zero total propensity cannot fire pool events.');
   if(alpha===0&&run.stats.events>model.initial[1]||beta===0&&run.stats.events>model.initial[0])throw Error('One-way pool event count exceeds its available entities.');
   if(run.samples.length===grid.length&&(alpha===0&&model.initial[1]-previous[1]!==run.stats.events||beta===0&&previous[1]-model.initial[1]!==run.stats.events))throw Error('One-way pool count changes do not match its event total.');
  }
  if(model.id==='pure-death'&&run.samples.length===grid.length&&model.initial[0]-previous[0]!==run.stats.events)throw Error('Completed death counts do not match the actual event count.');
  if(run.status==='absorbed'){const propensity=model.id==='pure-death'?model.parameters[0]*previous[0]:model.parameters[0]*previous[0]+model.parameters[1]*previous[1];if(propensity!==0)throw Error('An absorbed replicate must have zero total propensity.');}
  events+=run.stats.events;proposals+=run.stats.proposals;drawWords+=run.stats.drawWords;
 }
 if(events>solver.maxEvents||drawWords>solver.maxDrawWords||out.stats.events!==events||out.stats.proposals!==proposals||out.stats.drawWords!==drawWords||out.stats.completedReplicates!==completed)throw Error('Stochastic aggregate work counters exceed or differ from their declared totals.');
 const commonLength=Math.min(...out.replicates.map(run=>run.samples.length)),commonFinalTime=commonLength?grid[commonLength-1]:interval.start;
 if(out.stats.commonFinalTime!==commonFinalTime||out.summary.length!==commonLength||(out.status==='completed')!==(completed===request.replicates)||out.status!=='completed'&&!out.replicates.some(run=>run.status===out.status))throw Error('Stochastic completion or summary coverage censors an incomplete replicate.');
 const expected=summarizeStochasticReplicates(out.replicates),near=(a:number,b:number)=>Math.abs(a-b)<=128*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
 const compare=(a:Array<number|null>,b:Array<number|null>)=>a.length===b.length&&a.every((value,index)=>value===null||b[index]===null?value===b[index]:near(value,b[index]!));
 for(const [index,row] of out.summary.entries()){const wanted=expected[index];scalarValues+=row.mean.length*5;if(row.time!==wanted.time||row.n!==request.replicates||!compare(row.mean,wanted.mean)||!compare(row.sd,wanted.sd)||!compare(row.mcse,wanted.mcse)||JSON.stringify(row.min)!==JSON.stringify(wanted.min)||JSON.stringify(row.max)!==JSON.stringify(wanted.max))throw Error('Stochastic summary values/SD/Monte Carlo error are inconsistent with all requested replicates.');}
 const analytic=stochasticExpectation(normalized);if(out.expectation.length!==analytic.length)throw Error('The declared analytic expectation must cover its full requested grid.');
 for(const [index,row] of out.expectation.entries()){const wanted=analytic[index];scalarValues+=row.mean.length*2;if(row.time!==wanted.time||!compare(row.mean,wanted.mean)||!compare(row.variance,wanted.variance))throw Error('Stochastic analytic expectation metadata differs from the registered model.');}
 if(scalarValues>STOCHASTIC_LIMITS.maxScalarValues)throw Error('Stochastic retained scalar budget exceeded.');
 return out;
}
