import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultDiscreteLimits,discreteFrameCells,validateDiscreteRequest,validateDiscreteResult,type DiscreteRequest,type DiscreteState} from '../shared/discrete-algorithms';
import {runDiscrete} from '../lib/discrete/solver';

// Project-authored tiny mathematical oracles. No production indegree/parent helpers,
// third-party implementation, paper data, or generated-program execution is used.
function permutations(ids:string[]):string[][]{
 if(!ids.length)return [[]];
 return ids.flatMap((id,index)=>permutations(ids.filter((_,i)=>i!==index)).map(rest=>[id,...rest]));
}
function graphRequest(ids:string[],pairs:[string,string][]):DiscreteRequest{
 return {format:'paperplay-discrete-request',schemaVersion:1,model:'kahn-topological',limits:createDefaultDiscreteLimits(),graph:{nodes:ids.map(id=>({id,label:'Same label'})),edges:pairs.map(([source,target],index)=>({id:`edge${index}`,source,target}))}};
}
function ufRequest(commands:Extract<DiscreteRequest,{model:'union-find'}>['commands']):DiscreteRequest{
 return {format:'paperplay-discrete-request',schemaVersion:1,model:'union-find',limits:createDefaultDiscreteLimits(),commands};
}
type UFState=Extract<DiscreteState,{kind:'union-find'}>;
function canonicalPartition(groups:string[][]){return groups.map(group=>[...group].sort().join(',')).sort();}
function bfsPartition(request:Extract<DiscreteRequest,{model:'union-find'}>,completed:number){
 const neighbors=new Map<string,Set<string>>();
 for(const command of request.commands.slice(0,completed)){
  if(command.kind==='make')neighbors.set(command.element.id,new Set());
  if(command.kind==='union'){neighbors.get(command.a)!.add(command.b);neighbors.get(command.b)!.add(command.a);}
 }
 const visited=new Set<string>(),groups:string[][]=[];
 for(const id of neighbors.keys())if(!visited.has(id)){
  const pending=[id],group:string[]=[];visited.add(id);
  for(let cursor=0;cursor<pending.length;cursor++){const current=pending[cursor];group.push(current);for(const next of neighbors.get(current)!)if(!visited.has(next)){visited.add(next);pending.push(next);}}
  groups.push(group);
 }
 return canonicalPartition(groups);
}
function forestPartition(state:UFState){
 const parents=new Map(state.elements.map(element=>[element.id,element.parent]));
 const groups=new Map<string,string[]>();
 for(const id of parents.keys()){
  let cursor=id;const seen=new Set<string>();
  while(parents.get(cursor)!==cursor){assert.ok(parents.has(cursor),'parent exists');assert.ok(!seen.has(cursor),'forest is acyclic');seen.add(cursor);cursor=parents.get(cursor)!;}
  groups.set(cursor,[...(groups.get(cursor)??[]),id]);
 }
 assert.equal(groups.size,state.components);
 assert.deepEqual([...groups].map(([id,members])=>({id,size:members.length})).sort((a,b)=>a.id.localeCompare(b.id)),[...state.rootSizes].sort((a,b)=>a.id.localeCompare(b.id)));
 return canonicalPartition([...groups.values()]);
}
function make(id:string){return {id:`make-${id}`,kind:'make' as const,element:{id,label:'Equal labels retain distinct identities'}};}

