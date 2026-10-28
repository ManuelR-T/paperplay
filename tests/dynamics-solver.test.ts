import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDynamicsSolver,type DynamicsRequest,type DynamicsSolver } from '../shared/dynamics';
import { validateDynamicsResult } from '../lib/dynamics/model';
import { solveDynamics } from '../lib/dynamics/solver';
function decay(end=1,solver:Partial<DynamicsSolver>={}):DynamicsRequest{return {format:'paperplay-dynamics',schemaVersion:1,model:{id:'decay',initial:{value:4,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'}},interval:{start:0,end,unit:'s'},solver:{...createDefaultDynamicsSolver([{value:1e-10,unit:'1'}]),rtol:1e-9,...solver}};}
function run(request:DynamicsRequest,options:Parameters<typeof solveDynamics>[1]={}){return validateDynamicsResult(solveDynamics(request,options),request);}
const last=(result:ReturnType<typeof run>)=>result.samples.at(-1)!.state;
test('decay independent half-life oracle and zero rate preserve nonnegative amount',()=>{
 const result=run(decay(Math.log(2)));assert.equal(result.status,'completed');assert.ok(Math.abs(last(result)[0]-2)<1e-8);assert.equal(result.stats.finalTime,Math.log(2));assert.ok(result.stats.largestAcceptedNormalizedError<=1);
 const zero=decay();zero.model={id:'decay',initial:{value:3,unit:'mol'},rate:{value:0,per:'s',role:'decay-rate'}};zero.solver.atol=[{value:1e-9,unit:'mol'}];assert.equal(last(run(zero))[0],3);
});
test('fixed-grid smooth refinement has fourth-order accuracy against an analytic oracle',()=>{
 const error=(h:number)=>Math.abs(last(run(decay(1,{initialStep:h,maxStep:h,minStep:1e-12,rtol:.1,atol:[{value:1,unit:'1'}]})))[0]-4*Math.exp(-1));
 const coarse=error(.25),fine=error(.125);assert.ok(coarse/fine>14&&coarse/fine<18,`observed ratio ${coarse/fine}`);
});
test('damped oscillator follows independently differentiated analytic position and velocity',()=>{
 const request=decay(Math.PI/2);request.model={id:'oscillator',position:{value:1,unit:'m'},velocity:{value:0,unit:'m/s'},damping:{value:1,per:'s',role:'decay-rate'},angularFrequency:{value:Math.sqrt(2),per:'s',role:'angular-frequency'}};request.solver.atol=[{value:1e-10,unit:'m'},{value:1e-10,unit:'m/s'}];
 const result=run(request),[x,v]=last(result),expected=Math.exp(-Math.PI/2);assert.equal(result.status,'completed');assert.ok(Math.abs(x-expected)<2e-8);assert.ok(Math.abs(v+2*expected)<2e-8);
 const energy=result.samples.map(row=>row.state[0]**2+row.state[1]**2/2);assert.ok(energy.every((value,index)=>index===0||value<=energy[index-1]+1e-10));
});
test('coupled reaction independent rational oracle conserves total concentration',()=>{
 const request=decay(Math.log(2));request.model={id:'reaction-chain',initial:[{value:1,unit:'mol/L'},{value:0,unit:'mol/L'},{value:0,unit:'mol/L'}],rates:[{value:1,per:'s',role:'decay-rate'},{value:2,per:'s',role:'decay-rate'}]};request.solver.atol=Array.from({length:3},()=>({value:1e-10,unit:'mol/L' as const}));
 const result=run(request);assert.equal(result.status,'completed');last(result).forEach((value,index)=>assert.ok(Math.abs(value-[.5,.25,.25][index])<1e-8));assert.ok(result.samples.every(row=>row.state.every(value=>value>=0)&&Math.abs(row.state.reduce((a,b)=>a+b,0)-1)<2e-14));
});
function hybrid(terminal=false):DynamicsRequest{const request=decay(2*Math.log(2));request.model={id:'threshold-decay',initial:{value:1,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'},event:{threshold:{value:.5,unit:'1'},reset:{value:1,unit:'1'},rateAfter:{value:2,per:'s',role:'decay-rate'},direction:'falling',terminal}};request.solver.eventTimeTolerance=1e-9;return request;}
test('hybrid threshold records both sides of the reset and restarts the changed equation',()=>{
 const result=run(hybrid());assert.equal(result.status,'completed');assert.equal(result.events.length,1);const event=result.events[0];assert.ok(Math.abs(event.time-Math.log(2))<1e-8);assert.ok(event.bracketWidth<=1e-9);assert.deepEqual(event.before,[.5]);assert.deepEqual(event.after,[1]);assert.ok(Math.abs(last(result)[0]-.25)<2e-8);
 const jump=result.samples.filter(row=>row.time===event.time);assert.deepEqual(jump.map(row=>row.mode),[0,1]);assert.deepEqual(jump.map(row=>row.state[0]),[.5,1]);
 const stopped=run(hybrid(true));assert.equal(stopped.status,'terminal-event');assert.deepEqual(stopped.events[0].after,[.5]);assert.equal(stopped.samples.at(-1)!.mode,0);assert.equal(stopped.stats.finalTime,stopped.events[0].time);
});
test('initial threshold triggers once at time zero without a repeated event loop',()=>{
 const request=hybrid();if(request.model.id!=='threshold-decay')throw Error();request.model.event.threshold.value=1;const result=run(request);assert.equal(result.events.length,1);assert.equal(result.events[0].time,0);assert.equal(result.status,'completed');
});
test('seconds/milliseconds and equivalent amount units give matching canonical trajectories',()=>{
 const seconds=decay(Math.log(2)),ms=decay(Math.log(2)*1000);ms.interval.unit='ms';ms.model={id:'decay',initial:{value:4000,unit:'mmol'},rate:{value:.001,per:'ms',role:'decay-rate'}};seconds.model={id:'decay',initial:{value:4,unit:'mol'},rate:{value:1,per:'s',role:'decay-rate'}};seconds.solver.atol=[{value:1e-10,unit:'mol'}];ms.solver={...seconds.solver,atol:[{value:1e-7,unit:'mmol'}],initialStep:seconds.solver.initialStep*1000,minStep:seconds.solver.minStep*1000,maxStep:seconds.solver.maxStep*1000,eventTimeTolerance:seconds.solver.eventTimeTolerance*1000};assert.ok(Math.abs(last(run(seconds))[0]-last(run(ms))[0])<1e-12);
});
test('input domains, units and arbitrary model/code fields fail before numerical work',()=>{
 const invalid=decay();if(invalid.model.id!=='decay')throw Error();invalid.model.initial.value=-1;assert.throws(()=>solveDynamics(invalid));const wrong=decay();wrong.solver.atol=[{value:1e-8,unit:'s'}];assert.throws(()=>solveDynamics(wrong));assert.throws(()=>solveDynamics({...decay(),rhs:'globalThis'} as unknown as DynamicsRequest));
});
test('step, attempt, RHS, output and event budgets retain an honest valid prefix',()=>{
 for(const [solver,code] of [[{maxAcceptedSteps:1},'step-limit'],[{maxAttempts:1},'attempt-limit'],[{maxRhsEvaluations:1},'rhs-limit'],[{maxOutputRows:2},'output-limit']] as const){const result=run(decay(1,solver));assert.equal(result.status,'limit-reached');assert.ok(result.stats.finalTime<1);assert.ok(result.diagnostics.some(d=>d.code===code));assert.equal(result.samples.at(-1)!.time,result.stats.finalTime);}
 const limit=hybrid();limit.solver.maxEvents=0;assert.ok(run(limit).diagnostics.some(d=>d.code==='event-limit'));
 const root=hybrid();root.solver.maxEventIterations=1;assert.ok(run(root).diagnostics.some(d=>d.code==='event-iterations'));
});
test('unresolvable tolerance/stability and cancellation are explicit incomplete outcomes',()=>{
 const tolerance=run(decay(1,{initialStep:1,minStep:1,maxStep:1,rtol:1e-15,atol:[{value:1e-15,unit:'1'}]}));assert.equal(tolerance.status,'tolerance-not-met');assert.equal(tolerance.stats.finalTime,0);
 const unstable=run(decay(10,{initialStep:6,minStep:6,maxStep:6}));assert.equal(unstable.status,'unstable');assert.equal(unstable.stats.finalTime,0);
 const controller=new AbortController();controller.abort();assert.equal(run(decay(),{signal:controller.signal}).status,'cancelled');let clock=0;const deadline=run(decay(),{now:()=>clock++*1000});assert.ok(deadline.diagnostics.some(d=>d.code==='deadline'));
});
test('large time origins never round a requested step upward beyond its declared bound',()=>{
 for(const h of [1,1.5]){const request=decay(1e16+4,{initialStep:h,maxStep:h});request.interval.start=1e16;if(request.model.id!=='decay')throw Error();request.model.rate.value=0;const result=run(request);assert.equal(result.status,'tolerance-not-met');assert.equal(result.stats.finalTime,1e16);assert.equal(result.samples.length,1);assert.equal(result.stats.acceptedSteps,0);assert.ok(result.diagnostics.some(d=>d.code==='time-not-advancing'));}
});
