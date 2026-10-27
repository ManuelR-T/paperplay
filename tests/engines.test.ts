import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultInput, engineRegistry, nodePower, runComparison, runEngine, type ArrayResult, type GraphResult } from '../lib/engines';
import { validateTrace, type AlgorithmInput } from '../shared/schema';

function graphOracle(input: Extract<AlgorithmInput, {kind:'graph'}>) {
  // Bellman–Ford edge passes share neither a priority queue nor settled-node logic.
  const d = Object.fromEntries(input.nodes.map(node => [node.id, Infinity])); d[input.nodeRoles!.start] = 0;
  for (let pass = 1; pass < input.nodes.length; pass++) for (const e of input.edges) {
    d[e.target] = Math.min(d[e.target], d[e.source] + e.weight);
    if (!input.directed) d[e.source] = Math.min(d[e.source], d[e.target] + e.weight);
  }
  return Object.fromEntries(Object.entries(d).map(([key,value]) => [key, Number.isFinite(value) ? value : null]));
}
const graphIds = ['dijkstra-heap','dijkstra-scan'];
const sortIds = ['powersort','natural-mergesort'];

test('seeded input generation and complete traces are deterministic without mutating caller input', () => {
  for (const family of ['graph','array'] as const) {
    assert.deepEqual(createDefaultInput(family,77),createDefaultInput(family,77));
    const input=createDefaultInput(family,77); const before=structuredClone(input);
    for(const id of family==='graph'?graphIds:sortIds) {
      assert.deepEqual(runEngine(id,input,{seed:77}),runEngine(id,input,{seed:77}));
      validateTrace(runEngine(id,input).trace,engineRegistry);
    }
    assert.deepEqual(input,before);
  }
  assert.throws(()=>createDefaultInput('array',-1),/Seed/);
  assert.throws(()=>runEngine('powersort',{kind:'array',values:[]},{parameters:{unknown:2}}),/Invalid execution/);
});

test('graph methods match independent Bellman–Ford distances over seeded cases', () => {
  for(let seed=0;seed<30;seed++) {
    const input=createDefaultInput('graph',seed);
    if(input.kind!=='graph')throw Error('wrong fixture');
    // Change topology/weights, not just the default fixture’s single generated edge.
    input.edges=input.edges.filter((_,i)=>(i+seed)%5!==0).map((e,i)=>({...e,weight:(seed*7+i*3)%11}));
    input.directed=seed%2===0;
    const expected=graphOracle(input);
    for(const id of graphIds)assert.deepEqual((runEngine(id,input).result as GraphResult).distances,expected);
  }
});

test('graph reference cases include relaxation twice, zero edges, ties, disconnected and singleton vertices', () => {
  const input: Extract<AlgorithmInput,{kind:'graph'}>={kind:'graph',directed:true,nodeRoles:{start:'s'},nodes:['s','a','b','t','u'].map(id=>({id,label:id})),edges:[{id:'sa',source:'s',target:'a',weight:4},{id:'sb',source:'s',target:'b',weight:1},{id:'ba',source:'b',target:'a',weight:2},{id:'at',source:'a',target:'t',weight:1},{id:'bt',source:'b',target:'t',weight:7}]};
  for(const id of graphIds) {
    assert.deepEqual((runEngine(id,input).result as GraphResult).distances,{s:0,a:3,b:1,t:4,u:null});
    const zero=structuredClone(input); zero.edges.forEach(e=>e.weight=0);
    assert.deepEqual((runEngine(id,zero).result as GraphResult).distances,{s:0,a:0,b:0,t:0,u:null});
    assert.deepEqual((runEngine(id,{...input,nodes:[{id:'s',label:'S'}],edges:[]}).result as GraphResult).distances,{s:0});
    assert.throws(()=>runEngine(id,{...input,nodeRoles:{start:'absent'}}),/Unknown graph/);
    assert.throws(()=>runEngine(id,{...input,nodeRoles:undefined}),/explicit source/);
    const negative=structuredClone(input);negative.edges[0].weight=-1;
    assert.throws(()=>runEngine(id,negative),/nonnegative/);
  }
});

test('Dijkstra settles nondecreasing distances and recorded metrics come from actual graph events', () => {
  const input=createDefaultInput('graph');
  for(const id of graphIds) {
    const run=runEngine(id,input);let last=-Infinity;
    for(const step of run.trace.steps)if(step.description.startsWith('Settle')&&step.state.kind==='graph'){
      const d=step.state.distances![step.state.activeNodeIds[0]]!;assert.ok(d>=last);last=d;
    }
    const settled=run.trace.metrics.find(m=>m.id==='settledNodes')!.value;
    assert.equal(settled,run.trace.steps.filter(s=>s.description.startsWith('Settle')).length);
    assert.equal(run.trace.metrics.find(m=>m.id==='relaxations')!.value,run.trace.steps.filter(s=>s.description.startsWith('Relax')||s.description.startsWith('Inspect')).length);
  }
});

test('Powersort node powers match the paper figure’s 5,3,3,14,1,2 run-midpoint boundaries', () => {
  const boundaries=[0,5,8,11,25,26,28];
  const actual=boundaries.slice(0,-2).map((s,i)=>nodePower(s,boundaries[i+1],boundaries[i+1],boundaries[i+2],28));
  // Rational midpoint dyadic buckets give these powers independently of stack scheduling.
  assert.deepEqual(actual,[3,2,1,2,4]);
  assert.equal(nodePower(0,3,3,5,12),2);
  assert.equal(nodePower(3,5,5,10,12),1);
  assert.throws(()=>nodePower(0,3,4,5,12),/adjacent/);
});

