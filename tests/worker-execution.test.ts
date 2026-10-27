import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { executeInWorker, type ExecutionWorker } from '../lib/execution/client';
import { executeRequest, validateExecutionRequest, validateExecutionResult, MAX_EXECUTION_RESULT_BYTES, type ExecutionInput, type ExecutionResponse } from '../lib/execution/protocol';
import { createDefaultInput, runEngine, runComparison } from '../lib/engines';

function nodeWorker(onExit?: () => void, bundled = false): ExecutionWorker {
  const native = new Worker(new URL(bundled ? './execution-bundled-worker.mjs' : './execution-node-worker.mjs', import.meta.url));
  const adapter: ExecutionWorker = { onmessage: null, onerror: null, postMessage: value => native.postMessage(value), terminate: () => { void native.terminate(); } };
  native.on('message', data => adapter.onmessage?.({ data } as MessageEvent<ExecutionResponse>));
  native.on('error', error => adapter.onerror?.({ message: error instanceof Error ? error.message : 'Worker error' } as ErrorEvent));
  native.on('exit', () => onExit?.());
  return adapter;
}
const runInput = (): ExecutionInput => ({ kind: 'run', engineId: 'powersort', input: createDefaultInput('array', 17), options: { seed: 17, parameters: { operationLimit: 10_000 } } });

test('actual worker execution equals direct graph and sorting runs, including metadata and complete traces', async () => {
  for (const [kind, engine] of [['graph', 'dijkstra-heap'], ['array', 'powersort']] as const) {
    const input = createDefaultInput(kind, 71); const options = { seed: 71, parameters: { operationLimit: 10_000 } };
    const progress: string[] = [];
    const result = await executeInWorker({ kind: 'run', engineId: engine, input, options }, { workerFactory: () => nodeWorker(), onProgress: value => progress.push(value) });
    assert.equal(result.kind, 'run');
    if (result.kind === 'run') assert.deepEqual(result.run, runEngine(engine, input, options));
    assert.deepEqual(progress, ['starting', 'running']);
  }
});

test('the generated production browser worker is executable ESM and returns the same validated result', async () => {
  const input = runInput();
  const result = await executeInWorker(input, { workerFactory: () => nodeWorker(undefined, true) });
  assert.equal(result.kind, 'run');
  if (result.kind === 'run' && input.kind === 'run') assert.deepEqual(result.run, runEngine(input.engineId, input.input, input.options));
});

test('actual worker comparisons preserve the same shared input, compatible metrics and results', async () => {
  const input = createDefaultInput('array', 93); const options = { seed: 93, parameters: { operationLimit: 10_000 } };
  const ids = ['powersort', 'natural-mergesort'];
  const result = await executeInWorker({ kind: 'comparison', engineIds: ids, input, options }, { workerFactory: () => nodeWorker() });
  assert.equal(result.kind, 'comparison');
  if (result.kind === 'comparison') assert.deepEqual(result.comparison, runComparison(ids, input, options));
});

test('per-engine numeric comparison settings survive worker transfer without collapsing into shared parameters', async () => {
  const input = { kind: 'matrix' as const, matrix: [[2, 0], [0, 4]], rhs: [2, 4], initial: [0, 0] };
  const options = { seed: 19, parametersByEngine: {
    'gradient-descent': { stepSize: .1, iterations: 8, operationLimit: 10_000 },
    'heavy-ball': { stepSize: .2, iterations: 8, momentum: .2, operationLimit: 10_000 },
  } };
  const ids = ['gradient-descent', 'heavy-ball'];
  const direct = runComparison(ids, input, options);
  const result = await executeInWorker({ kind: 'comparison', engineIds: ids, input, options }, { workerFactory: () => nodeWorker() });
  assert.equal(result.kind, 'comparison');
  if (result.kind === 'comparison') {
    assert.deepEqual(result.comparison, direct);
    assert.equal(result.comparison.runs[0].trace.binding.parameters.stepSize, .1);
    assert.equal(result.comparison.runs[1].trace.binding.parameters.stepSize, .2);
    assert.equal(result.comparison.runs[1].trace.binding.parameters.momentum, .2);
    assert.notDeepEqual(result.comparison.runs[0].result, result.comparison.runs[1].result);
  }
  assert.throws(() => runComparison(ids, input, { parametersByEngine: { missing: { stepSize: .1 } } }), /unselected/);
  assert.throws(() => runComparison(ids, input, { parametersByEngine: { 'gradient-descent': { momentum: .3 } } }), /Unknown per-engine/);
});

test('cancellation terminates real worker work and cannot publish a late result over a newer run', async () => {
  let exited = false;
  const controller = new AbortController();
  const pending = executeInWorker(runInput(), { signal: controller.signal, workerFactory: () => nodeWorker(() => { exited = true; }) });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const fresh = await executeInWorker({ ...runInput(), options: { seed: 99 } }, { workerFactory: () => nodeWorker() });
  assert.equal(fresh.kind, 'run'); if (fresh.kind === 'run') assert.equal(fresh.run.trace.seed, 99);
  await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(exited, true);
});

test('protocol rejects incompatible versions, excessive transfers, wrong input identity and stale messages', async () => {
  assert.throws(() => validateExecutionRequest({ ...runInput(), id: 'test', version: 2 }));
  assert.throws(() => validateExecutionRequest({ ...runInput(), id: 'test', version: 1, extra: 'x'.repeat(270_000) }), /input-transfer/);
  const { request, result } = executeRequest({ ...runInput(), id: 'test', version: 1 });
  if (result.kind === 'run') { result.run.trace.seed = 80; assert.throws(() => validateExecutionResult(result, request), /input, seed/); }
  const oversized = { ...result, padding: 'x'.repeat(MAX_EXECUTION_RESULT_BYTES) };
  assert.throws(() => validateExecutionResult(oversized, request), /8 MiB/);
  let terminated = false;
  const stale: ExecutionWorker = { onmessage: null, onerror: null, terminate() { terminated = true; }, postMessage() { queueMicrotask(() => stale.onmessage?.({ data: { version: 1, id: 'previous-run', status: 'started' } } as MessageEvent<ExecutionResponse>)); } };
  await assert.rejects(executeInWorker(runInput(), { workerFactory: () => stale }), /stale response/);
  assert.equal(terminated, true);
});

test('worker wall-clock limits and missing browser support fail without main-thread execution', async () => {
  let terminated = false;
  const stalled: ExecutionWorker = { onmessage: null, onerror: null, postMessage() {}, terminate() { terminated = true; } };
  await assert.rejects(executeInWorker(runInput(), { workerFactory: () => stalled, timeoutMs: 5 }), /wall-clock/);
  assert.equal(terminated, true);
  await assert.rejects(executeInWorker(runInput(), { workerFactory() { throw Error('unsupported'); } }), /No blocking main-thread fallback/);
});
