import type { CustomWidgetSpec } from '../../shared/custom-widget';
import type { Expression } from '../../shared/widget-primitives';

const n=(value:number):Expression=>({op:'number',value});
const v=(name:string):Expression=>({op:'variable',name});
const add=(left:Expression,right:Expression):Expression=>({op:'add',left,right});
const mul=(left:Expression,right:Expression):Expression=>({op:'mul',left,right});
export function createCustomWidgetPreset(): CustomWidgetSpec {
  return {
    kind:'custom',runtimeVersion:1,purpose:'Explore a synthetic two-register damped oscillator.',
    catalogGap:'The standard forms do not expose this coupled position/velocity recurrence together with a moving physical schematic.',
    mapping:'Authored synthetic teaching model. Simultaneous Euler updates illustrate a damped oscillator; this is not an implementation or reproduction of an arbitrary cited paper.',
    parameters:[
      {name:'dt',value:0.1,min:0.01,max:0.2,step:0.01,unit:'scalar',definition:'Dimensionless time increment.'},
      {name:'damping',value:0.95,min:0.5,max:1,step:0.01,unit:'scalar',definition:'Velocity retention in this synthetic recurrence.'},
      {name:'stiffness',value:1,min:0.1,max:2,step:0.1,unit:'scalar',definition:'Dimensionless restoring-force coefficient.'},
    ],
    registers:[
      {name:'position',definition:'Synthetic displacement.',initial:n(1),update:add(v('position'),mul(v('dt'),v('velocity')))},
      {name:'velocity',definition:'Synthetic velocity.',initial:n(0),update:{op:'sub',left:mul(v('damping'),v('velocity')),right:mul(mul(v('dt'),v('stiffness')),v('position'))}},
    ],steps:60,
    metrics:[{name:'displacement',label:'Position',unit:'dimensionless',expression:v('position')},{name:'speed',label:'Velocity',unit:'dimensionless',expression:v('velocity')}],
    plot:{label:'Synthetic position over recorded time',xLabel:'Dimensionless time',yLabel:'Position',x:mul(v('step'),v('dt')),y:v('position')},
    marks:[
      {id:'rest',label:'Rest position',shape:'line',paint:'ink',x:n(300),y:n(40),x2:n(300),y2:n(270)},
      {id:'spring',label:'Restoring connection',shape:'line',paint:'olive',x:n(60),y:n(150),x2:add(n(300),mul(n(100),v('position'))),y2:n(150)},
      {id:'mass',label:'Synthetic moving mass',shape:'circle',paint:'accent',x:add(n(300),mul(n(100),v('position'))),y:n(150),radius:n(20)},
    ],
  };
}