test('Powersort reproduces a nontrivial Cartesian merge order, not merely sorted output', () => {
  const input: AlgorithmInput={kind:'array',values:[30,31,32,20,21,10,11,12,13,14,0,1]};
  const result=runEngine('powersort',input).result as ArrayResult;
  // Natural runs [0,3),[3,5),[5,10),[10,12); powers 2,1,2.
  // The unique min-power Cartesian tree joins the first two and last two runs first.
  assert.deepEqual(result.mergeOrder,[[0,3,5],[5,10,12],[0,5,12]]);
  const run=runEngine('powersort',input);
  assert.equal(run.trace.metrics.find(m=>m.id==='mergeCost')!.value,24);
  const baseline=runEngine('natural-mergesort',input);
  assert.deepEqual((baseline.result as ArrayResult).mergeOrder,[[0,3,5],[0,5,10],[0,10,12]]);
  assert.equal(baseline.trace.metrics.find(m=>m.id==='mergeCost')!.value,27);
});

test('sorting reference oracle checks order, identity/permutation and stability for degenerate and generated cases', () => {
  const cases:number[][]=[[],[4],[1,2,3,4],[4,3,2,1],[2,2,2],[3,2,2,1],[3,1,3,1,3,1],[1,1,0,0,1,1]];
  for(let seed=0;seed<50;seed++){const input=createDefaultInput('array',seed);if(input.kind==='array')cases.push(input.values);}
  for(const values of cases){
    // Independent reference ordering includes original identity as explicit tie-breaker.
    const expected=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index);
    for(const id of sortIds){
      const run=runEngine(id,{kind:'array',values});const result=run.result as ArrayResult;
      assert.equal(run.trace.status,'completed');
      assert.deepEqual(result.values,expected.map(e=>e.value));
      assert.deepEqual(result.originalIndices,expected.map(e=>e.index));
      assert.deepEqual([...result.originalIndices].sort((a,b)=>a-b),values.map((_,i)=>i));
      for(const step of run.trace.steps)if(step.state.kind==='array')assert.equal(step.state.originalIndices!.length,values.length);
    }
  }
});

test('runs are bounded and cancelled/incomplete runs cannot be presented as completed comparisons', () => {
  const controller=new AbortController();controller.abort();
  for(const id of [...graphIds,...sortIds]){
    const input=createDefaultInput(id.startsWith('dijkstra')?'graph':'array');
    assert.equal(runEngine(id,input,{signal:controller.signal}).trace.status,'cancelled');
    const limited=runEngine(id,input,{operationLimit:1});
    assert.equal(limited.trace.status,'limit-reached');
    assert.ok(limited.trace.steps.every(step=>step.operations<=1));
  }
  assert.throws(()=>runComparison(sortIds,createDefaultInput('array'),{operationLimit:1}),/requires completed/);
  assert.throws(()=>runComparison(['powersort','dijkstra-heap'],createDefaultInput('array')),/Incompatible/);
  assert.throws(()=>runEngine('powersort',createDefaultInput('array'),{operationLimit:50001}),/Invalid execution/);
});

test('comparisons reuse identical inputs and seeds with common metric definitions', () => {
  for(const ids of [graphIds,sortIds]){
    const input=createDefaultInput(ids===graphIds?'graph':'array');
    const comparison=runComparison(ids,input,{seed:17});
    assert.equal(comparison.runs.length,2);assert.ok(comparison.commonMetrics.length>0);
    assert.deepEqual(comparison.runs[0].trace.input,comparison.runs[1].trace.input);
    assert.equal(comparison.runs[0].trace.seed,17);
    assert.deepEqual(comparison.runs[0].result.kind==='graph'?comparison.runs[0].result.distances:comparison.runs[0].result.values,comparison.runs[1].result.kind==='graph'?comparison.runs[1].result.distances:comparison.runs[1].result.values);
  }
});

test('Powersort stack scheduling agrees with an independent recursive min-power Cartesian tree', () => {
  for(let seed=0;seed<40;seed++) {
    const input=createDefaultInput('array',seed);
    if(input.kind!=='array')throw Error('wrong fixture');
    const values=input.values;const runs:{start:number,end:number}[]=[];
    for(let start=0;start<values.length;){
      let end=start+1;
      if(end<values.length){const direction=values[end]<values[start];end++;while(end<values.length&&(direction?values[end]<values[end-1]:values[end]>=values[end-1]))end++;}
      runs.push({start,end});start=end;
    }
    const powers=runs.slice(0,-1).map((r,i)=>nodePower(r.start,r.end,runs[i+1].start,runs[i+1].end,values.length));
    const expected:[number,number,number][]=[];
    function tree(lo:number,hi:number):void {
      if(hi<=lo)return;
      let split=lo;
      for(let k=lo+1;k<hi;k++)if(powers[k]<powers[split])split=k;
      tree(lo,split);tree(split+1,hi);
      expected.push([runs[lo].start,runs[split+1].start,runs[hi].end]);
    }
    tree(0,runs.length-1);
    assert.deepEqual((runEngine('powersort',input).result as ArrayResult).mergeOrder,expected);
  }
});
