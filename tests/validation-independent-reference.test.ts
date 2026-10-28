import test from 'node:test';
import assert from 'node:assert/strict';
import {runEngine,engineRegistry,type EngineRun} from '../lib/engines';
import {validateTrace,type AlgorithmInput} from '../shared/schema';
import {validateExecutionRequest,validateExecutionResult} from '../lib/execution/protocol';
import {createDefaultDynamicsSolver,validateDynamicsResult,type DynamicsRequest} from '../shared/dynamics';
import {solveDynamics} from '../lib/dynamics/solver';
import {checkLegacyEngine,checkDynamics} from '../lib/validation/checkers';

const diagonal:AlgorithmInput={kind:'matrix',matrix:[[1,0],[0,4]],rhs:[1,4],initial:[4,-3]};
const graph:AlgorithmInput={kind:'graph',directed:true,nodeRoles:{start:'s'},nodes:['s','a','b','t','u'].map(id=>({id,label:id})),edges:[{id:'sa',source:'s',target:'a',weight:19},{id:'sb',source:'s',target:'b',weight:1},{id:'ba',source:'b',target:'a',weight:2},{id:'at',source:'a',target:'t',weight:1},{id:'bt',source:'b',target:'t',weight:20}]};
function admitted(run:EngineRun){
 validateTrace(run.trace,engineRegistry);
 const request=validateExecutionRequest({version:1,id:'independent-reference',kind:'run',engineId:run.engineId,input:run.trace.input,options:{seed:run.trace.seed,parameters:run.trace.binding.parameters}});
 assert.doesNotThrow(()=>validateExecutionResult({kind:'run',run},request));
}
const pass=(run:EngineRun)=>{admitted(run);assert.ok(checkLegacyEngine(run).every(check=>check.status==='pass'));};
const fail=(run:EngineRun)=>{admitted(run);assert.ok(checkLegacyEngine(run).some(check=>check.status==='fail'));};
const close=(actual:number,expected:number,tolerance=2e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function decay():DynamicsRequest{return {format:'paperplay-dynamics',schemaVersion:1,model:{id:'decay',initial:{value:4,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'}},interval:{start:0,end:Math.log(2),unit:'s'},solver:{...createDefaultDynamicsSolver([{value:1e-10,unit:'1'}]),rtol:1e-9}};}
function chain(k2=2):DynamicsRequest{const r=decay();r.model={id:'reaction-chain',initial:[{value:2,unit:'mol/L'},{value:3,unit:'mol/L'},{value:5,unit:'mol/L'}],rates:[{value:1,per:'s',role:'decay-rate'},{value:k2,per:'s',role:'decay-rate'}]};r.solver.atol=Array.from({length:3},()=>({value:1e-10,unit:'mol/L' as const}));return r;}

test('all six legacy engines pass independent references on authored bounded inputs',()=>{
 for(const id of ['dijkstra-heap','dijkstra-scan']){const run=runEngine(id,graph);assert.equal(run.result.kind,'graph');if(run.result.kind==='graph')assert.deepEqual(run.result.distances,{s:0,a:3,b:1,t:4,u:null});pass(run);}
 for(const id of ['powersort','natural-mergesort']){const run=runEngine(id,{kind:'array',values:[2,1,2,1]});if(run.result.kind==='array')assert.deepEqual(run.result.originalIndices,[1,3,0,2]);pass(run);}
 for(const id of ['gradient-descent','heavy-ball']){const run=runEngine(id,diagonal,{parameters:{iterations:2,stepSize:.2,...(id==='heavy-ball'?{momentum:.6}:{})}});if(run.result.kind==='matrix'){const expected=id==='heavy-ball'?[2.56,2.76]:[2.92,.84];run.result.values.forEach((v,i)=>close(v,expected[i],1e-12));}pass(run);}
});

test('finite reachable but incorrect distance passes structural admission and fails the oracle',()=>{
 for(const id of ['dijkstra-heap','dijkstra-scan']){const run:EngineRun=structuredClone(runEngine(id,graph));if(run.result.kind!=='graph')throw Error();run.result.distances.t=5;const last=run.trace.steps.at(-1)!;if(last.state.kind==='graph')last.state.distances!.t=5;
 // A weak authored self-test succeeds; this is not a claim of running model-generated tests.
 assert.ok(Number.isFinite(run.result.distances.t));fail(run);}
});

test('sorted keys and a valid permutation still fail when equal-key stability is reversed',()=>{
 for(const id of ['powersort','natural-mergesort']){const run:EngineRun=structuredClone(runEngine(id,{kind:'array',values:[2,1,2,1]}));if(run.result.kind!=='array')throw Error();run.result.originalIndices=[3,1,0,2];const last=run.trace.steps.at(-1)!;if(last.state.kind==='array')last.state.originalIndices=[3,1,0,2];assert.ok(run.result.values.every((v,i,a)=>i===0||v>=a[i-1]));assert.equal(new Set(run.result.originalIndices).size,4);fail(run);}
});

test('self-consistent residuals and decreasing objectives cannot hide the wrong numerical recurrence',()=>{
 for(const id of ['gradient-descent','heavy-ball']){
  const run:EngineRun=structuredClone(runEngine(id,diagonal,{parameters:{iterations:3,stepSize:.2,...(id==='heavy-ball'?{momentum:.6}:{})}}));
  const history:{iteration:number,residual:number}[]=[];const objective:number[]=[];
  for(const step of run.trace.steps){if(step.state.kind!=='matrix')throw Error();const k=step.state.iteration;const x=id==='gradient-descent'?[1+3*.9**k,1-4*.6**k]:[1+3*.8**k,1-4*.2**k];const residual=Math.hypot(x[0]-1,4*x[1]-4);history.push({iteration:k,residual});step.state.values=x;step.state.residual=residual;step.state.history=structuredClone(history);objective.push((x[0]-1)**2/2+2*(x[1]-1)**2);}
  if(run.result.kind!=='matrix')throw Error();const last=run.trace.steps.at(-1)!.state;if(last.kind!=='matrix')throw Error();run.result.values=[...last.values];run.result.residual=last.residual;run.trace.metrics.find(metric=>metric.id==='residual')!.value=last.residual;
  assert.ok(objective.every((v,i)=>i===0||v<objective[i-1]));fail(run);
 }
});

test('positive wrong decay and positive conserving wrong reaction trajectories pass shape admission but fail analytic checks',()=>{
 for(const request of [decay(),chain()]){const result=structuredClone(solveDynamics(request));assert.equal(result.status,'completed');const total=request.model.id==='reaction-chain'?10:4;
  for(const row of result.samples){if(row.time===0)continue;const a=(request.model.id==='reaction-chain'?2:4)*Math.exp(-.5*row.time);row.state=request.model.id==='reaction-chain'?[a,3+(2-a)/2,total-a-(3+(2-a)/2)]:[a];}
  assert.ok(result.samples.every(row=>row.state.every(v=>v>=0)));if(request.model.id==='reaction-chain')assert.ok(result.samples.every(row=>Math.abs(row.state.reduce((a,b)=>a+b,0)-10)<1e-12));
  validateDynamicsResult(result,request);assert.ok(checkDynamics(request,result).some(check=>check.status==='fail'));
 }
});

test('reaction oracle handles nonzero initial intermediate, equal and near-equal rates independently',()=>{
 for(const k2 of [2,1,1+1e-10,1-1e-10]){const request=chain(k2),result=validateDynamicsResult(solveDynamics(request),request),end=result.samples.at(-1)!.state;const expected=k2===2?[1,1.25,7.75]:[1,1.5+Math.log(2),7.5-Math.log(2)];end.forEach((v,i)=>close(v,expected[i]));assert.ok(checkDynamics(request,result).every(check=>check.status==='pass'));}
});

test('independent unit/time half-life reference uses canonical amount rather than displayed unit labels',()=>{
 const request=decay();request.model={id:'decay',initial:{value:4,unit:'mmol'},rate:{value:60,per:'min',role:'decay-rate'}};request.interval={start:0,end:1000*Math.log(2),unit:'ms'};request.solver.atol=[{value:1e-7,unit:'mmol'}];request.solver.initialStep*=1000;request.solver.minStep*=1000;request.solver.maxStep*=1000;request.solver.eventTimeTolerance*=1000;
 const result=validateDynamicsResult(solveDynamics(request),request);assert.deepEqual(result.stateUnits,['mol']);close(result.samples.at(-1)!.state[0],.002,1e-10);close(result.stats.finalTime,Math.log(2),1e-12);assert.ok(checkDynamics(request,result).every(check=>check.status==='pass'));
});
