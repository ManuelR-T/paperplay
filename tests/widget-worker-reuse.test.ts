import test from 'node:test';import assert from 'node:assert/strict';
import {executeWidget,disposeIdleWidgetWorkers} from '../lib/widgets/worker-client';
import {createWidgetPreset} from '../lib/widgets/presets';
test('successive input calculations reuse a warm worker while cancellation destroys interrupted work',async()=>{
 const original=globalThis.Worker;let created=0,terminated=0,hang=false;
 class FakeWorker{
  onmessage:((event:any)=>void)|null=null;onerror=null;onmessageerror=null;
  constructor(){created++;}terminate(){terminated++;}
  postMessage(value:any){if(!hang)queueMicrotask(()=>this.onmessage?.({data:{protocol:2,id:value.id,result:{summary:'Computed',metrics:[]}}}));}
 }
 try{
  globalThis.Worker=FakeWorker as unknown as typeof Worker;
  const spec=createWidgetPreset('equation');
  await executeWidget(spec,1);await executeWidget(spec,2);assert.equal(created,1);assert.equal(terminated,0);
  hang=true;const controller=new AbortController(),pending=executeWidget(spec,3,{signal:controller.signal});
  await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(pending);assert.equal(terminated,1);
  hang=false;await executeWidget(spec,4);assert.equal(created,2);
 }finally{disposeIdleWidgetWorkers();globalThis.Worker=original;}
});
