import {DISCRETE_ENGINE_VERSION,DISCRETE_LIMITS,validateDiscreteRequest,discreteFrameCells,type DiscreteRequest,type DiscreteResult,type DiscreteState,type DiscreteFrame,type DiscreteMetrics} from '../../shared/discrete-algorithms';
type Counter=Exclude<keyof DiscreteMetrics,'operations'>;
class Halt extends Error{constructor(public status:'cancelled'|'limit-reached',public code:'cancelled'|'operation-limit'|'frame-limit'|'retention-limit'|'wall-limit'){super(code);}}
/** Application-owned finite algorithms. Snapshot/copy/validation costs are separate from declared primitive operations. */
export function runDiscrete(raw:DiscreteRequest,options:{signal?:AbortSignal;now?:()=>number}={}):DiscreteResult{
 const request=validateDiscreteRequest(raw),clock=options.now??(()=>performance.now()),start=clock();
 let state:DiscreteState=request.model==='kahn-topological'?{kind:'kahn',phase:'initialize',queue:[],output:[],indegrees:request.graph.nodes.map(n=>({id:n.id,value:0})),processedEdgeIds:[],current:null}:{kind:'union-find',elements:[],rootSizes:[],answers:[],components:0,currentCommand:null,completedCommands:0};
 let metrics:DiscreteMetrics={operations:0,edgeReads:0,edgeRemovals:0,queuePushes:0,queuePops:0,parentReads:0,parentWrites:0,sizeComparisons:0,merges:0,makes:0,conditionTests:0};
 const frames:DiscreteFrame[]=[];let retainedCells=0,retainedBytes=new TextEncoder().encode(JSON.stringify(request)).length+4096,status:DiscreteResult['status']='completed',outcome:DiscreteResult['outcome']='incomplete';const diagnostics:DiscreteResult['diagnostics']=[];
 const guard=()=>{if(options.signal?.aborted)throw new Halt('cancelled','cancelled');if(clock()-start>=request.limits.maxWallMs)throw new Halt('limit-reached','wall-limit');};
 const emit=(event:DiscreteFrame['event'],pseudo:DiscreteFrame['pseudocodeIds'][number],message:string,entityIds:string[],update:(next:DiscreteState)=>void=()=>{},charges:Partial<Record<Counter,number>>={})=>{
  guard();const cost=Object.values(charges).reduce((a,b)=>a+b,0);if(metrics.operations+cost>request.limits.maxOperations)throw new Halt('limit-reached','operation-limit');if(frames.length>=request.limits.maxFrames)throw new Halt('limit-reached','frame-limit');
  const next=structuredClone(state),counts={...metrics};update(next);for(const [key,value]of Object.entries(charges))counts[key as Counter]+=value;counts.operations+=cost;
  const frame:DiscreteFrame={step:frames.length,event,pseudocodeIds:[pseudo],message,entityIds:[...new Set(entityIds)],metrics:counts,state:next};const cells=discreteFrameCells(frame),bytes=new TextEncoder().encode(JSON.stringify(frame)).length+1;
  if(retainedCells+cells>request.limits.maxRetainedCells||retainedBytes+bytes>DISCRETE_LIMITS.resultBytes)throw new Halt('limit-reached','retention-limit');
  guard();frames.push(frame);state=next;metrics=counts;retainedCells+=cells;retainedBytes+=bytes;
 };
 try{
  emit('initialize',request.model==='kahn-topological'?'k-initialize':'u-command','Initialize the declared finite collection.',[]);
  if(request.model==='kahn-topological'){
   const outgoing=new Map(request.graph.nodes.map(n=>[n.id,[] as typeof request.graph.edges]));
   for(const edge of request.graph.edges){emit('read-edge','k-read-edge','Count one original edge into its target indegree.',[edge.id,edge.source,edge.target],s=>{if(s.kind==='kahn')s.indegrees.find(v=>v.id===edge.target)!.value++;},{edgeReads:1});outgoing.get(edge.source)!.push(edge);}
   for(const node of request.graph.nodes){emit('ready-test','k-ready','Test whether this initial vertex has zero residual indegree.',[node.id],s=>{if(s.kind==='kahn')s.phase='ready';},{conditionTests:1});if((state as Extract<DiscreteState,{kind:'kahn'}>).indegrees.find(v=>v.id===node.id)!.value===0)emit('enqueue','k-ready','Append an eligible vertex to the FIFO.',[node.id],s=>{if(s.kind==='kahn')s.queue.push(node.id);},{queuePushes:1});}
   while((state as Extract<DiscreteState,{kind:'kahn'}>).queue.length){
    const id=(state as Extract<DiscreteState,{kind:'kahn'}>).queue[0];emit('dequeue-output','k-output','Remove the FIFO head and append its original ID to the output.',[id],s=>{if(s.kind==='kahn'){s.phase='expand';s.queue=s.queue.slice(1);s.output.push(id);s.current=id;}},{queuePops:1});
    for(const edge of outgoing.get(id)!){emit('remove-edge','k-remove','Remove this outgoing edge and decrement its target indegree atomically.',[edge.id,edge.source,edge.target],s=>{if(s.kind==='kahn'){s.processedEdgeIds.push(edge.id);s.indegrees.find(v=>v.id===edge.target)!.value--;}},{edgeRemovals:1});emit('ready-test','k-test','Test whether the target has become ready.',[edge.target],()=>{},{conditionTests:1});if((state as Extract<DiscreteState,{kind:'kahn'}>).indegrees.find(v=>v.id===edge.target)!.value===0)emit('enqueue','k-test','Append the newly ready target in original outgoing-edge order.',[edge.target],s=>{if(s.kind==='kahn')s.queue.push(edge.target);},{queuePushes:1});}
   }
   emit('finish','k-finish','The FIFO is exhausted after all outgoing-edge expansions.',[],s=>{if(s.kind==='kahn'){s.phase='done';s.current=null;}});outcome=(state as Extract<DiscreteState,{kind:'kahn'}>).output.length===request.graph.nodes.length?'topological-order':'cycle-blocked-remainder';
  }else{
   type UF=Extract<DiscreteState,{kind:'union-find'}>;const current=()=>state as UF;
   const find=(elementId:string)=>{const path:string[]=[];let id=elementId;for(let visits=0;visits<=64;visits++){let parent='';emit('find-parent','u-find','Read one parent and test whether this element is a root.',[id],()=>{parent=current().elements.find(e=>e.id===id)!.parent;},{parentReads:1,conditionTests:1});if(parent===id){for(const child of path)emit('compress-parent','u-compress','Point a traversed nonroot directly at the discovered root.',[child,id],s=>{if(s.kind==='union-find')s.elements.find(e=>e.id===child)!.parent=id;},{parentWrites:1});return id;}path.push(id);id=parent;}throw Error('Invalid parent forest.');};
   for(const command of request.commands){
    emit('begin-command','u-command','Begin the next declared command without marking it complete.',[command.id],s=>{if(s.kind==='union-find')s.currentCommand=command.id;});
    if(command.kind==='make')emit('make','u-make','Create one new singleton with an original stable element ID.',[command.id,command.element.id],s=>{if(s.kind==='union-find'){s.elements.push({...command.element,parent:command.element.id});s.rootSizes.push({id:command.element.id,size:1});s.components++;}},{makes:1});
    else if(command.kind==='find'){const root=find(command.elementId);emit('answer','u-answer','Publish the representative at this query time; later unions may change it.',[command.id,command.elementId,root],s=>{if(s.kind==='union-find')s.answers.push({commandId:command.id,elementId:command.elementId,rootId:root});});}
    else{
     const a=find(command.a),b=find(command.b);emit('size-test','u-size','Test root equality and compare component sizes; ties favor earlier creation.',[a,b],()=>{},{conditionTests:1,sizeComparisons:a===b?0:1});
     if(a!==b){const uf=current(),sa=uf.rootSizes.find(r=>r.id===a)!.size,sb=uf.rootSizes.find(r=>r.id===b)!.size,early=uf.elements.findIndex(e=>e.id===a)<uf.elements.findIndex(e=>e.id===b),root=sa>sb||sa===sb&&early?a:b,child=root===a?b:a;
      emit('link-roots','u-link','Link the smaller root to the larger; only root sizes describe component cardinality.',[root,child],s=>{if(s.kind==='union-find'){s.elements.find(e=>e.id===child)!.parent=root;s.rootSizes.find(r=>r.id===root)!.size=sa+sb;s.rootSizes=s.rootSizes.filter(r=>r.id!==child);s.components--;}},{parentWrites:1,merges:1});
     }
    }
    emit('complete-command','u-complete','Mark this command complete.',[command.id],s=>{if(s.kind==='union-find'){s.completedCommands++;s.currentCommand=null;}});
   }
   emit('finish','u-finish','All declared commands have completed.',[]);outcome='commands-complete';
  }
 }catch(error){outcome='incomplete';if(error instanceof Halt){status=error.status;diagnostics.push({code:error.code,message:error.status==='cancelled'?'Execution cancelled; the last committed trace prefix remains available.':'Execution reached a declared resource limit; no uncommitted state is retained.'});}else{status='invalid-domain';diagnostics.push({code:'invalid-state',message:'Execution stopped because an internal collection invariant could not be maintained.'});}}
 const elapsed=clock()-start;const result:DiscreteResult={format:'paperplay-discrete-result',schemaVersion:1,engineVersion:DISCRETE_ENGINE_VERSION,request,status,outcome,frames,stats:{operations:metrics.operations,retainedCells,elapsedMs:Number.isFinite(elapsed)?Math.max(0,Math.min(1e9,elapsed)):0,completedCommands:state.kind==='union-find'?state.completedCommands:0},diagnostics};
 const freeze=(v:unknown)=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(result);return result;
}
