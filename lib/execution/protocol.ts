import { z } from 'zod';
import { algorithmInputSchema, validateTrace, type AlgorithmInput } from '../../shared/schema';
import { engineRegistry, runEngine, runComparison, type EngineRun } from '../engines';

export const EXECUTION_PROTOCOL_VERSION = 1 as const;
export const MAX_EXECUTION_REQUEST_BYTES = 256 * 1024;
export const MAX_EXECUTION_RESULT_BYTES = 8 * 1024 * 1024;
const optionsSchema = z.strictObject({
  seed: z.number().int().min(0).max(4_294_967_295).optional(),
  parameters: z.record(z.string().max(100), z.number().finite()).refine(value => Object.keys(value).length <= 16).optional(),
  parametersByEngine: z.record(z.string().max(100), z.record(z.string().max(100), z.number().finite()).refine(value => Object.keys(value).length <= 16)).refine(value => Object.keys(value).length <= 4).optional(),
  operationLimit: z.number().int().min(1).max(50_000).optional(),
});
const requestBase = { version: z.literal(EXECUTION_PROTOCOL_VERSION), id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), input: algorithmInputSchema, options: optionsSchema.optional() };
export const executionRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...requestBase, kind: z.literal('run'), engineId: z.string().min(1).max(100) }),
  z.strictObject({ ...requestBase, kind: z.literal('comparison'), engineIds: z.array(z.string().min(1).max(100)).min(2).max(4) }),
]);
export type ExecutionRequest = z.infer<typeof executionRequestSchema>;
export type ExecutionInput = { kind: 'run'; engineId: string; input: AlgorithmInput; options?: z.infer<typeof optionsSchema> }
  | { kind: 'comparison'; engineIds: string[]; input: AlgorithmInput; options?: z.infer<typeof optionsSchema> };
export type EngineComparison = ReturnType<typeof runComparison>;
export type ExecutionResult = { kind: 'run'; run: EngineRun } | { kind: 'comparison'; comparison: EngineComparison };
export type ExecutionResponse = { version: typeof EXECUTION_PROTOCOL_VERSION; id: string; status: 'started' }
  | { version: typeof EXECUTION_PROTOCOL_VERSION; id: string; status: 'complete'; result: ExecutionResult }
  | { version: typeof EXECUTION_PROTOCOL_VERSION; id: string; status: 'failed'; error: string };

function withinBytes(value: unknown, limit: number, message: string) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > limit) throw new Error(message);
}
export function validateExecutionRequest(raw: unknown): ExecutionRequest {
  withinBytes(raw, MAX_EXECUTION_REQUEST_BYTES, 'This computation exceeds the worker input-transfer limit. Reduce the input size.');
  const request = executionRequestSchema.parse(raw);
  const ids = request.kind === 'run' ? [request.engineId] : request.engineIds;
  if (new Set(ids).size !== ids.length) throw new Error('Comparison engines must be distinct.');
  const engines = ids.map(id => engineRegistry.find(engine => engine.id === id));
  if (engines.some(engine => !engine || engine.inputKind !== request.input.kind)) throw new Error('The worker engine and input are incompatible.');
  if (request.options?.parametersByEngine && (request.kind !== 'comparison' || Object.keys(request.options.parametersByEngine).some(id => !ids.includes(id)))) throw new Error('Per-engine parameters require selected comparison engines.');
  if (request.kind === 'comparison' && engines.some(engine => engine!.comparisonGroup !== engines[0]!.comparisonGroup)) throw new Error('The worker engines do not share a comparison group.');
  return request;
}
export function validateExecutionResult(raw: ExecutionResult, request: ExecutionRequest, options: { fullTrace?: boolean } = {}): ExecutionResult {
  withinBytes(raw, MAX_EXECUTION_RESULT_BYTES, 'The computed trace exceeds the 8 MiB worker-transfer limit. Reduce input or operation limits.');
  if (raw.kind !== request.kind) throw new Error('The worker returned a different computation kind.');
  const runs = raw.kind === 'run' ? [raw.run] : raw.comparison.runs;
  const expected = request.kind === 'run' ? [request.engineId] : request.engineIds;
  if (runs.length !== expected.length) throw new Error('The worker returned the wrong number of runs.');
  for (const [index, run] of runs.entries()) {
    if (!run || run.engineId !== expected[index] || typeof run.summary !== 'string' || run.summary.length > 4000) throw new Error('The worker returned an invalid engine result.');
    if (options.fullTrace !== false) validateTrace(run.trace, engineRegistry);
    else if (!Array.isArray(run.trace?.steps) || run.trace.steps.length < 1 || run.trace.steps.length > 10_000) throw new Error('The worker returned an invalid trace length.');
    const capability = engineRegistry.find(engine => engine.id === expected[index])!;
    const parameters = Object.fromEntries(capability.parameters.map(parameter => [parameter.key, parameter.initial]));
    for (const key of Object.keys(parameters)) if (request.options?.parameters && Object.hasOwn(request.options.parameters, key)) parameters[key] = request.options.parameters[key];
    Object.assign(parameters, request.options?.parametersByEngine?.[expected[index]] ?? {});
    if (request.options?.operationLimit !== undefined) parameters.operationLimit = request.options.operationLimit;
    if (Object.keys(run.trace.binding.parameters).length !== Object.keys(parameters).length || Object.entries(parameters).some(([key,value])=>run.trace.binding.parameters[key]!==value)) throw new Error('The worker result uses different execution parameters.');
    if (run.trace.binding.engineVersion !== capability.version || run.trace.binding.engineId !== expected[index] || JSON.stringify(run.trace.input) !== JSON.stringify(request.input)
      || run.trace.seed !== (request.options?.seed ?? 42)) throw new Error('The worker result does not belong to this input, seed or engine.');
  }
  return raw;
}
export function executeRequest(raw: unknown): { request: ExecutionRequest; result: ExecutionResult } {
  const request = validateExecutionRequest(raw);
  const result: ExecutionResult = request.kind === 'run'
    ? { kind: 'run', run: runEngine(request.engineId, request.input, request.options) }
    : { kind: 'comparison', comparison: runComparison(request.engineIds, request.input, request.options) };
  return { request, result: validateExecutionResult(result, request) };
}
