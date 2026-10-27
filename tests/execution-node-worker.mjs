import { parentPort } from 'node:worker_threads';
import { register } from 'tsx/esm/api';
register();
const { executeRequest, validateExecutionRequest, EXECUTION_PROTOCOL_VERSION } = await import('../lib/execution/protocol.ts');
parentPort.on('message', raw => {
  let id = '';
  try {
    const request = validateExecutionRequest(raw); id = request.id;
    parentPort.postMessage({ version: EXECUTION_PROTOCOL_VERSION, id, status: 'started' });
    const { result } = executeRequest(request);
    parentPort.postMessage({ version: EXECUTION_PROTOCOL_VERSION, id, status: 'complete', result });
  } catch (error) {
    parentPort.postMessage({ version: EXECUTION_PROTOCOL_VERSION, id, status: 'failed', error: error instanceof Error ? error.message : 'Worker failed.' });
  }
});