test('all 512 directed three-vertex graphs agree with independent permutation DAG oracle',()=>{
 const ids=['a','b','c'];const candidatePairs=ids.flatMap(source=>ids.map(target=>[source,target] as [string,string]));
 const candidates=permutations(ids);
 for(let mask=0;mask<512;mask++){
  const pairs=candidatePairs.filter((_,bit)=>mask&(1<<bit));
  const valid=candidates.filter(order=>pairs.every(([source,target])=>order.indexOf(source)<order.indexOf(target)));
  const request=graphRequest(ids,pairs),result=runDiscrete(request);validateDiscreteResult(result,request);
  assert.equal(result.status,'completed',`mask ${mask}`);
  assert.equal(result.outcome,valid.length?'topological-order':'cycle-blocked-remainder',`mask ${mask}`);
  const last=result.frames.at(-1)!.state;assert.equal(last.kind,'kahn');if(last.kind!=='kahn')throw Error();
  if(valid.length)assert.ok(valid.some(order=>JSON.stringify(order)===JSON.stringify(last.output)),`mask ${mask}: valid topological permutation`);
  for(const frame of result.frames){
   const state=frame.state;if(state.kind!=='kahn')throw Error();
   assert.equal(new Set(state.output).size,state.output.length);
   if(state.phase==='initialize')continue;
   const processed=new Set(state.processedEdgeIds);
   for(const {id,value} of state.indegrees)assert.equal(value,request.model==='kahn-topological'?request.graph.edges.filter(edge=>edge.target===id&&!processed.has(edge.id)).length:-1);
   assert.ok(state.queue.every(id=>!state.output.includes(id)));
  }
 }
});

test('cycle tails are blocked remainder, while an independent vertex is still output',()=>{
 const request=graphRequest(['a','b','tail','free'],[['a','b'],['b','a'],['b','tail']]);
 const result=runDiscrete(request);assert.equal(result.outcome,'cycle-blocked-remainder');
 const state=result.frames.at(-1)!.state;if(state.kind!=='kahn')throw Error();
 assert.deepEqual(state.output,['free']);assert.deepEqual(state.indegrees,[{id:'a',value:1},{id:'b',value:1},{id:'tail',value:1},{id:'free',value:0}]);
 // tail has no outgoing edge; being blocked does not make it a cycle member.
 assert.ok(request.model==='kahn-topological'&&!request.graph.edges.some(edge=>edge.source==='tail'));
});

test('union/find completed prefixes agree with BFS components, including growth, redundant merges and compression',()=>{
 const request=ufRequest([
  ...['a','b','c','d','e','f','g','h'].map(make),
  {id:'ab',kind:'union',a:'a',b:'b'},{id:'cd',kind:'union',a:'c',b:'d'},
  {id:'ef',kind:'union',a:'e',b:'f'},{id:'gh',kind:'union',a:'g',b:'h'},
  {id:'ac',kind:'union',a:'a',b:'c'},{id:'eg',kind:'union',a:'e',b:'g'},
  {id:'ae',kind:'union',a:'a',b:'e'},
  {id:'find-h',kind:'find',elementId:'h'},
  {id:'redundant',kind:'union',a:'h',b:'d'},
  {id:'find-d',kind:'find',elementId:'d'},
 ]);
 if(request.model!=='union-find')throw Error();const result=runDiscrete(request);validateDiscreteResult(result,request);
 assert.equal(result.status,'completed');assert.equal(result.outcome,'commands-complete');
 const completed=new Set<number>();
 for(const frame of result.frames){
  const state=frame.state;if(state.kind!=='union-find')throw Error();forestPartition(state);
  if(state.currentCommand===null){assert.deepEqual(forestPartition(state),bfsPartition(request,state.completedCommands));completed.add(state.completedCommands);}
 }
 for(let prefix=0;prefix<=request.commands.length;prefix++)assert.ok(completed.has(prefix),`completed prefix ${prefix}`);
 const before=result.frames.find(frame=>frame.state.kind==='union-find'&&frame.event==='begin-command'&&frame.state.currentCommand==='find-h')!.state;
 const after=result.frames.find(frame=>frame.state.kind==='union-find'&&frame.event==='complete-command'&&frame.state.completedCommands===16)!.state;
 if(before.kind!=='union-find'||after.kind!=='union-find')throw Error();
 const path:string[]=[];let cursor='h';while(before.elements.find(e=>e.id===cursor)!.parent!==cursor){path.push(cursor);cursor=before.elements.find(e=>e.id===cursor)!.parent;}
 assert.ok(path.length>=3,'constructed nontrivial depth before find');
 for(const id of path)assert.equal(after.elements.find(e=>e.id===id)!.parent,cursor,'full compression, not path halving');
 assert.equal(cursor,'a','creation-order tie policy');assert.deepEqual(forestPartition(before),forestPartition(after));
 const last=result.frames.at(-1)!.state;if(last.kind!=='union-find')throw Error();
 assert.equal(last.components,1);assert.equal(result.frames.at(-1)!.metrics.merges,7);assert.equal(last.elements.length,8);
});

