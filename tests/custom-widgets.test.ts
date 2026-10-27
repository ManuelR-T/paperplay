import { customSceneBounds } from '../lib/widgets/custom-scene-bounds';
import test from 'node:test';
import assert from 'node:assert/strict';
import { customWidgetRuntime } from '../lib/widgets/custom-runtime';
import { createCustomWidgetPreset } from '../lib/widgets/custom-preset';
import { getWidgetDesignCapabilities } from '../lib/widgets/design-capabilities';
import { validateWidgetSpec } from '../shared/widgets';
import { compileEnrichmentPlan } from '../lib/enrichment/contracts';
import { buildSourceSections } from '../lib/enrichment/sections';
import { getWidgetDescriptor, WIDGET_CATALOG_VERSION } from '../lib/widgets/catalog';
import { preparedPapers } from '../data/papers';
import { createWidgetForSource } from '../lib/widgets/presets';
import { emptyEnrichmentState, parseEnrichmentState, serializeEnrichmentState } from '../lib/enrichment/state';
import { encodeWidgetSnapshot, decodeWidgetSnapshot } from '../lib/widgets/compatibility';
import { readFileSync } from 'node:fs';

test('a new state model uses simultaneous previous-state updates and scene/metrics from the same frame',()=>{
  const spec=createCustomWidgetPreset();spec.steps=2;
  const run=customWidgetRuntime.execute(spec);
  const at=(step:number,name:string)=>run.frames[step].values.find(v=>v.name===name)!.value;
  assert.equal(at(0,'displacement'),1);assert.equal(at(0,'speed'),0);
  assert.equal(at(1,'displacement'),1);assert.equal(at(1,'speed'),-0.1);
  assert.ok(Math.abs(at(2,'displacement')-.99)<1e-12);
  assert.ok(Math.abs(at(2,'speed')-(-.195))<1e-12);
  assert.equal(run.frames[2].marks.find(m=>m.id==='mass')!.x,399);
  assert.equal(run.points[2].x,.2);assert.equal(run.points[2].y,at(2,'displacement'));
});

test('custom programs reject unknown code/operators/runtime, invalid symbols, conflicting names and excessive budgets',()=>{
  const spec=createCustomWidgetPreset();
  assert.throws(()=>validateWidgetSpec({...spec,runtimeVersion:2}));
  assert.throws(()=>validateWidgetSpec({...spec,code:'fetch(document.cookie)'}));
  assert.throws(()=>validateWidgetSpec({...spec,registers:[{...spec.registers[0],initial:{op:'variable',name:'position'}}]}),/unavailable/);
  assert.throws(()=>validateWidgetSpec({...spec,registers:[{...spec.registers[0],update:{op:'eval',code:'process.env'}}]}));
  assert.throws(()=>validateWidgetSpec({...spec,parameters:[...spec.parameters,{...spec.parameters[0],name:'step'}]}),/unique/);
  assert.throws(()=>validateWidgetSpec({...spec,marks:[{...spec.marks[0],shape:'iframe',src:'https://example.com'}]}));
  assert.throws(()=>validateWidgetSpec({...spec,steps:121}));
  const deep=structuredClone(spec);deep.steps=120;
  let expr=deep.metrics[0].expression;
  for(let i=0;i<9;i++)expr={op:'add',left:expr,right:{op:'number',value:1}};
  deep.marks=Array.from({length:24},(_,i)=>({id:`mark${i}`,label:'Bounded mark',paint:'ink',shape:'rect',x:expr,y:expr,width:expr,height:expr}));
  assert.throws(()=>validateWidgetSpec(deep),/budget/);
});

test('failed custom numerical domains and negative geometry do not produce an activated result',()=>{
  const spec=createCustomWidgetPreset();
  spec.metrics[0].expression={op:'div',left:{op:'number',value:1},right:{op:'number',value:0}};
  assert.throws(()=>customWidgetRuntime.execute(spec),/zero/);
  const negative=createCustomWidgetPreset();negative.marks=[{id:'bad',label:'Invalid radius',paint:'ink',shape:'circle',x:{op:'number',value:0},y:{op:'number',value:0},radius:{op:'number',value:-1}}];
  assert.throws(()=>customWidgetRuntime.execute(negative),/nonnegative/);
  const huge=createCustomWidgetPreset();huge.marks=[{id:'huge',label:'Oversized mark',paint:'ink',shape:'circle',x:{op:'number',value:0},y:{op:'number',value:0},radius:{op:'number',value:5000}}];
  assert.throws(()=>customWidgetRuntime.execute(huge),/canvas allowance/);
});

