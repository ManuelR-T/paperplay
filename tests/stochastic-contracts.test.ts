import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultStochasticSolver,normalizeStochasticRequest,validateStochasticRequest,validateStochasticResult,STOCHASTIC_SOLVER_VERSION,STOCHASTIC_PRNG_VERSION,STOCHASTIC_UNIFORM_VERSION,type StochasticRequest,type StochasticResult } from '../shared/stochastic';

function request():StochasticRequest{return {format:'paperplay-stochastic',schemaVersion:1,model:{id:'pure-death',initial:4,countUnit:'count',rate:{value:1,per:'s',role:'per-item-hazard'}},assumptions:{wellMixed:true,independentEntities:true,constantRates:true,description:'Authored independent losses with fixed synthetic rate; no measured organism prediction.'},interval:{start:0,end:2*Math.LN2,unit:'s'},replicates:2,observationCount:3,random:{seed:'42',sequence:'54'},solver:createDefaultStochasticSolver()};}
/** Hand-authored admissible grid observations; analytic moments are computed here independently of production helpers. */
function result():StochasticResult{const r=request(),end=r.interval.end;return {format:'paperplay-stochastic-result',schemaVersion:1,solverVersion:STOCHASTIC_SOLVER_VERSION,prngVersion:STOCHASTIC_PRNG_VERSION,uniformVersion:STOCHASTIC_UNIFORM_VERSION,request:structuredClone(r),status:'completed',stateIds:['X'],stateLabels:['Remaining'],stateUnits:['count'],timeUnit:'s',replicates:[{id:0,sequence:'54',status:'absorbed',finalTime:end,samples:[{time:0,counts:[4]},{time:Math.LN2,counts:[2]},{time:end,counts:[0]}],stats:{events:4,proposals:4,drawWords:18}},{id:1,sequence:'55',status:'completed',finalTime:end,samples:[{time:0,counts:[4]},{time:Math.LN2,counts:[3]},{time:end,counts:[1]}],stats:{events:3,proposals:4,drawWords:18}}],summary:[{time:0,n:2,mean:[4],sd:[0],mcse:[0],min:[4],max:[4]},{time:Math.LN2,n:2,mean:[2.5],sd:[Math.SQRT1_2],mcse:[.5],min:[2],max:[3]},{time:end,n:2,mean:[.5],sd:[Math.SQRT1_2],mcse:[.5],min:[0],max:[1]}],expectation:[{time:0,mean:[4],variance:[0]},{time:Math.LN2,mean:[2],variance:[1]},{time:end,mean:[1],variance:[.75]}],stats:{events:7,proposals:8,drawWords:36,completedReplicates:2,commonFinalTime:end},diagnostics:[]};}
test('request accepts only explicit registered count models, assumptions and per-item time hazards',()=>{
 const r=request();assert.equal(validateStochasticRequest(r).model.id,'pure-death');
 for(const value of [{...r,assumptions:undefined},{...r,assumptions:{...r.assumptions,independentEntities:false}},{...r,assumptions:{...r.assumptions,description:''}},{...r,model:{...r.model,initial:1.5}},{...r,model:{...r.model,initial:-1}},{...r,model:{...r.model,countUnit:'mol'}},{...r,model:{...r.model,rate:{value:1,per:'Hz',role:'per-item-hazard'}}},{...r,model:{...r.model,rhs:'eval(importedCode)'}},{...r,model:{id:'custom-network'}}])assert.throws(()=>validateStochasticRequest(value));
});
test('canonical full-width seed strings and nonoverlapping bounded sequence selectors are preserved without unsafe numbers',()=>{
 const r=request(),normalized=normalizeStochasticRequest({...r,random:{seed:'18446744073709551615',sequence:'9223372036854775806'}});assert.deepEqual(normalized.sequences,['9223372036854775806','9223372036854775807']);
 for(const seed of ['042','-1','1e2','18446744073709551616','',42])assert.throws(()=>validateStochasticRequest({...r,random:{...r.random,seed}}));
 assert.throws(()=>validateStochasticRequest({...r,random:{seed:'42',sequence:'9223372036854775807'}}));
});
test('time/rate normalization uses actual time units, preserving physical grids and state metadata',()=>{
 const r=request(),ms=structuredClone(r);ms.interval={start:0,end:r.interval.end*1000,unit:'ms'};if(ms.model.id==='pure-death')ms.model.rate={value:.001,per:'ms',role:'per-item-hazard'};
 const a=normalizeStochasticRequest(r),b=normalizeStochasticRequest(ms);assert.deepEqual(a.model,b.model);assert.deepEqual(a.grid,b.grid);assert.equal(b.interval.unit,'s');
 const huge=normalizeStochasticRequest({...r,interval:{start:0,end:1e308,unit:'s'},observationCount:256});assert.equal(huge.grid.length,256);assert.ok(huge.grid.every(Number.isFinite));
 assert.throws(()=>normalizeStochasticRequest({...r,interval:{start:1e16,end:1e16+4,unit:'s'},observationCount:256}));
});
test('population/resource bounds and two-state conservation reject before work',()=>{
 const r=request();for(const value of [{...r,replicates:33},{...r,observationCount:257},{...r,model:{...r.model,initial:4097}},{...r,solver:{...r.solver,maxEventsPerReplicate:10001}},{...r,solver:{...r.solver,maxDrawWords:1000001}},{...r,interval:{start:1,end:1,unit:'s'}},{...r,model:{id:'two-state-pool',total:4,initialActive:5,countUnit:'count',opening:{value:1,per:'s',role:'per-item-hazard'},closing:{value:1,per:'s',role:'per-item-hazard'}}}])assert.throws(()=>validateStochasticRequest(value));
});
test('result binds exact request/streams/grid/counts and reports recomputable summaries separately from analytic moments',()=>{
 const valid=result();assert.equal(validateStochasticResult(valid,request()).status,'completed');
 const mutations:Array<(v:StochasticResult)=>void>=[v=>{v.request.random.seed='43';},v=>{v.replicates[1].sequence='54';},v=>{v.replicates[1].samples[1].counts=[-1];},v=>{v.replicates[1].samples[1].counts=[2.5];},v=>{v.replicates[1].samples[1].time+=.1;},v=>{v.replicates[1].samples[2].counts=[5];},v=>{v.summary[1].mean=[0];},v=>{v.summary[1].sd=[.5];},v=>{v.summary[1].mcse=[Math.SQRT1_2];},v=>{v.expectation[1].variance=[0];},v=>{v.stats.drawWords=0;},v=>{v.replicates[0].stats.drawWords=1;},v=>{v.stateUnits=['mol' as 'count'];}];
 for(const mutate of mutations){const copy=structuredClone(valid);mutate(copy);assert.throws(()=>validateStochasticResult(copy,request()));}
});
test('single-replicate sample SD and Monte Carlo SE are unavailable, not fabricated zero',()=>{
 const out=result();out.request.replicates=1;out.replicates=out.replicates.slice(0,1);out.summary=out.replicates[0].samples.map(sample=>({time:sample.time,n:1,mean:[...sample.counts],sd:[null],mcse:[null],min:[...sample.counts],max:[...sample.counts]}));out.stats={events:4,proposals:4,drawWords:18,completedReplicates:1,commonFinalTime:out.request.interval.end};assert.equal(validateStochasticResult(out,out.request).summary[0].sd[0],null);
 const bad=structuredClone(out);bad.summary[0].sd=[0];assert.throws(()=>validateStochasticResult(bad,out.request));
});
test('an incomplete expensive replicate cannot be dropped or padded to create a censored complete ensemble',()=>{
 const out=result();out.status='limit-reached';out.replicates[1]={...out.replicates[1],status:'limit-reached',finalTime:0,samples:[{time:0,counts:[4]}],stats:{events:0,proposals:0,drawWords:1}};out.summary=out.summary.slice(0,1);out.stats={events:4,proposals:4,drawWords:19,completedReplicates:1,commonFinalTime:0};assert.equal(validateStochasticResult(out,out.request).summary.length,1);
 const fakeComplete=structuredClone(out);fakeComplete.status='completed';assert.throws(()=>validateStochasticResult(fakeComplete,out.request));
 const drop=structuredClone(out);drop.replicates.pop();assert.throws(()=>validateStochasticResult(drop,out.request));
 const censored=structuredClone(out);censored.summary=result().summary;censored.stats.commonFinalTime=out.request.interval.end;assert.throws(()=>validateStochasticResult(censored,out.request));
 const fakeRun=structuredClone(out);fakeRun.replicates[1].status='completed';assert.throws(()=>validateStochasticResult(fakeRun,out.request));
});
test('zero-hazard states and two-state pool boundaries cannot invent events or count transitions',()=>{
 const out=result();if(out.request.model.id==='pure-death')out.request.model.rate.value=0;assert.throws(()=>validateStochasticResult(out,out.request));
 const r:StochasticRequest={...request(),model:{id:'two-state-pool',total:4,initialActive:0,countUnit:'count',opening:{value:0,per:'s',role:'per-item-hazard'},closing:{value:0,per:'s',role:'per-item-hazard'}}};
 const frozen:StochasticResult={...result(),request:r,stateIds:['inactive','active'],stateLabels:['Inactive','Active'],stateUnits:['count','count'],replicates:[0,1].map(id=>({id,sequence:String(54+id),status:'absorbed' as const,finalTime:r.interval.end,samples:[0,Math.LN2,r.interval.end].map(time=>({time,counts:[4,0]})),stats:{events:0,proposals:0,drawWords:0}})),summary:[0,Math.LN2,r.interval.end].map(time=>({time,n:2,mean:[4,0],sd:[0,0],mcse:[0,0],min:[4,0],max:[4,0]})),expectation:[0,Math.LN2,r.interval.end].map(time=>({time,mean:[4,0],variance:[0,0]})),stats:{events:0,proposals:0,drawWords:0,completedReplicates:2,commonFinalTime:r.interval.end}};assert.equal(validateStochasticResult(frozen,r).status,'completed');
 const events=structuredClone(frozen);events.replicates[0].stats={events:1,proposals:1,drawWords:6};events.stats={...events.stats,events:1,proposals:1,drawWords:6};assert.throws(()=>validateStochasticResult(events,r));
 const invalid=structuredClone(frozen);invalid.replicates[0].samples[1].counts=[3,0];assert.throws(()=>validateStochasticResult(invalid,r));
});
test('active completed paths cannot invent a horizon without accounting for their random proposals and warmup',()=>{
 const out=result();out.replicates=out.replicates.map(run=>({...run,status:'completed',samples:run.samples.map(sample=>({...sample,counts:[4]})),stats:{events:0,proposals:0,drawWords:0}}));out.summary=out.summary.map(row=>({...row,mean:[4],sd:[0],mcse:[0],min:[4],max:[4]}));out.stats={...out.stats,events:0,proposals:0,drawWords:0};assert.throws(()=>validateStochasticResult(out,out.request));
 for(const run of out.replicates)run.stats.proposals=1;out.stats.proposals=2;assert.throws(()=>validateStochasticResult(out,out.request));
});