test('operation and frame budget cutoffs retain exactly an immutable prefix, with no false cycle/completion',()=>{
 const requests=[graphRequest(['a','b','c'],[['a','b'],['a','c'],['b','c']]),ufRequest([make('a'),make('b'),{id:'merge',kind:'union',a:'a',b:'b'},{id:'query',kind:'find',elementId:'b'}])];
 for(const request of requests){
  const baseline=runDiscrete(request);assert.equal(baseline.status,'completed');
  for(let budget=0;budget<=baseline.stats.operations;budget++){
   const bounded=structuredClone(request);bounded.limits.maxOperations=budget;const result=runDiscrete(bounded);validateDiscreteResult(result,bounded);
   assert.ok(result.stats.operations<=budget);assert.deepEqual(result.frames,baseline.frames.slice(0,result.frames.length));
   if(budget<baseline.stats.operations){assert.equal(result.status,'limit-reached');assert.equal(result.outcome,'incomplete');}
   else assert.equal(result.status,'completed','exact operation budget completes');
  }
  for(let cap=0;cap<=baseline.frames.length;cap++){
   const bounded=structuredClone(request);bounded.limits.maxFrames=cap;const result=runDiscrete(bounded);validateDiscreteResult(result,bounded);
   assert.deepEqual(result.frames,baseline.frames.slice(0,cap));
   assert.equal(result.status,cap<baseline.frames.length?'limit-reached':'completed');
  }
 }
});

test('invalid graph and growing-structure references are rejected before execution',()=>{
 const unknown=graphRequest(['a'],[['a','missing']]);assert.throws(()=>validateDiscreteRequest(unknown));
 const duplicate=graphRequest(['a','b'],[['a','b'],['a','b']]);assert.throws(()=>validateDiscreteRequest(duplicate));
 assert.throws(()=>validateDiscreteRequest(ufRequest([make('a'),make('a')])));
 assert.throws(()=>validateDiscreteRequest(ufRequest([{id:'early-find',kind:'find',elementId:'a'},make('a')])));
 assert.throws(()=>validateDiscreteRequest(ufRequest([make('a'),{id:'bad-union',kind:'union',a:'a',b:'missing'}])));
});

test('retention and cancellation discard staged mutations while preserving a replayable prefix',()=>{
 const request=ufRequest([make('a'),make('b'),{id:'merge',kind:'union',a:'a',b:'b'},{id:'query',kind:'find',elementId:'b'}]);
 const baseline=runDiscrete(request);
 for(const cap of [0,1,100,500,baseline.stats.retainedCells-1,baseline.stats.retainedCells]){
  const bounded=structuredClone(request);bounded.limits.maxRetainedCells=cap;
  const result=runDiscrete(bounded);validateDiscreteResult(result,bounded);
  assert.ok(result.stats.retainedCells<=cap);assert.deepEqual(result.frames,baseline.frames.slice(0,result.frames.length));
  assert.equal(result.status,cap<baseline.stats.retainedCells?'limit-reached':'completed');
 }
 for(let interrupt=1;interrupt<50;interrupt++){
  const controller=new AbortController();let checks=0;
  const result=runDiscrete(request,{signal:controller.signal,now:()=>{if(++checks===interrupt)controller.abort();return 0;}});
  validateDiscreteResult(result,request);assert.deepEqual(result.frames,baseline.frames.slice(0,result.frames.length));
  if(result.status!=='completed'){assert.equal(result.status,'cancelled');assert.equal(result.outcome,'incomplete');}
 }
});

