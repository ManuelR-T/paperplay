import { expressionSchema, type Expression, type WidgetSpec } from '../../shared/widgets';
export type Quantity = { value:number; dimensions:[number,number,number] };
const dimensions = { scalar:[0,0,0], length:[1,0,0], time:[0,1,0], mass:[0,0,1] } as const;
const same=(a:Quantity,b:Quantity)=>a.dimensions.every((v,i)=>Math.abs(v-b.dimensions[i])<1e-10);
export function evaluateExpression(input:Expression, variables:Extract<WidgetSpec,{kind:'equation'}>['variables']):Quantity {
 const expression=expressionSchema.parse(input);const vars=new Map(variables.map(v=>[v.name,v]));let terms=0;
 function evaluate(e:Expression):Quantity {
  if(++terms>256)throw Error('Expression evaluation budget exceeded.');
  if(e.op==='number')return {value:e.value,dimensions:[0,0,0]};
  if(e.op==='variable'){const v=vars.get(e.name);if(!v)throw Error(`No definition/value was supplied for ${e.name}.`);return {value:v.value,dimensions:[...dimensions[v.unit]]};}
  if(e.op==='dot'){if(e.left.length!==e.right.length)throw Error('Dot-product dimensions differ.');let sum:Quantity|undefined;for(let i=0;i<e.left.length;i++){const a=evaluate(e.left[i]),b=evaluate(e.right[i]);const q:Quantity={value:a.value*b.value,dimensions:a.dimensions.map((v,j)=>v+b.dimensions[j]) as Quantity['dimensions']};if(sum&&!same(sum,q))throw Error('Dot-product terms have incompatible units.');sum={...q,value:(sum?.value??0)+q.value};}return sum!;}
  if('left'in e){const a=evaluate(e.left),b=evaluate(e.right);let value:number,unit=a.dimensions;
   if(e.op==='add'||e.op==='sub'){if(!same(a,b))throw Error('Addition/subtraction requires matching units.');value=e.op==='add'?a.value+b.value:a.value-b.value;}
   else if(e.op==='mul'||e.op==='div'){if(e.op==='div'&&b.value===0)throw Error('Division by zero is outside the supported domain.');value=e.op==='mul'?a.value*b.value:a.value/b.value;unit=a.dimensions.map((v,i)=>v+(e.op==='mul'?1:-1)*b.dimensions[i]) as Quantity['dimensions'];}
   else {if(b.dimensions.some(v=>v!==0))throw Error('An exponent must be dimensionless.');if(a.dimensions.some(v=>v!==0)&&(!Number.isInteger(b.value)||Math.abs(b.value)>8))throw Error('Unitful powers require an integer exponent between -8 and 8.');value=Math.pow(a.value,b.value);unit=a.dimensions.map(v=>v*b.value) as Quantity['dimensions'];}
   return checked({value,dimensions:unit});
  }
  const a=evaluate(e.arg);let value:number,unit=a.dimensions;
  if(e.op==='neg')value=-a.value;else if(e.op==='abs')value=Math.abs(a.value);else if(e.op==='sqrt'){if(a.value<0)throw Error('Square root requires a nonnegative input.');value=Math.sqrt(a.value);unit=unit.map(v=>v/2) as Quantity['dimensions'];}
  else {if(a.dimensions.some(v=>v!==0))throw Error(`${e.op} requires a dimensionless argument.`);value=e.op==='sin'?Math.sin(a.value):e.op==='cos'?Math.cos(a.value):e.op==='exp'?Math.exp(a.value):Math.log(a.value);}
  return checked({value,dimensions:unit});
 }
 return checked(evaluate(expression));
}
function checked(q:Quantity){if(!Number.isFinite(q.value)||Math.abs(q.value)>1e15)throw Error('The expression is undefined or exceeds its finite result limit.');return q;}
export function formatUnit(d:Quantity['dimensions']) {const names=['m','s','kg'];return d.map((power,i)=>power===0?'':power===1?names[i]:`${names[i]}^${power}`).filter(Boolean).join(' · ')||'dimensionless';}
export function expressionText(e:Expression):string {if(e.op==='number')return String(e.value);if(e.op==='variable')return e.name;if(e.op==='dot')return `dot([${e.left.map(expressionText).join(',')}],[${e.right.map(expressionText).join(',')}])`;if('left'in e)return `(${expressionText(e.left)} ${{add:'+',sub:'−',mul:'×',div:'/',pow:'^'}[e.op]} ${expressionText(e.right)})`;return `${e.op}(${expressionText(e.arg)})`;}
/** Conservative interval arithmetic prevents a plotted segment from spanning a known invalid domain. */
export function expressionIntervalDefined(expression:Expression,variables:Extract<WidgetSpec,{kind:'equation'}>['variables'],xName:string,lo:number,hi:number):boolean {
 type Range=[number,number];let budget=0;const vars=new Map(variables.map(v=>[v.name,v.value]));
 const product=(a:Range,b:Range):Range=>{const p=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return[Math.min(...p),Math.max(...p)];};
 function interval(e:Expression):Range {
  if(++budget>256)throw Error('Interval budget exceeded.');if(e.op==='number')return[e.value,e.value];if(e.op==='variable'){if(e.name===xName)return[lo,hi];const v=vars.get(e.name);if(v===undefined)throw Error('Unknown variable.');return[v,v];}
  if(e.op==='dot'){let sum:Range=[0,0];for(let i=0;i<e.left.length;i++){const p=product(interval(e.left[i]),interval(e.right[i]));sum=[sum[0]+p[0],sum[1]+p[1]];}return sum;}
  if('left'in e){const a=interval(e.left),b=interval(e.right);if(e.op==='add')return[a[0]+b[0],a[1]+b[1]];if(e.op==='sub')return[a[0]-b[1],a[1]-b[0]];if(e.op==='mul')return product(a,b);if(e.op==='div'){if(b[0]<=0&&b[1]>=0)throw Error('Segment denominator may be zero.');return product(a,[1/b[1],1/b[0]]);}
   if(b[0]!==b[1]){if(a[0]<=0)throw Error('Variable powers require positive interval base.');const candidates=[a[0]**b[0],a[0]**b[1],a[1]**b[0],a[1]**b[1],1];return[Math.min(...candidates),Math.max(...candidates)];}
   const exponent=b[0];if(a[0]<0&&!Number.isInteger(exponent)||a[0]<=0&&a[1]>=0&&exponent<0)throw Error('Power domain may be undefined.');const ends=[a[0]**exponent,a[1]**exponent];if(a[0]<=0&&a[1]>=0&&Number.isInteger(exponent)&&exponent>0)ends.push(0);return[Math.min(...ends),Math.max(...ends)];
  }
  const a=interval(e.arg);if(e.op==='neg')return[-a[1],-a[0]];if(e.op==='abs')return[a[0]<=0&&a[1]>=0?0:Math.min(Math.abs(a[0]),Math.abs(a[1])),Math.max(Math.abs(a[0]),Math.abs(a[1]))];if(e.op==='sqrt'){if(a[0]<0)throw Error('Negative square-root domain.');return[Math.sqrt(a[0]),Math.sqrt(a[1])];}if(e.op==='log'){if(a[0]<=0)throw Error('Nonpositive log domain.');return[Math.log(a[0]),Math.log(a[1])];}if(e.op==='exp')return[Math.exp(a[0]),Math.exp(a[1])];
  if(a[1]-a[0]>=2*Math.PI)return[-1,1];const fn=e.op==='sin'?Math.sin:Math.cos,phase=e.op==='sin'?Math.PI/2:0;const values=[fn(a[0]),fn(a[1])];for(let k=Math.ceil((a[0]-phase)/Math.PI);k<=(a[1]-phase)/Math.PI;k++)values.push(fn(phase+k*Math.PI));return[Math.min(...values),Math.max(...values)];
 }
 try{const result=interval(expression);return result.every(Number.isFinite);}catch{return false;}
}
