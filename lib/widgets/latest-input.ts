/** One running calculation and one replaceable latest input; dragging never builds a queue. */
export function createLatestInputRunner<T,R>(execute:(input:T,signal:AbortSignal)=>Promise<R>,publish:(input:T,result:R)=>void,fail:(input:T,error:unknown)=>void){
 let active:AbortController|undefined,pending:{input:T}|undefined,disposed=false;
 const pump=()=>{
  if(disposed||active||!pending)return;
  const {input}=pending;pending=undefined;
  const controller=new AbortController();active=controller;
  void execute(input,controller.signal).then(result=>{if(!disposed&&!controller.signal.aborted)publish(input,result);},error=>{if(!disposed&&!controller.signal.aborted&&!pending)fail(input,error);}).finally(()=>{if(active===controller)active=undefined;pump();});
 };
 return {submit(input:T){if(!disposed){pending={input};pump();}},cancel(){pending=undefined;active?.abort();},dispose(){disposed=true;pending=undefined;active?.abort();}};
}
