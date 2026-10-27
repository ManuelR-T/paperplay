import { createCustomWidgetPreset } from './custom-preset';
import type { CustomWidgetSpec } from '../../shared/custom-widget';
import type { Expression } from '../../shared/widget-primitives';
const n=(value:number):Expression=>({op:'number',value});
const v=(name:string):Expression=>({op:'variable',name});
const op=(op:'add'|'mul'|'sub',left:Expression,right:Expression):Expression=>({op,left,right});

/** Executable composition examples, not promises of unsupported engine features. */
export function customDesignRecipes(): {id:string;use:string;spec:CustomWidgetSpec}[] {
  const oscillator=createCustomWidgetPreset();
  oscillator.layout={fit:'content',padding:32};
  oscillator.marks.push({id:'label',shape:'label',label:'Displacement from equilibrium',paint:'ink',x:n(60),y:n(26)},
    {id:'force',shape:'arrow',label:'Restoring direction',paint:'olive',x:op('add',n(300),op('mul',n(100),v('position'))),y:n(210),x2:n(300),y2:n(210)});
  const phasor:CustomWidgetSpec={
    kind:'custom',runtimeVersion:1,purpose:'Explore how two rotating components combine into an oscillating signal.',
    catalogGap:'The catalog has scalar curves but no animated vector-addition scene coupled to a recorded sum.',
    mapping:'Synthetic geometric teaching model. A rotating vector has angle step × frequency; the second adds phase. No source experiment is reproduced.',
    layout:{fit:'content',padding:32},
    parameters:[{name:'frequency',value:.1,min:.01,max:.3,step:.01,unit:'scalar',definition:'Angle increment per frame.'},{name:'phase',value:1,min:-3.14,max:3.14,step:.1,unit:'scalar',definition:'Phase difference in radians.'}],
    registers:[],steps:60,
    metrics:[{name:'sum',label:'Combined vertical component',unit:'scalar',expression:op('add',{op:'sin',arg:op('mul',v('step'),v('frequency'))},{op:'sin',arg:op('add',op('mul',v('step'),v('frequency')),v('phase'))})}],
    plot:{label:'Recorded combined signal',xLabel:'Frame',yLabel:'Vertical sum',x:v('step'),y:v('sum')},
    marks:[{id:'origin',shape:'circle',label:'Shared origin',paint:'ink',x:n(160),y:n(160),radius:n(5)},
      {id:'guide',shape:'ellipse',label:'Unit rotation guide',paint:'accent',x:n(160),y:n(160),width:n(180),height:n(180)},
      ...[0,1].map(index=>{const angle=op('add',op('mul',v('step'),v('frequency')),index?v('phase'):n(0));return{id:`vector${index}`,shape:'arrow' as const,label:`Rotating component ${index+1}`,paint:index?'olive' as const:'ink' as const,x:n(160),y:n(160),x2:op('add',n(160),op('mul',n(90),{op:'cos',arg:angle})),y2:op('sub',n(160),op('mul',n(90),{op:'sin',arg:angle}))};}),
      {id:'caption',shape:'label',label:'Adjust phase to compare reinforcement and cancellation',paint:'ink',x:n(300),y:n(90)},
      {id:'sumValue',shape:'text',label:'Vertical sum',paint:'ink',x:n(300),y:n(210),value:v('sum')}],
  };
  return [{id:'annotated-dynamics',use:'Coupled states, restoring forces, convergence and stability.',spec:oscillator},{id:'phase-composition',use:'Vector addition, phase and constructive/destructive interference.',spec:phasor}];
}