test('result admission rejects invented merges, false query roots and wrong algorithm step attribution',()=>{
 const request=ufRequest([make('a'),make('b'),{id:'query',kind:'find',elementId:'b'}]);
 const baseline=runDiscrete(request);
 const merged=structuredClone(baseline),terminal=merged.frames.at(-1)!.state;
 if(terminal.kind!=='union-find')throw Error();
 terminal.elements.find(element=>element.id==='b')!.parent='a';terminal.components=1;terminal.rootSizes=[{id:'a',size:2}];
 // Adjust the declared size so rejection cannot be attributed just to retained-cell totals.
 merged.stats.retainedCells-=2;
 assert.throws(()=>validateDiscreteResult(merged,request),'a locally coherent forest is not proof an authorized merge happened');
 const falseAnswer=structuredClone(baseline);
 for(const frame of falseAnswer.frames)if(frame.state.kind==='union-find')for(const answer of frame.state.answers)answer.rootId='a';
 assert.throws(()=>validateDiscreteResult(falseAnswer,request),'find must report the root at query time');
 const wrongStep=structuredClone(baseline);wrongStep.frames.find(frame=>frame.event==='answer')!.pseudocodeIds=['k-remove'];
 assert.throws(()=>validateDiscreteResult(wrongStep,request),'source/pseudocode attribution belongs to the executed algorithm');
 const wrongBinding=structuredClone(baseline);wrongBinding.request.limits.maxWallMs++;
 assert.throws(()=>validateDiscreteResult(wrongBinding,request),'results bind exact requested settings');
});

test('result admission rejects free operations and a completed find with its answer erased',()=>{
 const request=ufRequest([make('a'),{id:'query',kind:'find',elementId:'a'}]);
 const baseline=runDiscrete(request),free=structuredClone(baseline),zeroBudget=structuredClone(request);
 zeroBudget.limits.maxOperations=0;free.request=structuredClone(zeroBudget);
 for(const frame of free.frames)for(const key of Object.keys(frame.metrics))frame.metrics[key as keyof typeof frame.metrics]=0;
 free.stats.operations=0;
 assert.throws(()=>validateDiscreteResult(free,zeroBudget),'operation labels cannot bypass the declared primitive budget');
 const missing=structuredClone(baseline);
 for(const frame of missing.frames)if(frame.state.kind==='union-find'){
  missing.stats.retainedCells-=3*frame.state.answers.length;frame.state.answers=[];
 }
 assert.throws(()=>validateDiscreteResult(missing,request),'a completed query needs its actual answer, not just a consistent forest');
});

test('a DAG cannot be declared cycle-blocked by skipping its eligible vertex',()=>{
 const request=graphRequest(['a','b'],[['a','b']]);
 const forged=structuredClone(runDiscrete(request)),read=forged.frames.find(frame=>frame.event==='read-edge')!;
 const finish=structuredClone(read);finish.step=2;finish.event='finish';finish.pseudocodeIds=['k-finish'];finish.entityIds=[];
 if(finish.state.kind!=='kahn')throw Error();finish.state.phase='done';
 forged.frames=[forged.frames[0],read,finish];forged.outcome='cycle-blocked-remainder';
 forged.stats.operations=read.metrics.operations;
 // Bookkeeping only; the independent oracle is that a -> b has the valid order [a,b].
 forged.stats.retainedCells=forged.frames.reduce((sum,frame)=>sum+discreteFrameCells(frame),0);
 assert.throws(()=>validateDiscreteResult(forged,request),'vertex a is still eligible, so queue exhaustion cannot establish a blocked remainder');
});