test('the frozen real Meta design matches an independently written scalar momentum recurrence',()=>{
  const record=JSON.parse(readFileSync(new URL('../docs/custom-design-live-check.json',import.meta.url),'utf8'));
  const spec=record.proposals[0].spec;
  assert.equal(record.status,'complete');assert.equal(spec.kind,'custom');
  for(const setting of [{alpha:.1,beta:.9,lambda:1,b:0},{alpha:.2,beta:.4,lambda:1.8,b:-.5},{alpha:.05,beta:.8,lambda:.5,b:.2}]){
    const candidate={...spec,parameters:spec.parameters.map((p:{name:string;value:number})=>({...p,value:setting[p.name as keyof typeof setting]}))};
    const run=customWidgetRuntime.execute(candidate);const bounds=customSceneBounds(run.frames);let w=1,z=0;
    for(const frame of run.frames){
      const actualW=frame.values.find(v=>v.name==='wPos')!.value,actualZ=frame.values.find(v=>v.name==='zMom')!.value;
      assert.ok(Math.abs(actualW-w)<1e-10);assert.ok(Math.abs(actualZ-z)<1e-10);
      for(const mark of frame.marks)assert.ok(mark.x>=bounds.x&&mark.y>=bounds.y&&mark.x<=bounds.x+bounds.width&&mark.y<=bounds.y+bounds.height);
      const nextZ=setting.beta*z+setting.lambda*w-setting.b;
      w=w-setting.alpha*nextZ;z=nextZ;
    }
  }
});

test('a trusted custom-review hook rejects one proposal while preserving valid grounded alternatives',()=>{
  const source=preparedPapers[2].document;
  const block=source.blocks.find(b=>b.kind==='paragraph')!;
  const quote=('text' in block?block.text:'').slice(0,200);
  const section=buildSourceSections(source).find(s=>s.segments.some(v=>v.blockId===block.id))!;
  const proposal=(id:string,spec:unknown,kind:'custom'|'diagram')=>({id,title:'A proposed teaching view',concept:'A selected source concept',blockId:block.id,page:block.page,quote,reason:'A source-linked teaching model.',objective:'Inspect the explicit example.',neededData:['Synthetic inputs'],provenance:'synthetic',interactions:[...getWidgetDescriptor(kind).controls],specJson:JSON.stringify(spec),limitations:[]});
  const input={summary:'Review candidates',proposals:[proposal('new-model',createCustomWidgetPreset(),'custom'),proposal('fallback',createWidgetForSource('diagram',source,block.id).spec,'diagram')],warnings:[],repetitionReason:''};
  let reviews=0;
  const result=compileEnrichmentPlan(input,{source,section,action:'plan',model:'fixture',catalogVersion:WIDGET_CATALOG_VERSION,allowedInteractions:k=>getWidgetDescriptor(k).controls,reviewCustom:(candidate,context)=>{reviews++;assert.equal(context.quote,quote);assert.equal(candidate.kind,'custom');assert.ok(Object.isFrozen(candidate.registers));assert.ok(Object.isFrozen(context.source.blocks));throw Error('Operator policy requires an additional model review.');}});
  assert.equal(reviews,1);assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].envelope.spec.kind,'diagram');assert.match(result.rejected[0].reason,/Operator policy/);
});

test('capability discovery and portable custom state keep runtime constraints and exact source identity',()=>{
  const capabilities=getWidgetDesignCapabilities();
  assert.equal(capabilities.customRuntime.permissions.generatedCode,false);
  assert.equal(capabilities.customRuntime.permissions.network,false);
  assert.equal(capabilities.customRuntime.limits.operations,80000);
  assert.ok(capabilities.templates.some(t=>t.kind==='custom'));
  const source=preparedPapers[2].document,envelope=createWidgetForSource('custom',source);
  envelope.view.step=17;envelope.view.selection='custom:mass';
  assert.deepEqual(decodeWidgetSnapshot(encodeWidgetSnapshot(envelope),source),envelope);
  const state=emptyEnrichmentState('b'.repeat(64));state.catalogVersion='2.0.0';
  const original=serializeEnrichmentState(state);
  assert.equal(parseEnrichmentState(original,source,state.fingerprint).catalogVersion,'2.1.0');
  assert.equal(JSON.parse(original).catalogVersion,'2.0.0');
  assert.throws(()=>parseEnrichmentState(original.replace('2.0.0','99.0.0'),source,state.fingerprint));
});
