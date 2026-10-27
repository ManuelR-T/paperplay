import { CUSTOM_LIMITS, CUSTOM_RUNTIME_VERSION, validateCustomWidget, type CustomWidgetSpec } from '../../shared/custom-widget';
import type { Expression } from '../../shared/widget-primitives';

export type EvaluatedMark = { id: string; label: string; paint: 'ink'|'accent'|'olive'; shape: 'circle'|'rect'|'line'|'text'|'label'|'arrow'|'ellipse'; x: number; y: number; radius?: number; width?: number; height?: number; x2?: number; y2?: number; value?: number; opacity?: number };
export type CustomFrame = { step: number; values: { name: string; label: string; value: number; unit: string }[]; marks: EvaluatedMark[] };

function execute(input: unknown) {
  const spec = validateCustomWidget(input);
  let operations = 0;
  function evaluate(e: Expression, scope: Map<string, number>): number {
    if (++operations > CUSTOM_LIMITS.operations) throw Error('Custom execution exceeded its operation allowance.');
    let value: number;
    if (e.op==='number') value=e.value;
    else if (e.op==='variable') { if(!scope.has(e.name))throw Error(`Missing custom symbol ${e.name}.`); value=scope.get(e.name)!; }
    else if (e.op==='dot') { if(e.left.length!==e.right.length)throw Error('Custom dot-product lengths differ.'); value=e.left.reduce((sum,v,i)=>sum+evaluate(v,scope)*evaluate(e.right[i],scope),0); }
    else if ('left' in e) {
      const a=evaluate(e.left,scope), b=evaluate(e.right,scope);
      if(e.op==='div'&&b===0)throw Error('Custom model divided by zero.');
      value=e.op==='add'?a+b:e.op==='sub'?a-b:e.op==='mul'?a*b:e.op==='div'?a/b:Math.pow(a,b);
    } else {
      const a=evaluate(e.arg,scope);
      value=e.op==='neg'?-a:e.op==='abs'?Math.abs(a):e.op==='sqrt'?Math.sqrt(a):e.op==='sin'?Math.sin(a):e.op==='cos'?Math.cos(a):e.op==='exp'?Math.exp(a):Math.log(a);
    }
    if(!Number.isFinite(value)||Math.abs(value)>1e9)throw Error('Custom model left its finite numerical domain (absolute limit 1e9).');
    return value;
  }
  const parameters=new Map(spec.parameters.map(p=>[p.name,p.value]));
  let registers=new Map(spec.registers.map(r=>[r.name,evaluate(r.initial,parameters)]));
  const frames: CustomFrame[]=[], points: {x:number;y:number}[]=[];
  for(let step=0;step<=spec.steps;step++) {
    const scope=new Map([...parameters,...registers,['step',step] as [string,number]]);
    const values=spec.metrics.map(m=>({name:m.name,label:m.label,unit:m.unit,value:evaluate(m.expression,scope)}));
    const outputs=new Map([...scope,...values.map(v=>[v.name,v.value] as [string,number])]);
    const marks=spec.marks.map(mark=>{
      const evaluated: Record<string,unknown>={};
      for(const [key,value]of Object.entries(mark))evaluated[key]=value&&typeof value==='object'?evaluate(value as Expression,outputs):value;
      if(['radius','width','height'].some(k=>typeof evaluated[k]==='number'&&(evaluated[k] as number)<0))throw Error('Custom visual sizes must be nonnegative.');
      if(typeof evaluated.opacity==='number'&&(evaluated.opacity<0||evaluated.opacity>1))throw Error('Custom opacity must be between 0 and 1.');
      if(['x','y','x2','y2'].some(k=>typeof evaluated[k]==='number'&&Math.abs(evaluated[k] as number)>10000)||['radius','width','height'].some(k=>typeof evaluated[k]==='number'&&(evaluated[k] as number)>2000))throw Error('Custom visual geometry exceeds its bounded canvas allowance.');
      return evaluated as EvaluatedMark;
    });
    frames.push({step,values,marks});
    if(spec.plot)points.push({x:evaluate(spec.plot.x,outputs),y:evaluate(spec.plot.y,outputs)});
    // Simultaneous recurrence: all updates see the previous state and previous step.
    if(step<spec.steps)registers=new Map(spec.registers.map(r=>[r.name,evaluate(r.update,scope)]));
  }
  return { frames, points, operations, spec };
}

/** Extension hooks: future runtimes must retain validation, execution and disclosure at this seam. */
export const customWidgetRuntime = Object.freeze({
  version: CUSTOM_RUNTIME_VERSION,
  validate: validateCustomWidget,
  execute,
  describe: (spec: CustomWidgetSpec) => ({ purpose: spec.purpose, gap: spec.catalogGap, recurrence: 'simultaneous previous-state updates', limits: CUSTOM_LIMITS }),
});
