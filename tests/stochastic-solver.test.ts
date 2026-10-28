import test from 'node:test';
import assert from 'node:assert/strict';
import {solveStochastic,type StochasticSolverOptions} from '../lib/stochastic/solver';
import {validateStochasticResult} from '../lib/stochastic/model';
import {createDefaultStochasticSolver,type StochasticRequest} from '../shared/stochastic';
const hazard=(value:number)=>({value,per:'s' as const,role:'per-item-hazard' as const});
function fixture(end=1):StochasticRequest{return {format:'paperplay-stochastic',schemaVersion:1,model:{id:'pure-death',initial:4,countUnit:'count',rate:hazard(1)},assumptions:{wellMixed:true,independentEntities:true,constantRates:true,description:'Authored independent constant-hazard count process.'},interval:{start:0,end,unit:'s'},replicates:4,observationCount:9,random:{seed:'42',sequence:'54'},solver:createDefaultStochasticSolver()};}
function run(request:StochasticRequest,options:StochasticSolverOptions={}){return validateStochasticResult(solveStochastic(request,options),request);}
/** Two discarded initialization words, then one pair per exact binary53 uniform. */
function uniforms(values:number[]):StochasticSolverOptions['wordSource']{return ()=>{const words=[0,0,...values.flatMap(value=>{const integer=value*9007199254740992;assert.ok(Number.isSafeInteger(integer));return [Math.floor(integer/67108864)*32,(integer%67108864)*64];})];let index=0;return ()=>{if(index>=words.length)throw Error('Unexpected additional random draw');return words[index++];};};}
test('fixed uniforms verify exponential waiting, right continuity and lazy absorbing zero-draw behavior',()=>{
 const request=fixture(2);request.replicates=1;request.observationCount=3;request.model={id:'pure-death',initial:1,countUnit:'count',rate:hazard(Math.log(2))};
 const result=run(request,{wordSource:uniforms([.5,.5])});assert.deepEqual(result.replicates[0].samples.map(row=>row.counts),[[1],[0],[0]]);assert.equal(result.replicates[0].status,'absorbed');assert.equal(result.stats.events,1);assert.equal(result.stats.proposals,1);assert.equal(result.stats.drawWords,6);assert.deepEqual(result.summary[1].sd,[null]);assert.deepEqual(result.summary[1].mcse,[null]);
 const zero=fixture();zero.model={id:'pure-death',initial:0,countUnit:'count',rate:hazard(1)};const absorbed=run(zero);assert.equal(absorbed.stats.drawWords,0);assert.equal(absorbed.stats.proposals,0);assert.ok(absorbed.replicates.every(value=>value.status==='absorbed'));
});
test('categorical strict-boundary convention chooses the second equal-propensity channel',()=>{
 const request=fixture(1);request.replicates=1;request.observationCount=2;request.model={id:'two-state-pool',total:2,initialActive:1,countUnit:'count',opening:hazard(Math.log(2)/2),closing:hazard(Math.log(2)/2)};
 const result=run(request,{wordSource:uniforms([.5,.5])});assert.deepEqual(result.replicates[0].samples.at(-1)!.counts,[2,0]);assert.equal(result.stats.events,1);assert.equal(result.stats.drawWords,6);
});
test('overshoot consumes both uniforms but fires no event; endpoints stay within the finite horizon',()=>{
 const request=fixture(1);request.replicates=1;request.model={id:'pure-death',initial:1,countUnit:'count',rate:hazard(Math.log(2)/2)};const result=run(request,{wordSource:uniforms([.5,.75])});assert.equal(result.status,'completed');assert.equal(result.stats.events,0);assert.equal(result.stats.proposals,1);assert.equal(result.stats.drawWords,6);assert.ok(result.replicates[0].samples.every(row=>row.counts[0]===1));
});
test('seed replay and observation-grid changes preserve each replicate stream and event statistics',()=>{
 const coarse=fixture(3);coarse.observationCount=5;const fine={...coarse,observationCount:9};const a=run(coarse),b=run(fine),repeated=run(coarse);assert.deepEqual(a,repeated);
 for(let index=0;index<coarse.replicates;index++){assert.deepEqual(a.replicates[index].stats,b.replicates[index].stats);assert.deepEqual(a.replicates[index].samples,b.replicates[index].samples.filter((_,row)=>row%2===0));}
 const more=run({...coarse,replicates:8});assert.deepEqual(a.replicates,more.replicates.slice(0,4));assert.equal(new Set(more.replicates.map(value=>value.sequence)).size,8);
});
test('two-state trajectories conserve population, respect boundaries and leave a nonabsorbing boundary',()=>{
 const request=fixture(3);request.model={id:'two-state-pool',total:8,initialActive:0,countUnit:'count',opening:hazard(2),closing:hazard(1)};const result=run(request);assert.ok(result.replicates.every(rep=>rep.samples.every(row=>row.counts[0]+row.counts[1]===8&&row.counts.every(Number.isInteger))));assert.ok(result.stats.events>0);assert.ok(result.replicates.some(rep=>rep.samples.some(row=>row.counts[1]>0)));
 const fixed=structuredClone(request);if(fixed.model.id!=='two-state-pool')throw Error();fixed.model.opening.value=0;fixed.model.closing.value=0;const staticResult=run(fixed);assert.equal(staticResult.stats.drawWords,0);assert.ok(staticResult.replicates.every(rep=>rep.status==='absorbed'));
});
test('analytic moments stay separate from empirical sample SD and mean Monte Carlo error',()=>{
 const request=fixture(Math.log(2));const result=run(request);assert.deepEqual(result.expectation.at(-1)!.mean,[2]);assert.deepEqual(result.expectation.at(-1)!.variance,[1]);const row=result.summary.at(-1)!,values=result.replicates.map(rep=>rep.samples.at(-1)!.counts[0]),mean=values.reduce((a,b)=>a+b,0)/values.length,sd=Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/(values.length-1));assert.equal(row.mean[0],mean);assert.ok(Math.abs(row.sd[0]!-sd)<1e-14);assert.ok(Math.abs(row.mcse[0]!-sd/Math.sqrt(values.length))<1e-14);
 const pool=fixture(Math.log(2)/2);pool.model={id:'two-state-pool',total:4,initialActive:0,countUnit:'count',opening:hazard(1),closing:hazard(1)};const p=run(pool);assert.deepEqual(p.expectation.at(-1)!.mean,[3,1]);assert.deepEqual(p.expectation.at(-1)!.variance,[.75,.75]);
 const partial=structuredClone(pool);if(partial.model.id!=='two-state-pool')throw Error();partial.model.initialActive=2;const mixed=run(partial);assert.deepEqual(mixed.expectation.at(-1)!.mean,[2,2]);assert.deepEqual(mixed.expectation.at(-1)!.variance,[.75,.75]);
});
test('independent binomial histogram checks use frozen distinct streams and predeclared six-sigma allowances',()=>{
 // 128 batches ×32 distinct selectors, fixed before observing any histogram.
 // Each indicator-bin allowance is 6*sqrt(p*(1-p)/4096)+1/4096.
 // This is a finite engineering check, not a statistical battery or independence proof.
 const n=4096,histograms=[Array(5).fill(0),Array(5).fill(0)];
 for(let batch=0;batch<128;batch++)for(let model=0;model<2;model++){const request=fixture(model?Math.log(2)/2:Math.log(2));request.replicates=32;request.observationCount=2;request.random.sequence=String(batch*32);if(model)request.model={id:'two-state-pool',total:4,initialActive:0,countUnit:'count',opening:hazard(1),closing:hazard(1)};const result=run(request);for(const rep of result.replicates)histograms[model][rep.samples.at(-1)!.counts[model]]++;}
 for(const [model,probabilities]of [[0,[1/16,4/16,6/16,4/16,1/16]],[1,[81/256,108/256,54/256,12/256,1/256]]] as const){probabilities.forEach((p,bin)=>assert.ok(Math.abs(histograms[model][bin]/n-p)<=6*Math.sqrt(p*(1-p)/n)+1/n));const observedMean=histograms[model].reduce((sum,count,index)=>sum+count*index,0)/n;assert.ok(Math.abs(observedMean-(model?1:2))<=6*Math.sqrt((model?.75:1)/n));}
});
test('word/event budgets count initialization, proposals and rejected zeros, with no censored ensemble',()=>{
 const request=fixture(10);request.solver.maxDrawWords=7;const result=run(request);assert.equal(result.status,'limit-reached');assert.equal(result.stats.drawWords,7);assert.equal(result.replicates[1].status,'not-started');assert.equal(result.summary.length,1);assert.equal(result.summary[0].n,4);assert.equal(result.stats.commonFinalTime,0);
 const zeros=fixture();zeros.replicates=1;zeros.solver.maxDrawWords=8;const rejected=run(zeros,{wordSource:()=>()=>0});assert.equal(rejected.stats.drawWords,8);assert.equal(rejected.stats.events,0);assert.equal(rejected.stats.proposals,1);
 const cap=fixture(10);cap.solver.maxEventsPerReplicate=1;const truncated=run(cap);assert.equal(truncated.status,'limit-reached');assert.ok(truncated.replicates.every(rep=>rep.stats.events<=1));assert.ok(truncated.summary.every(row=>row.n===cap.replicates));
});
test('invalid domains, unsupported imported models, cancellation, deadlines and nonadvancing time are explicit',()=>{
 const invalid=fixture();invalid.model={id:'pure-death',initial:1.5,countUnit:'count',rate:hazard(1)};assert.throws(()=>solveStochastic(invalid));assert.throws(()=>solveStochastic({...fixture(),rhs:'javascript'} as unknown as StochasticRequest));
 const controller=new AbortController();controller.abort();const cancelled=run(fixture(),{signal:controller.signal});assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.stats.drawWords,0);
 let ticks=0;const deadline=run(fixture(),{now:()=>ticks++*1000});assert.ok(deadline.diagnostics.some(value=>value.code==='deadline'));
 const large=fixture(1e16+2);large.interval.start=1e16;large.observationCount=2;large.replicates=1;large.model={id:'pure-death',initial:1,countUnit:'count',rate:hazard(1)};const stopped=run(large,{wordSource:uniforms([.5,.5])});assert.equal(stopped.status,'time-not-advancing');assert.equal(stopped.replicates[0].finalTime,1e16);
});
