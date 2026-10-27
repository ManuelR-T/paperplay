import { parentPort } from 'node:worker_threads';
globalThis.postMessage = value => parentPort.postMessage(value);
const loaded=import('../public/engine.worker.mjs');
parentPort.on('message', async data => { await loaded; globalThis.onmessage({ data }); });
