import { version as appVersion } from '../../package.json';
import { EXECUTION_PROTOCOL_VERSION, validateExecutionRequest, validateExecutionResult, type ExecutionInput, type ExecutionResponse, type ExecutionResult } from './protocol';

export type ExecutionWorker = Pick<Worker, 'postMessage' | 'terminate'> & { onmessage: ((event: MessageEvent<ExecutionResponse>) => void) | null; onerror: ((event: ErrorEvent) => void) | null; onmessageerror?: ((event: MessageEvent) => void) | null };
export type WorkerFactory = () => ExecutionWorker;
export const createExecutionWorker: WorkerFactory = () => new Worker(`/engine.worker.mjs?v=${appVersion}-p${EXECUTION_PROTOCOL_VERSION}`, { type: 'module', name: 'paperplay-engine' });
const cancelled = () => new DOMException('Computation cancelled.', 'AbortError');

/** One disposable worker per run: termination interrupts CPU work, not just its UI. */
export function executeInWorker(input: ExecutionInput, options: { signal?: AbortSignal; onProgress?: (status: 'starting' | 'running') => void; workerFactory?: WorkerFactory; timeoutMs?: number } = {}): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(cancelled()); return; }
    const request = validateExecutionRequest({ ...input, version: EXECUTION_PROTOCOL_VERSION, id: crypto.randomUUID() });
    let worker: ExecutionWorker;
    try { worker = (options.workerFactory ?? createExecutionWorker)(); }
    catch { reject(new Error('Background computation is unavailable in this browser. No blocking main-thread fallback was started.')); return; }
    let finished = false;
    const timer = setTimeout(() => complete(new Error('Background computation reached its 30-second wall-clock limit. Reduce the input or operation limit.')), Math.min(30_000, Math.max(1, options.timeoutMs ?? 30_000)));
    function complete(error?: Error, result?: ExecutionResult) {
      if (finished) return;
      finished = true; clearTimeout(timer); options.signal?.removeEventListener('abort', stop);
      worker.terminate(); worker.onmessage = null; worker.onerror = null;
      if (error) reject(error); else resolve(result!);
    }
    function stop() { complete(cancelled()); }
    options.signal?.addEventListener('abort', stop, { once: true });
    worker.onmessage = event => {
      if (finished) return;
      const message = event.data;
      if (message?.version !== EXECUTION_PROTOCOL_VERSION || message.id !== request.id) { complete(new Error('The background computation returned an incompatible or stale response.')); return; }
      if (message.status === 'started') { options.onProgress?.('running'); return; }
      if (message.status === 'failed') { complete(new Error(typeof message.error === 'string' ? message.error : 'Background computation failed.')); return; }
      try {
        // The application-owned worker has already validated every trace step.
        // Recheck transfer size, versions and request identity here without parsing
        // thousands of numeric states again on the UI thread.
        if (message.status !== 'complete') throw new Error('The worker returned an invalid computation state.');
        complete(undefined, validateExecutionResult(message.result, request, { fullTrace: false }));
      } catch (error) { complete(error instanceof Error ? error : new Error('The background result could not be validated.')); }
    };
    worker.onerror = () => complete(new Error('Background computation failed to load or execute. The source remains readable.'));
    worker.onmessageerror = () => complete(new Error('The background result could not be transferred.'));
    if (options.signal?.aborted) { stop(); return; }
    options.onProgress?.('starting');
    try { worker.postMessage(request); } catch { complete(new Error('The input could not be transferred to the computation worker.')); }
  });
}
