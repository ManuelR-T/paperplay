import { parentPort } from 'node:worker_threads';
globalThis.self=globalThis;
globalThis.addEventListener=(type,callback)=>{if(type==='message')parentPort.on('message',data=>callback({data}));};
globalThis.postMessage=data=>parentPort.postMessage(data);
await import('../public/widget.worker.mjs');
