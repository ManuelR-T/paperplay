import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultFieldSolver,type FieldRequest} from '../shared/physical-fields';
import {validateFieldResult} from '../lib/fields/model';
import {solveField} from '../lib/fields/solver';
function fixture(nx=4,end=1,dt=.25):FieldRequest{return {format:'paperplay-physical-field',schemaVersion:1,model:'temperature-diffusion',grid:{dimension:1,nx,ny:1,origin:[{value:0,unit:'m'}],extent:[{value:nx,unit:'m'}],boundary:'periodic'},coefficient:{value:1,lengthUnit:'m',timeUnit:'s',role:'thermal-diffusivity'},initial:{kind:'cosine',mean:{value:300,unit:'K',temperatureMode:'absolute'},amplitude:{value:10,unit:'K',temperatureMode:'difference'}},interval:{start:0,end,unit:'s'},solver:createDefaultFieldSolver(dt,[0,Math.round(end/dt)])};}
const run=(request:FieldRequest,options:Parameters<typeof solveField>[1]={})=>validateFieldResult(solveField(request,options),request);
const last=(result:ReturnType<typeof run>)=>result.snapshots.at(-1)!.values;
const sinc=(value:number)=>Math.sin(value)/value;
test('periodic and zero-flux four-cell updates match independent exact rational vectors',()=>{
 const periodic=fixture(4,.25,.25);periodic.initial={kind:'cell-averages',values:[0,1,0,0],unit:'K',temperatureMode:'absolute'};assert.deepEqual(last(run(periodic)),[.25,.5,.25,0]);
 const edge=fixture(4,.25,.25);edge.initial={kind:'cell-averages',values:[1,0,0,0],unit:'K',temperatureMode:'absolute'};assert.deepEqual(last(run(edge)),[.5,.25,0,.25]);edge.grid.boundary='no-flux';assert.deepEqual(last(run(edge)),[.75,.25,0,0]);
});
test('constant temperature and zero diffusivity preserve declared cell averages',()=>{
 const constant=fixture();constant.initial={kind:'constant',temperature:{value:50,unit:'degC',temperatureMode:'absolute'}};assert.deepEqual(last(run(constant)),Array(4).fill(323.15));
 const zero=fixture();zero.coefficient.value=0;const result=run(zero);assert.deepEqual(last(result),result.snapshots[0].values);assert.equal(result.stats.stabilityNumber,0);assert.equal(result.stats.stabilityLimit,null);
});
test('periodic cell-average Fourier mode follows independent discrete amplification, with sinc initialization',()=>{
 const request=fixture(16,.001,.0001);request.grid.extent=[{value:1,unit:'m'}];request.coefficient.value=.1;request.solver.snapshotSteps=[0,5,10];const result=run(request),dx=1/16,rx=.1*.0001/dx**2,g=1-4*rx*Math.sin(Math.PI/16)**2;
 assert.equal(result.status,'completed');result.snapshots.forEach(snapshot=>snapshot.values.forEach((value,i)=>{const expected=300+10*sinc(Math.PI/16)*Math.cos(2*Math.PI*(i+.5)/16)*g**snapshot.step;assert.ok(Math.abs(value-expected)<1e-11);}));
 assert.ok(Math.abs(result.snapshots[0].values[0]-(300+10*Math.cos(2*Math.PI*.5/16)))>1e-3,'cell averages must not be mislabeled center-point samples');
});
test('no-flux cosine uses its distinct edge stencil and Neumann eigenmode',()=>{
 const request=fixture(16,.001,.0001);request.grid.extent=[{value:1,unit:'m'}];request.grid.boundary='no-flux';request.coefficient.value=.1;const result=run(request),g=1-4*(.1*.0001/(1/16)**2)*Math.sin(Math.PI/32)**2;
 last(result).forEach((value,i)=>assert.ok(Math.abs(value-(300+10*sinc(Math.PI/32)*Math.cos(Math.PI*(i+.5)/16)*g**10))<1e-11));
});
test('unequal 2D axes preserve row-major shape and independent tensor-mode amplification',()=>{
 const request=fixture(8,.0005,.0001);request.grid={dimension:2,nx:8,ny:12,origin:[{value:0,unit:'m'},{value:0,unit:'m'}],extent:[{value:2,unit:'m'},{value:1.5,unit:'m'}],boundary:'periodic'};request.coefficient.value=.1;const result=run(request),rx=.1*.0001/.25**2,ry=.1*.0001/.125**2,g=1-4*rx*Math.sin(Math.PI/8)**2-4*ry*Math.sin(Math.PI/12)**2;
 assert.deepEqual(result.grid.shape,[12,8]);last(result).forEach((value,index)=>{const i=index%8,j=Math.floor(index/8),expected=300+10*sinc(Math.PI/8)*sinc(Math.PI/12)*Math.cos(2*Math.PI*(i+.5)/8)*Math.cos(2*Math.PI*(j+.5)/12)*g**5;assert.ok(Math.abs(value-expected)<1e-11);});
});
test('accepted snapshots conserve mean temperature and obey the maximum principle without clipping',()=>{
 const request=fixture(16,1,.01);request.solver.snapshotSteps=[0,1,25,50,75,100];const result=run(request),initial=result.snapshots[0];assert.equal(result.status,'completed');for(const snapshot of result.snapshots){assert.ok(Math.abs(snapshot.values.reduce((a,b)=>a+b,0)/16-initial.mean)<1e-11);assert.ok(snapshot.values.every(value=>value>=initial.minimum-1e-12&&value<=initial.maximum+1e-12));}assert.ok(result.stats.maxMeanDrift<1e-11);assert.equal(result.stats.maxPrincipleViolation,0);
});
test('Euler time convergence and spatial convergence use independent semi-discrete/continuum oracles',()=>{
 const timeError=(dt:number)=>{const request=fixture(8,.125,dt);request.grid.extent=[{value:1,unit:'m'}];request.coefficient.value=.1;const result=run(request),lambda=-4*.1/(1/8)**2*Math.sin(Math.PI/8)**2;return Math.max(...last(result).map((value,i)=>Math.abs(value-(300+10*sinc(Math.PI/8)*Math.cos(2*Math.PI*(i+.5)/8)*Math.exp(lambda*.125)))));};
 const ratio=timeError(1/128)/timeError(1/256);assert.ok(ratio>1.9&&ratio<2.1);
 const spaceError=(nx:number)=>{const dt=1/65536,end=1/64,request=fixture(nx,end,dt);request.grid.extent=[{value:1,unit:'m'}];request.coefficient.value=.1;const result=run(request);assert.equal(result.status,'completed');return Math.max(...last(result).map((value,i)=>Math.abs(value-(300+10*sinc(Math.PI/nx)*Math.cos(2*Math.PI*(i+.5)/nx)*Math.exp(-.1*(2*Math.PI)**2*end)))));};
 const spatialRatio=spaceError(16)/spaceError(32);assert.ok(spatialRatio>3.7&&spatialRatio<4.5);
});
test('snapshot presentation never changes integration, and final remainders/decimal schedules reach exact end',()=>{
 const request=fixture(4,.07,.01);request.solver.snapshotSteps=[0,7];const result=run(request);assert.equal(result.status,'completed');assert.equal(result.stats.steps,7);assert.equal(result.stats.finalTime,.07);
 const extra=structuredClone(request);extra.solver.snapshotSteps=[0,1,2,3,4,5,6,7];assert.deepEqual(last(run(extra)),last(result));
 const remainder=fixture(4,.035,.01);remainder.solver.snapshotSteps=[0,1,4];const stopped=run(remainder);assert.equal(stopped.status,'completed');assert.equal(stopped.stats.steps,4);assert.equal(stopped.stats.finalTime,.035);
 const g=1-4*.01*Math.sin(Math.PI/4)**2,tail=1-4*.005*Math.sin(Math.PI/4)**2;last(stopped).forEach((value,i)=>assert.ok(Math.abs(value-(300+10*sinc(Math.PI/4)*Math.cos(2*Math.PI*(i+.5)/4)*g**3*tail))<1e-11));
});
test('explicit unstable settings reject before updates; work/steps/cancel/deadline keep legal prefixes',()=>{
 const unstable=fixture(4,1,.51);unstable.solver.snapshotSteps=[0,2];const rejected=run(unstable);assert.equal(rejected.status,'unstable');assert.equal(rejected.stats.steps,0);assert.equal(rejected.stats.cellUpdates,0);
 const work=fixture();work.solver.maxCellUpdates=5;const limited=run(work);assert.equal(limited.status,'limit-reached');assert.equal(limited.stats.steps,1);assert.equal(limited.stats.cellUpdates,4);assert.equal(limited.stats.finalTime,.25);assert.equal(limited.snapshots.at(-1)!.time,0);
 const step=fixture();step.solver.maxSteps=1;assert.ok(run(step).diagnostics.some(value=>value.code==='step-limit'));
 const controller=new AbortController();controller.abort();assert.equal(run(fixture(),{signal:controller.signal}).status,'cancelled');let clock=0;assert.ok(run(fixture(),{now:()=>clock++*1000}).diagnostics.some(value=>value.code==='deadline'));
});
test('domains, unsupported boundaries/units and excessive retained grids fail before field updates',()=>{
 const negative=fixture();negative.initial={kind:'constant',temperature:{value:-1,unit:'K',temperatureMode:'absolute'}};assert.throws(()=>solveField(negative));assert.throws(()=>solveField({...fixture(),rhs:'imported PDE'} as unknown as FieldRequest));
 const excessive=fixture(64,8,1);excessive.coefficient.value=0;excessive.grid={dimension:2,nx:64,ny:64,origin:[{value:0,unit:'m'},{value:0,unit:'m'}],extent:[{value:1,unit:'m'},{value:1,unit:'m'}],boundary:'periodic'};excessive.solver.snapshotSteps=[0,1,2,3,4,5,6,7,8];assert.throws(()=>solveField(excessive));
 const large=fixture(4,3,1.5);large.interval.start=1e16;large.interval.end=1e16+4;large.coefficient.value=0;large.solver.snapshotSteps=[0,3];const result=run(large);assert.equal(result.status,'time-not-advancing');assert.equal(result.stats.steps,0);
});
test('long fixed-step grids validate without mistaking elapsed clock roundoff for changed declared stability',()=>{
 const request=fixture(4,1,.0001);const result=run(request);assert.equal(result.status,'completed');assert.equal(result.stats.steps,10000);assert.equal(result.stats.finalTime,1);assert.equal(result.stats.stabilityNumber,.0001);assert.ok(result.stats.maxMeanDrift<1e-9);
});
