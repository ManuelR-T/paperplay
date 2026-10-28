import {FIELD_SOLVER_VERSION,type FieldRequest,type FieldResult,type FieldStatus,type FieldDiagnostic} from '../../shared/physical-fields';
import {normalizeFieldRequest,fieldTimeAtStep,fieldStability,fieldValueStatistics} from './model';
class Halt extends Error{constructor(readonly status:FieldStatus,readonly code:FieldDiagnostic['code'],readonly detail:string){super(detail);}}
/** Constant thermal diffusion only. JSON selects data/boundaries, never an imported PDE/RHS. */
export function solveField(raw:FieldRequest,options:{signal?:AbortSignal;now?:()=>number}={}):FieldResult{
 const normalized=normalizeFieldRequest(raw),{request,grid,initial,coefficient,interval,solver,targetSteps}=normalized,declared=fieldStability(normalized),now=options.now??Date.now,started=now();
 const cells=grid.nx*grid.ny,initialStats=fieldValueStatistics(initial),snapshots:FieldResult['snapshots']=[],diagnostics:FieldResult['diagnostics']=[];
 let current=[...initial],next=Array<number>(cells).fill(0),time=interval.start,status:FieldStatus='completed',snapshotIndex=1;
 // stabilityNumber describes the declared full dt; every actual rounded step is checked separately.
 const stats:FieldResult['stats']={steps:0,cellUpdates:0,finalTime:time,stabilityNumber:declared.number,stabilityLimit:declared.limit,initialMean:initialStats.mean,maxMeanDrift:0,maxPrincipleViolation:0};
 function check(){if(options.signal?.aborted)throw new Halt('cancelled','cancelled','Field integration stopped; retained snapshots remain available.');if(now()-started>=solver.maxWallMs)throw new Halt('limit-reached','deadline','The field integration wall-clock budget was reached.');}
 function snapshot(step:number){const values=[...current],measured=fieldValueStatistics(values);snapshots.push({step,time,values,...measured,meanDrift:measured.mean-initialStats.mean});}
 snapshot(0);
 try{
  check();if(declared.number>.5)throw new Halt('unstable','unstable','The declared explicit diffusion step exceeds the supported Fourier-number bound of one half.');
  for(let step=1;step<=targetSteps;step++){
   check();if(stats.steps>=solver.maxSteps)throw new Halt('limit-reached','step-limit','The field step budget was reached before the requested final time.');
   if(stats.cellUpdates+cells>solver.maxCellUpdates)throw new Halt('limit-reached','work-limit','The cell-update budget was reached before another complete step.');
   const target=fieldTimeAtStep(normalized,step),h=target-time,desired=Math.min(solver.dt,interval.end-time);
   // Allow ordinary elapsed-grid roundoff, excluding the absolute time origin:
   // a huge origin must not turn dt=1.5 into an undisclosed actual step of 2.
   const clockMargin=32*Number.EPSILON*Math.max(Math.abs(desired),Math.abs(time-interval.start),Math.abs(target-interval.start));
   if(!(h>0)||!Number.isFinite(h)||h>desired+clockMargin)throw new Halt('time-not-advancing','time-not-advancing','The declared time grid cannot advance within its step at this time origin; rescale time explicitly.');
   const actual=fieldStability(normalized,h),roundoff=32*Number.EPSILON*Math.max(1,actual.number);
   if(actual.number>.5+roundoff)throw new Halt('unstable','unstable','The actual rounded step exceeds the supported diffusion stability bound.');
   const rx=coefficient===0?0:coefficient/grid.dx/grid.dx*h,ry=grid.dimension===2&&coefficient!==0?coefficient/grid.dy/grid.dy*h:0;
   for(let row=0;row<grid.ny;row++)for(let column=0;column<grid.nx;column++){
    check();const index=row*grid.nx+column,center=current[index];
    const left=column>0?index-1:grid.boundary==='periodic'?row*grid.nx+grid.nx-1:index,right=column<grid.nx-1?index+1:grid.boundary==='periodic'?row*grid.nx:index;
    // Scale each face difference separately: no overflowing 2*T intermediate.
    let value=center+rx*(current[left]-center)+rx*(current[right]-center);
    if(grid.dimension===2){const below=row>0?index-grid.nx:(grid.ny-1)*grid.nx+column,above=row<grid.ny-1?index+grid.nx:column;value+=ry*(current[below]-center)+ry*(current[above]-center);}
    stats.cellUpdates++;
    if(!Number.isFinite(value))throw new Halt('nonfinite','nonfinite','A numerical field update exceeded finite representable values.');
    if(value<0)throw new Halt('invalid-domain','invalid-domain','A numerical update left the nonnegative absolute-Kelvin domain; no values were clipped.');
    next[index]=value;
   }
   const measured=fieldValueStatistics(next),meanDrift=Math.abs(measured.mean-initialStats.mean),violation=Math.max(0,initialStats.minimum-measured.minimum,measured.maximum-initialStats.maximum);
   const invariantAllowance=256*Number.EPSILON*Math.max(1,initialStats.maximum)*step;
   if(violation>invariantAllowance)throw new Halt('invalid-domain','maximum-principle','The computed step exceeded its declared initial temperature range beyond rounding allowance.');
   if(meanDrift>invariantAllowance)throw new Halt('invalid-domain','conservation','The computed step lost mean-temperature conservation beyond its rounding allowance.');
   [current,next]=[next,current];time=target;stats.steps++;stats.maxMeanDrift=Math.max(stats.maxMeanDrift,meanDrift);stats.maxPrincipleViolation=Math.max(stats.maxPrincipleViolation,violation);
   if(solver.snapshotSteps[snapshotIndex]===step){snapshot(step);snapshotIndex++;}
  }
 }catch(error){if(error instanceof Halt){status=error.status;diagnostics.push({code:error.code,message:error.detail});}else throw error;}
 stats.finalTime=time;return {format:'paperplay-field-result',schemaVersion:1,solverVersion:FIELD_SOLVER_VERSION,request,status,grid,timeUnit:'s',valueUnit:'K',valueMeaning:'cell-averages',snapshots,stats,diagnostics};
}
