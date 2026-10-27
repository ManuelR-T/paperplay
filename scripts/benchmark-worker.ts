import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { runEngine, seededRandom } from '../lib/engines';
import { executeInWorker, type ExecutionWorker } from '../lib/execution/client';
const random = seededRandom(20261027);
const input = { kind: 'array' as const, values: Array.from({ length: 256 }, () => Math.floor(random()*1000)) };
const options = { seed: 20261027, parameters: { operationLimit: 50_000 } };
function factory(): ExecutionWorker {
  const native = new Worker(new URL('../tests/execution-node-worker.mjs', import.meta.url));
  const adapter: ExecutionWorker = { onmessage: null, onerror: null, postMessage: value => native.postMessage(value), terminate: () => { void native.terminate(); } };
  native.on('message', data => adapter.onmessage?.({ data } as MessageEvent));
  native.on('error', () => adapter.onerror?.({} as ErrorEvent)); return adapter;
}
async function sample(worker: boolean) {
  const before=performance.now(); let last=before; let maxHeartbeatGap=0;
  const heartbeat=setInterval(()=>{const now=performance.now();maxHeartbeatGap=Math.max(maxHeartbeatGap,now-last);last=now;},2);
  const timer=new Promise<number>(resolve => setTimeout(() => resolve(performance.now()-before), 0));
  const result = worker ? (await executeInWorker({ kind:'run', engineId:'natural-mergesort', input, options }, { workerFactory:factory })) : { kind:'run',run:runEngine('natural-mergesort',input,options) };
  const elapsed=performance.now()-before; const timerDelay=await timer;
  await new Promise(resolve=>setTimeout(resolve,5));clearInterval(heartbeat);
  return { elapsedMs:Math.round(elapsed*100)/100,timerDelayMs:Math.round(timerDelay*100)/100,maxHeartbeatGapMs:Math.round(maxHeartbeatGap*100)/100,steps:result.kind==='run'?result.run.trace.steps.length:0 };
}
const direct=[];const worker=[];
for(let i=0;i<5;i++)direct.push(await sample(false));
for(let i=0;i<5;i++)worker.push(await sample(true));
console.log(JSON.stringify({ runtime:process.version,input:{kind:'array',length:256,seed:options.seed,engine:'natural-mergesort',operationLimit:50000},direct,worker,note:'Node event-loop timing only; worker startup includes TSX loader. Browser worker responsiveness is checked separately.' },null,2));
