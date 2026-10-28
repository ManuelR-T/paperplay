import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDynamicsSolver,normalizeDynamicsRequest,validateDynamicsRequest,validateDynamicsResult,DYNAMICS_SOLVER_VERSION,type DynamicsRequest,type DynamicsResult } from '../shared/dynamics';

function decay():DynamicsRequest{return {format:'paperplay-dynamics',schemaVersion:1,model:{id:'decay',initial:{value:4,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'}},interval:{start:0,end:Math.LN2,unit:'s'},solver:createDefaultDynamicsSolver([{value:1e-9,unit:'1'}])};}
function completed(request=decay()):DynamicsResult{const n=normalizeDynamicsRequest(request);return {format:'paperplay-dynamics-result',schemaVersion:1,solverVersion:DYNAMICS_SOLVER_VERSION,request:structuredClone(request),status:'completed',stateIds:n.model.stateIds,stateLabels:n.model.stateLabels,stateUnits:n.model.stateUnits,timeUnit:'s',samples:[{time:n.interval.start,state:[...n.model.initial],mode:0},{time:n.interval.end,state:[2],mode:0}],events:[],stats:{acceptedSteps:1,rejectedSteps:0,attempts:1,rhsEvaluations:12,eventIterations:0,largestAcceptedNormalizedError:.5,finalTime:n.interval.end},diagnostics:[]};}
function threshold(terminal=false):DynamicsRequest{return {...decay(),model:{id:'threshold-decay',initial:{value:1,unit:'1'},rate:{value:1,per:'s',role:'decay-rate'},event:{threshold:{value:.5,unit:'1'},reset:{value:1,unit:'1'},rateAfter:{value:2,per:'s',role:'decay-rate'},direction:'falling',terminal}},interval:{start:0,end:2*Math.LN2,unit:'s'}};}
function eventResult(terminal=false):DynamicsResult{const request=threshold(terminal),end=terminal?Math.LN2:2*Math.LN2;return {...completed(request),status:terminal?'terminal-event':'completed',samples:[{time:0,state:[1],mode:0},{time:Math.LN2,state:[.5],mode:0},...terminal?[]:[{time:Math.LN2,state:[1],mode:1 as const},{time:end,state:[.25],mode:1 as const}]],events:[{id:'threshold',time:Math.LN2,bracketWidth:1e-9,before:[.5],after:[terminal?.5:1],modeBefore:0,modeAfter:terminal?0:1,terminal}],stats:{acceptedSteps:terminal?1:2,rejectedSteps:0,attempts:terminal?1:2,rhsEvaluations:60,eventIterations:24,largestAcceptedNormalizedError:.2,finalTime:end}};}

test('rate roles reject cyclic Hz and arbitrary code instead of silently interpreting physical dimensions',()=>{
  const input=decay();assert.equal(validateDynamicsRequest(input).model.id,'decay');
  assert.throws(()=>validateDynamicsRequest({...input,model:{...input.model,rate:{value:1,unit:'Hz'}}}));
  assert.throws(()=>validateDynamicsRequest({...input,model:{...input.model,rate:{value:1,per:'s',role:'angular-frequency'}}}));
  assert.throws(()=>validateDynamicsRequest({...input,model:{...input.model,rhs:'return eval(source)'}}));
  assert.throws(()=>validateDynamicsRequest({...input,model:{id:'user-code',source:'arbitrary'}}));
});
test('time denominator and interval/step units normalize through the existing catalog',()=>{
  const seconds=decay(),milliseconds=structuredClone(seconds);milliseconds.interval={start:0,end:Math.LN2*1000,unit:'ms'};
  if(milliseconds.model.id==='decay')milliseconds.model.rate={value:.001,per:'ms',role:'decay-rate'};
  for(const key of ['initialStep','minStep','maxStep','eventTimeTolerance'] as const)milliseconds.solver[key]*=1000;
  const a=normalizeDynamicsRequest(seconds),b=normalizeDynamicsRequest(milliseconds);assert.deepEqual(b.model,a.model);assert.equal(b.interval.end,a.interval.end);assert.equal(b.solver.initialStep,a.solver.initialStep);assert.equal(b.solver.maxStep,a.solver.maxStep);
});
test('oscillator angular frequency remains rad/s without a hidden 2pi cyclic conversion; heterogeneous atol units convert independently',()=>{
  const request:DynamicsRequest={...decay(),model:{id:'oscillator',position:{value:100,unit:'cm'},velocity:{value:0,unit:'m/s'},damping:{value:.001,per:'ms',role:'decay-rate'},angularFrequency:{value:Math.SQRT2,per:'s',role:'angular-frequency'}},solver:createDefaultDynamicsSolver([{value:.001,unit:'cm'},{value:1e-6,unit:'m/s'}])};
  const n=normalizeDynamicsRequest(request);assert.deepEqual(n.model.initial,[1,0]);assert.deepEqual(n.model.parameters,[1,Math.SQRT2]);assert.deepEqual(n.model.stateUnits,['m','m/s']);assert.equal(n.solver.atol[0],.00001);
  assert.throws(()=>normalizeDynamicsRequest({...request,solver:{...request.solver,atol:[{value:1e-9,unit:'m'},{value:1e-9,unit:'m'}]}}));
});
test('reaction concentrations and absolute tolerances normalize matching components without implicit volume assumptions',()=>{
  const request:DynamicsRequest={...decay(),model:{id:'reaction-chain',initial:[{value:1000,unit:'mmol/L'},{value:0,unit:'umol/L'},{value:0,unit:'mol/L'}],rates:[{value:1,per:'s',role:'decay-rate'},{value:2,per:'s',role:'decay-rate'}]},solver:createDefaultDynamicsSolver([{value:.001,unit:'mmol/L'},{value:1,unit:'umol/L'},{value:1e-6,unit:'mol/L'}])};const n=normalizeDynamicsRequest(request);assert.deepEqual(n.model.initial,[1,0,0]);assert.deepEqual(n.model.stateUnits,['mol/L','mol/L','mol/L']);assert.deepEqual(n.solver.atol,[.000001,.000001,.000001]);
  assert.throws(()=>normalizeDynamicsRequest({...request,model:{...request.model,initial:[{value:1,unit:'mol'},{value:0,unit:'mol/L'},{value:0,unit:'mol/L'}]}}));
});
test('negative domains, incompatible thresholds, malformed tolerances and unbounded resources reject before integration',()=>{
  const input=decay();for(const value of [{...input,model:{...input.model,initial:{value:-1,unit:'1'}}},{...input,model:{...input.model,rate:{value:-1,per:'s',role:'decay-rate'}}},{...input,interval:{start:1,end:1,unit:'s'}},{...input,solver:{...input.solver,minStep:1,maxStep:.01}},{...input,solver:{...input.solver,atol:[]}},{...input,solver:{...input.solver,maxAcceptedSteps:4097}},{...input,solver:{...input.solver,maxRhsEvaluations:100001}},{...input,solver:{...input.solver,rtol:NaN}}])assert.throws(()=>validateDynamicsRequest(value));
  const hybrid=threshold();assert.throws(()=>validateDynamicsRequest({...hybrid,model:{...hybrid.model,event:{threshold:{value:.5,unit:'mol'},reset:{value:1,unit:'1'},rateAfter:{value:2,per:'s',role:'decay-rate'},direction:'falling',terminal:false}}}));
});
test('result contract binds the exact original request, units and finite initial/final sample identities',()=>{
  const request=decay(),result=completed(request);assert.equal(validateDynamicsResult(result,request).status,'completed');assert.notEqual(result.request,request);
  const mutations:Array<(out:DynamicsResult)=>void>=[out=>{out.request.interval.end+=1;},out=>{out.stats.finalTime=0;},out=>{out.stateUnits=['mol'];},out=>{out.samples[0].state=[3];},out=>{out.samples[1].state=[Infinity];},out=>{out.samples[1].state=[-1];},out=>{out.samples[1].state=[2,3];},out=>{out.samples[1].time=-1;}];
  for(const mutate of mutations){const copy=structuredClone(result);mutate(copy);assert.throws(()=>validateDynamicsResult(copy,request));}
});
test('incomplete prefixes may contain one interrupted attempt and never claim completed final time',()=>{
  const request=decay(),out=completed(request);out.status='limit-reached';out.samples=out.samples.slice(0,1);out.stats={...out.stats,acceptedSteps:0,attempts:1,rhsEvaluations:1,finalTime:0};assert.equal(validateDynamicsResult(out,request).status,'limit-reached');
  assert.throws(()=>validateDynamicsResult({...out,stats:{...out.stats,attempts:2}},request));assert.throws(()=>validateDynamicsResult({...out,status:'completed'},request));assert.throws(()=>validateDynamicsResult({...out,stats:{...out.stats,rhsEvaluations:request.solver.maxRhsEvaluations+1}},request));
});
test('one-shot reset event preserves pre/post state and mode order; terminal policy stops before reset',()=>{
  for(const terminal of [false,true]){const out=eventResult(terminal);assert.equal(validateDynamicsResult(out,out.request).status,terminal?'terminal-event':'completed');}
  const valid=eventResult();const mutate:Array<(out:DynamicsResult)=>void>=[out=>{out.events[0].before=[.4];},out=>{out.events[0].after=[2];},out=>{out.samples.splice(2,1);},out=>{out.samples[0].mode=1;},out=>{out.samples[out.samples.length-1].mode=0;},out=>{out.events[0].bracketWidth=1;},out=>{out.samples[2].state=[2];}];for(const change of mutate){const copy=structuredClone(valid);change(copy);assert.throws(()=>validateDynamicsResult(copy,valid.request));}
  const terminal=eventResult(true);terminal.events[0].modeAfter=1;assert.throws(()=>validateDynamicsResult(terminal,terminal.request));
});
