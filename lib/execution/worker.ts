import { executeRequest, EXECUTION_PROTOCOL_VERSION, validateExecutionRequest, type ExecutionResponse } from './protocol';
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<unknown>) => void) | null; postMessage(value: ExecutionResponse): void };
scope.onmessage = event => {
  let id = '';
  try {
    const request = validateExecutionRequest(event.data); id = request.id;
    scope.postMessage({ version: EXECUTION_PROTOCOL_VERSION, id, status: 'started' });
    const { result } = executeRequest(request);
    scope.postMessage({ version: EXECUTION_PROTOCOL_VERSION, id, status: 'complete', result });
  } catch (error) {
    scope.postMessage({ version: EXECUTION_PROTOCOL_VERSION, id, status: 'failed', error: error instanceof Error ? error.message.slice(0, 1000) : 'The worker could not complete this computation.' });
  }
};
