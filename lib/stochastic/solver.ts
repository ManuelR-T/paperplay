import {STOCHASTIC_SOLVER_VERSION,STOCHASTIC_PRNG_VERSION,STOCHASTIC_UNIFORM_VERSION,type StochasticRequest,type StochasticResult,type StochasticStatus,type StochasticReplicate,type StochasticDiagnostic} from '../../shared/stochastic';
import {normalizeStochasticRequest} from './model';
import {createPcg32,openUniform53} from './pcg32';
class Halt extends Error{constructor(readonly status:Exclude<StochasticStatus,'completed'>,readonly code:StochasticDiagnostic['code'],readonly detail:string,readonly global=false){super(detail);}}
export type StochasticSolverOptions={signal?:AbortSignal;now?:()=>number;/** Trusted tests only; no imported JSON can install a word source. */wordSource?:(replicate:number,seed:string,sequence:string)=>()=>number};
/** Gillespie direct SSA for two finite registered count processes, never imported propensities. */
export function solveStochastic(raw:StochasticRequest,options:StochasticSolverOptions={}):StochasticResult{
 const {request,model,interval,grid,sequences,solver}=normalizeStochasticRequest(raw),now=options.now??Date.now,started=now();
 const replicates:StochasticReplicate[]=[],diagnostics:StochasticDiagnostic[]=[];const stats={events:0,proposals:0,drawWords:0,completedReplicates:0,commonFinalTime:interval.end};let status:StochasticStatus='completed',stopped=false;
 function check(){if(options.signal?.aborted)throw new Halt('cancelled','cancelled','Simulation stopped; valid observation prefixes are retained.',true);if(now()-started>=solver.maxWallMs)throw new Halt('limit-reached','deadline','The simulation wall-clock budget was reached.',true);}
 function appendDiagnostic(halt:Halt,id:number){if(diagnostics.length<63)diagnostics.push({code:halt.code,message:halt.detail,replicate:id});}
 for(let id=0;id<request.replicates;id++){
  const run:StochasticReplicate={id,sequence:sequences[id],status:stopped?'not-started':'completed',finalTime:interval.start,samples:[{time:grid[0],counts:[...model.initial]}],stats:{events:0,proposals:0,drawWords:0}};replicates.push(run);let counts=[...model.initial],time=interval.start,observation=1;
  if(stopped)continue;
  let nextWord:(()=>number)|undefined;
  function beforeWord(){check();if(stats.drawWords>=solver.maxDrawWords)throw new Halt('limit-reached','draw-limit','The raw PRNG-word budget was reached, including initialization and rejected uniforms.',true);stats.drawWords++;run.stats.drawWords++;}
  function words(){if(!nextWord){if(options.wordSource){const source=options.wordSource(id,request.random.seed,sequences[id]);nextWord=()=>{beforeWord();const word=source();if(!Number.isInteger(word)||word<0||word>0xffffffff)throw new Halt('invalid-domain','invalid-domain','The trusted random adapter returned a non-uint32 word.');return word;};nextWord();nextWord();}else nextWord=createPcg32(request.random.seed,sequences[id],beforeWord).nextUint32;}return nextWord;}
  function fillUntil(target:number,inclusive:boolean){while(observation<grid.length&&(inclusive?grid[observation]<=target:grid[observation]<target)){run.samples.push({time:grid[observation++],counts:[...counts]});}}
  try{
   check();while(time<interval.end){
    check();const [a,b]=counts,[first,second]=model.parameters,propensities=model.id==='pure-death'?[first*a]:[first*a,second*b],total=propensities.reduce((sum,value)=>sum+value,0);
    if(propensities.some(value=>!Number.isFinite(value)||value<0)||!Number.isFinite(total))throw new Halt('nonfinite','nonfinite','The registered event intensity is not finite and nonnegative.');
    if(total===0){fillUntil(interval.end,true);time=interval.end;run.status='absorbed';break;}
    if(run.stats.events>=solver.maxEventsPerReplicate)throw new Halt('limit-reached','event-limit','The per-replicate event budget was reached.');
    if(stats.events>=solver.maxEvents)throw new Halt('limit-reached','event-limit','The shared event budget was reached.',true);
    run.stats.proposals++;stats.proposals++;
    // Both open uniforms are consumed for every proposal, even a horizon overshoot.
    const random=words(),u1=openUniform53(random),u2=openUniform53(random),wait=-Math.log(u1)/total;
    if(!Number.isFinite(wait)||!(wait>0))throw new Halt('nonfinite','nonfinite','The sampled waiting time is not finite and positive.');
    if(wait>interval.end-time){fillUntil(interval.end,true);time=interval.end;break;}
    const eventTime=time+wait;if(!Number.isFinite(eventTime)||eventTime<=time)throw new Halt('time-not-advancing','time-not-advancing','The sampled event time cannot advance at floating-point resolution.');
    if(eventTime>interval.end){fillUntil(interval.end,true);time=interval.end;break;}
    let cumulative=0,channel=-1;for(let index=0;index<propensities.length;index++){cumulative+=propensities[index];if(u2<cumulative/total){channel=index;break;}}
    if(channel<0)throw new Halt('invalid-domain','invalid-domain','No registered event channel matches the sampled cumulative propensity.');
    fillUntil(eventTime,false);
    const next=model.id==='pure-death'?[counts[0]-1]:channel===0?[counts[0]-1,counts[1]+1]:[counts[0]+1,counts[1]-1];
    if(next.some(value=>!Number.isSafeInteger(value)||value<0||value>model.total)||model.id==='two-state-pool'&&next[0]+next[1]!==model.total)throw new Halt('invalid-domain','invalid-domain','A registered event would leave its integer population domain.');
    counts=next;time=eventTime;run.stats.events++;stats.events++;fillUntil(time,true);
   }
  }catch(error){if(error instanceof Halt){run.status=error.status;status=status==='completed'||error.global?error.status:status;stopped=error.global;appendDiagnostic(error,id);}else throw error;}
  run.finalTime=time;if(run.status==='completed'||run.status==='absorbed')stats.completedReplicates++;
 }
 const length=Math.min(...replicates.map(run=>run.samples.length));stats.commonFinalTime=length?grid[length-1]:interval.start;
 const summary:StochasticResult['summary']=Array.from({length},(_,index)=>{
  const mean=model.initial.map(()=>0),m2=model.initial.map(()=>0),min=model.initial.map(()=>Infinity),max=model.initial.map(()=>-Infinity);
  replicates.forEach((run,replicate)=>run.samples[index].counts.forEach((value,state)=>{const delta=value-mean[state];mean[state]+=delta/(replicate+1);m2[state]+=delta*(value-mean[state]);min[state]=Math.min(min[state],value);max[state]=Math.max(max[state],value);}));
  const sd=m2.map(value=>request.replicates>1?Math.sqrt(Math.max(0,value)/(request.replicates-1)):null),mcse=sd.map(value=>value===null?null:value/Math.sqrt(request.replicates));return {time:grid[index],n:request.replicates,mean,sd,mcse,min,max};
 });
 const expectation:StochasticResult['expectation']=grid.map(time=>{
  const elapsed=time-interval.start,[a,b]=model.parameters;
  if(model.id==='pure-death'){const probability=Math.exp(-a*elapsed);return {time,mean:[model.initial[0]*probability],variance:[model.initial[0]*probability*(1-probability)]};}
  const totalRate=a+b,decay=Math.exp(-totalRate*elapsed),equilibrium=totalRate===0?0:a/totalRate,q01=equilibrium*(1-decay),q11=totalRate===0?1:equilibrium+(1-equilibrium)*decay;
  const active=model.initial[1]*q11+model.initial[0]*q01,variance=model.initial[1]*q11*(1-q11)+model.initial[0]*q01*(1-q01);return {time,mean:[model.total-active,active],variance:[Math.max(0,variance),Math.max(0,variance)]};
 });
 if(status!=='completed')diagnostics.push({code:'incomplete-ensemble',message:'Summary coverage includes all requested replicates only on their common supported observation prefix; completed replicates were not selected as an uncensored ensemble.'});
 return {format:'paperplay-stochastic-result',schemaVersion:1,solverVersion:STOCHASTIC_SOLVER_VERSION,prngVersion:STOCHASTIC_PRNG_VERSION,uniformVersion:STOCHASTIC_UNIFORM_VERSION,request,status,stateIds:model.stateIds,stateLabels:model.stateLabels,stateUnits:model.stateUnits,timeUnit:'s',replicates,summary,expectation,stats,diagnostics};
}
