import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { executeWidget } from '../lib/widgets/worker-client';
import { WIDGET_KINDS, expressionSchema, validateWidgetEnvelope, validateWidgetSpec, widgetEnvelopeSchema, type Expression, type WidgetSpec } from '../shared/widgets';
import { createWidgetForSource, createWidgetPreset } from '../lib/widgets/presets';
import { computeWidget, graphData } from '../lib/widgets/compute';
import { evaluateExpression } from '../lib/widgets/expression';
import { decodeWidgetSnapshot, encodeWidgetSnapshot, inspectExperimentVersion, parseWidgetFile } from '../lib/widgets/compatibility';
import { widgetCatalog } from '../lib/widgets/catalog';
import { numericPaper } from '../data/numeric-paper';
import { preparedPapers } from '../data/papers';
import { createPreparedExperiment } from '../lib/prepared-figures';
import { snapshotFromPrepared } from '../lib/reading-state';
import { widgetReferenceSources } from '../data/widget-sources';
const close=(a:number,b:number,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const get=<K extends WidgetSpec['kind']>(kind:K)=>createWidgetPreset(kind) as Extract<WidgetSpec,{kind:K}>;

test('all new catalog capabilities have bounded executable/illustrative examples and truthful source anchors',()=>{
 assert.equal(widgetCatalog.filter(d=>d.format==='legacy-figure').length,6);
 for(const kind of WIDGET_KINDS){const e=createWidgetForSource(kind,numericPaper.document);const r=computeWidget(e.spec,e.seed);assert.ok(r.summary);assert.ok(widgetCatalog.find(d=>d.kind===kind&&d.format==='paperplay-widget')?.accessibleEquivalent);assert.equal(validateWidgetEnvelope(e,numericPaper.document).spec.kind,kind);}
 for(const source of widgetReferenceSources){const kind=source.id.includes('attention')?'attention':source.id.includes('probability')?'probability':'signal';assert.ok(validateWidgetEnvelope(createWidgetForSource(kind,source),source));assert.ok(source.extractionWarnings.some(w=>/authored/i.test(w)));}
});

test('trusted expression arithmetic, vector dot products and dimensional units agree with independent values',()=>{
 const s=get('equation');close(evaluateExpression(s.expression,s.variables).value,0);s.variables[2].value=2;close(evaluateExpression(s.expression,s.variables).value,2);
 const dot:Expression={op:'dot',left:[{op:'number',value:2},{op:'number',value:3}],right:[{op:'number',value:4},{op:'number',value:5}]};close(evaluateExpression(dot,[]).value,23);
 const vars=[{...s.variables[0],name:'length',unit:'length' as const,value:3},{...s.variables[1],name:'time',unit:'time' as const,value:2}];
 const velocity:Expression={op:'div',left:{op:'variable',name:'length'},right:{op:'variable',name:'time'}};assert.deepEqual(evaluateExpression(velocity,vars),{value:1.5,dimensions:[1,-1,0]});
 assert.throws(()=>evaluateExpression({op:'add',left:velocity.left,right:velocity.right},vars),/matching units/);
 assert.throws(()=>evaluateExpression({op:'sin',arg:velocity.left},vars),/dimensionless/);
});

test('expression evaluator rejects executable shapes, unknown symbols, invalid domains and adversarial depth',()=>{
 assert.throws(()=>expressionSchema.parse({op:'eval',code:'globalThis.secret'}));assert.throws(()=>expressionSchema.parse({op:'number',value:1,code:'alert(1)'}));
 assert.throws(()=>evaluateExpression({op:'variable',name:'missing'},[]),/definition/);
 assert.throws(()=>evaluateExpression({op:'div',left:{op:'number',value:1},right:{op:'number',value:0}},[]),/zero/);
 assert.throws(()=>evaluateExpression({op:'sqrt',arg:{op:'number',value:-1}},[]),/nonnegative/);
 let e:Expression={op:'number',value:1};for(let i=0;i<1000;i++)e={op:'neg',arg:e};assert.throws(()=>expressionSchema.parse(e),/depth/);
});

test('function samples preserve poles and computed probes, rather than drawing invented values through them',()=>{
 const s=get('function');s.expression={op:'div',left:{op:'number',value:1},right:{op:'variable',name:'x'}};s.domain=[-1,1];s.samples=17;s.probe=0;
 const r=computeWidget(s);assert.equal(r.selected?.y,null);assert.equal(r.points?.find(p=>p.x===0)?.y,null);assert.ok(r.warnings.length);s.probe=0.5;close(computeWidget(s).selected!.y!,2);s.expression={op:'div',left:{op:'number',value:1},right:{op:'sub',left:{op:'variable',name:'x'},right:{op:'number',value:0.07}}};s.samples=16;const shifted=computeWidget(s);assert.ok(shifted.points!.some(p=>p.breakBefore&&p.y!==null));
});

test('linear maps handle rotation, projection, singularity and actual basis/value outputs independently',()=>{
 const s=get('linear');s.matrix=[[0,-1],[1,0]];s.vector=[2,3];const r=computeWidget(s);assert.deepEqual(r.rows?.at(-1)?.values,[2,3,-3,2]);close(Number(r.metrics[0].value),1);close(Number(r.metrics[3].value),1);
 s.matrix=[[1,0],[0,0]];const projected=computeWidget(s);assert.deepEqual(projected.rows?.at(-1)?.values,[2,3,2,0]);assert.equal(projected.metrics[3].value,'Singular / unbounded');assert.ok(projected.warnings.length);
});

test('probability masses normalize and seeded samples retain analytic endpoint and posterior identities',()=>{
 const s=get('probability');s.distribution='binomial';s.trials=12;s.probability=0.3;const r=computeWidget(s,91);close(r.points!.reduce((sum,p)=>sum+p.y!,0),1);close(Number(r.metrics[0].value),3.6);close(Number(r.metrics[1].value),2.52);assert.deepEqual(r.samples,computeWidget(s,91).samples);assert.notDeepEqual(r.samples,computeWidget(s,92).samples);
 s.probability=1;assert.ok(computeWidget(s).samples!.every(x=>x===12));s.distribution='bernoulli';s.probability=0;assert.ok(computeWidget(s).samples!.every(x=>x===0));
 s.distribution='beta-bernoulli';s.alpha=2;s.beta=3;s.successes=4;s.failures=1;const b=computeWidget(s);close(Number(b.metrics[0].value),0.6);close(Number(b.metrics[1].value),24/1100);assert.ok(b.samples!.every(x=>x>0&&x<1));assert.match(String(b.metrics.at(-1)?.value),/approximate/);
 s.distribution='normal';s.samples=512;s.mean=3;s.deviation=2;const n=computeWidget(s,5);close(Number(n.metrics[0].value),3);close(Number(n.metrics[1].value),4);assert.ok(Math.abs(Number(n.metrics[2].value)-3)<0.4);
});

test('scaled dot-product attention matches an independent two-key softmax and rejects invalid masked rows',()=>{
 const s=get('attention');const r=computeWidget(s);const p=Math.exp(1/Math.sqrt(2))/(Math.exp(1/Math.sqrt(2))+1);close(r.matrices![1].values[0][0],p);close(r.matrices![2].values[0][1],2*(1-p));r.matrices![1].values.forEach(row=>close(row.reduce((a,b)=>a+b),1));
 s.mask=[[true,false],[false,true]];assert.deepEqual(computeWidget(s).matrices![1].values,[[1,0],[0,1]]);
 s.mask=[[false,false],[true,true]];assert.throws(()=>computeWidget(s),/no unmasked key/);
 s.mask=[];s.queries=[[1e6,1e6]];s.keys=[[1e6,1e6],[-1e6,-1e6]];assert.deepEqual(computeWidget(s).matrices![1].values,[[1,0]]);
 s.values=[[1]];assert.throws(()=>computeWidget(s),/match/);
});

test('graph and obstacle-grid distances match a separate Bellman-Ford reference and report unreachable targets',()=>{
 const s=get('graph');s.edges.push({id:'ca',source:'c',target:'a',weight:0,label:'0'});s.directed=true;const data=graphData(s);const d=new Map(data.nodes.map(n=>[n.id,n.id===s.start?0:Infinity]));for(let i=0;i<data.nodes.length-1;i++)for(const edge of data.edges)d.set(edge.target,Math.min(d.get(edge.target)!,d.get(edge.source)!+edge.weight));close(Number(computeWidget(s).metrics[0].value),d.get(s.target)!);
 s.edges=[];assert.equal(computeWidget(s).metrics[0].value,'Unreachable');s.mode='grid';s.rows=3;s.columns=3;s.start='c0';s.target='c8';close(Number(computeWidget(s).metrics[0].value),4);s.blocked=[1,3];assert.equal(computeWidget(s).metrics[0].value,'Unreachable');s.blocked=[0];assert.throws(()=>computeWidget(s),/blocked/);
});

test('convolution preserves reversed-kernel convention, boundary semantics and computed DFT values',()=>{
 const s=get('signal');s.input=[[1,2,3]];s.kernel=[[1,0,-1]];s.boundary='zero';assert.deepEqual(computeWidget(s).matrices![0].values,[[2,2,-2]]);s.boundary='wrap';assert.deepEqual(computeWidget(s).matrices![0].values,[[-1,2,-1]]);s.boundary='reflect';assert.deepEqual(computeWidget(s).matrices![0].values,[[0,2,0]]);
 s.input=[[1,1,1,1]];s.kernel=[[1]];s.boundary='zero';const f=computeWidget(s);close(f.secondaryPoints![0].y!,4);f.secondaryPoints!.slice(1).forEach(p=>close(p.y!,0,1e-12));
 s.normalize=true;s.kernel=[[1,-1]];assert.throws(()=>computeWidget(s),/zero-sum/);s.normalize=false;s.mode='2d';s.input=[[1,2],[3,4]];s.kernel=[[1]];assert.deepEqual(computeWidget(s).matrices![0].values,[[1,2],[3,4]]);
});

test('widget snapshots round-trip exact controls, view, authorship and provenance without altering legacy records',()=>{
 const source=numericPaper.document;const e=createWidgetForSource('function',source);e.view.selection='symbol:a';e.authorship={kind:'user',label:'My authored example'};assert.deepEqual(decodeWidgetSnapshot(encodeWidgetSnapshot(e),source),e);assert.deepEqual(parseWidgetFile(JSON.stringify(e),source),e);
 assert.throws(()=>validateWidgetEnvelope({...e,source:{...e.source,quote:'not in the source'}},source),/quote/);assert.throws(()=>validateWidgetEnvelope({...e,schemaVersion:3},source));assert.throws(()=>validateWidgetEnvelope({...e,source:{...e.source,citation:{...e.source.citation!,title:'A fabricated source title'}}},source),/citation/);assert.throws(()=>validateWidgetEnvelope({...e,spec:{...e.spec,kind:'future-widget'}},source));
 const legacy=snapshotFromPrepared(preparedPapers[0],createPreparedExperiment(preparedPapers[0]));const frozen=JSON.stringify(legacy);const legacyResult=inspectExperimentVersion(legacy,preparedPapers[0].document);assert.equal(legacyResult.ok,true);assert.equal(JSON.stringify(legacy),frozen);
 const unknown={...e,schemaVersion:7};const recovery=inspectExperimentVersion(unknown,source);assert.equal(recovery.ok,false);if(!recovery.ok)assert.equal(recovery.original,unknown);assert.equal(unknown.schemaVersion,7);
});

test('structure and result budgets reject malformed data before worker activation',()=>{
 const graph=get('graph');graph.edges[0].target='missing';assert.throws(()=>validateWidgetSpec(graph),/endpoint/);
 const fn=get('function');fn.samples=50000;assert.throws(()=>validateWidgetSpec(fn));const domain=get('function');domain.domain=[-100,100];assert.throws(()=>validateWidgetSpec(domain),/variable domain/);
 const t=get('table');t.rows[0].cells.unknown=2;assert.throws(()=>validateWidgetSpec(t),/column/);
 const a=get('attention');a.queries[0].push(2);assert.throws(()=>validateWidgetSpec(a),/dimensions/);
 assert.throws(()=>widgetEnvelopeSchema.parse({...createWidgetForSource('equation',numericPaper.document),seed:-1}));
});

test('the actual bundled widget worker computes every catalog family identically to the direct reference',async()=>{
 const worker=new Worker(new URL('./widget-bundled-worker.mjs',import.meta.url));try{for(const kind of WIDGET_KINDS){const spec=createWidgetPreset(kind);const result=await new Promise<unknown>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker timeout')),10000);worker.once('error',error=>{clearTimeout(timer);reject(error);});worker.once('message',data=>{clearTimeout(timer);data.error?reject(Error(data.error)):resolve(data.result);});worker.postMessage({protocol:2,id:kind,spec,seed:91});});assert.deepEqual(result,computeWidget(spec,91),kind);}}finally{await worker.terminate();}
});


test('frozen release-1.1.0 graph, sorting and numerical snapshots remain recoverable without destructive migration',()=>{
 const frozen=JSON.parse(readFileSync(new URL('./fixtures/release-1.1.0-snapshots.json',import.meta.url),'utf8'));
 assert.equal(frozen.length,3);for(const snapshot of frozen){const before=JSON.stringify(snapshot),source=preparedPapers.find(p=>p.document.id===snapshot.documentId)!.document;const inspected=inspectExperimentVersion(snapshot,source);assert.equal(inspected.ok,true);if(inspected.ok)assert.equal(inspected.value.kind,'legacy');assert.equal(JSON.stringify(snapshot),before);}
});

test('beta uniform and integer-shape densities agree with closed forms, including concentrated posterior observations',()=>{
 const s=get('probability');s.distribution='beta-bernoulli';s.successes=0;s.failures=0;s.alpha=1;s.beta=1;computeWidget(s).points!.forEach(p=>close(p.y!,1,1e-12));
 s.alpha=2;s.beta=2;computeWidget(s).points!.forEach(p=>close(p.y!,6*p.x*(1-p.x),1e-12));
 s.successes=1000;s.failures=1000;const result=computeWidget(s);close(Number(result.metrics[0].value),0.5);assert.ok(result.samples!.every(x=>Number.isFinite(x)&&x>0&&x<1));
});

test('Bernoulli likelihood is distinct from prior/posterior density and remains stable for concentrated counts',()=>{
 const s=get('probability');s.distribution='beta-bernoulli';s.successes=0;s.failures=0;
 assert.ok(computeWidget(s).likelihoodPoints!.every(p=>p.y===1));
 s.successes=2;s.failures=2;
 for(const p of computeWidget(s).likelihoodPoints!)close(p.y!,16*p.x*p.x*(1-p.x)*(1-p.x),1e-12);
 s.successes=1000;s.failures=1000;
 assert.ok(computeWidget(s).likelihoodPoints!.every(p=>p.y!==null&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1));
});

test('actual worker client cancellation and timeout terminate obsolete workers while a replacement returns the new input',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Worker');const stopped:Promise<number>[]=[];let terminated=0;
 class BrowserWorkerAdapter{
  worker:Worker;onmessage:((event:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;
  constructor(url:string){assert.equal(url,'/widget.worker.mjs?v=2.0.0');this.worker=new Worker(new URL('./widget-bundled-worker.mjs',import.meta.url));this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',()=>this.onerror?.());}
  postMessage(data:unknown){this.worker.postMessage(data);}terminate(){terminated++;stopped.push(this.worker.terminate());}
 }
 Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:BrowserWorkerAdapter});
 try{const controller=new AbortController();const old=executeWidget(get('probability'),42,{signal:controller.signal});controller.abort();await assert.rejects(old,/cancelled/i);const changed=get('equation');changed.variables[2].value=2;assert.deepEqual(await executeWidget(changed,43),computeWidget(changed,43));await assert.rejects(executeWidget(changed,43,{timeoutMs:1}),/time limit/);assert.equal(terminated,3);}
 finally{if(descriptor)Object.defineProperty(globalThis,'Worker',descriptor);else Reflect.deleteProperty(globalThis,'Worker');await Promise.all(stopped);}
});
