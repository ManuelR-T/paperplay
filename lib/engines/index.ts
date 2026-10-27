import { numericMetrics, numericParameters, momentumParameter, runNumeric, type NumericResult } from './numeric';
import {
  algorithmInputSchema, engineBindingSchema, validateTrace,
  type AlgorithmInput, type EngineCapability, type ExecutionTrace,
} from '@/shared/schema';

type GraphInput = Extract<AlgorithmInput, { kind: 'graph' }>;
type ArrayInput = Extract<AlgorithmInput, { kind: 'array' }>;
type TraceState = ExecutionTrace['steps'][number]['state'];
export type RunOptions = { seed?: number; parameters?: Record<string, number>; parametersByEngine?: Record<string, Record<string, number>>; operationLimit?: number; signal?: AbortSignal };
export type GraphResult = { kind: 'graph'; distances: Record<string, number | null> };
export type ArrayResult = { kind: 'array'; values: number[]; originalIndices: number[]; mergeOrder: [number, number, number][] };
export type EngineRun = { engineId: string; name: string; trace: ExecutionTrace; result: GraphResult | ArrayResult | NumericResult; summary: string };

const limitParameter = { key: 'operationLimit', label: 'Operation limit', min: 1, max: 50_000, step: 1, initial: 10_000 };
const graphMetrics = [
  { id: 'keyComparisons', label: 'Selection key comparisons', unit: 'count' },
  { id: 'relaxations', label: 'Edge relaxation attempts', unit: 'count' },
  { id: 'settledNodes', label: 'Settled vertices', unit: 'count' },
];
const arrayMetrics = [
  { id: 'comparisons', label: 'Key comparisons (discovery + merge)', unit: 'count' },
  { id: 'mergeCost', label: 'Merge cost (sum of merged lengths)', unit: 'items' },
  { id: 'merges', label: 'Completed merges', unit: 'count' },
];
export const engineRegistry: EngineCapability[] = [
  { id: 'gradient-descent', version: '1.0.0', inputKind: 'matrix', figureKinds: ['matrix', 'plot', 'comparison'], parameters: numericParameters, comparisonGroup: 'spd-quadratic-optimization', metrics: numericMetrics },
  { id: 'heavy-ball', version: '1.0.0', inputKind: 'matrix', figureKinds: ['matrix', 'plot', 'comparison'], parameters: [...numericParameters, momentumParameter], comparisonGroup: 'spd-quadratic-optimization', metrics: numericMetrics },
  { id: 'dijkstra-heap', version: '1.0.0', inputKind: 'graph', figureKinds: ['graph', 'comparison'], parameters: [limitParameter], comparisonGroup: 'nonnegative-shortest-distances', metrics: graphMetrics },
  { id: 'dijkstra-scan', version: '1.0.0', inputKind: 'graph', figureKinds: ['graph', 'comparison'], parameters: [limitParameter], comparisonGroup: 'nonnegative-shortest-distances', metrics: graphMetrics },
  { id: 'powersort', version: '1.0.0', inputKind: 'array', figureKinds: ['array', 'comparison'], parameters: [limitParameter], comparisonGroup: 'stable-adaptive-sorting', metrics: arrayMetrics },
  { id: 'natural-mergesort', version: '1.0.0', inputKind: 'array', figureKinds: ['array', 'comparison'], parameters: [limitParameter], comparisonGroup: 'stable-adaptive-sorting', metrics: arrayMetrics },
];
export const engineMetadata: Record<string, { name: string; family: 'graph' | 'array' | 'matrix'; sourceMethod: string; limitations: string[]; referenceCaseIds: string[] }> = {
  'gradient-descent': { name: 'Gradient descent', family: 'matrix', sourceMethod: 'Goh 2017 convex-quadratic gradient recurrence', limitations: ['Small synthetic symmetric positive definite quadratics only.', 'Finite iteration traces do not reproduce training, polynomial regression or colorization experiments.'], referenceCaseIds: ['numeric-diagonal-closed-form', 'numeric-spd-solution', 'numeric-residual-recomputed'] },
  'heavy-ball': { name: 'Heavy-ball momentum', family: 'matrix', sourceMethod: 'Goh 2017 quadratic momentum recurrence with zero initial velocity', limitations: ['Small synthetic SPD quadratics and conservative stable step sizes only.', 'Momentum may oscillate; a finite trace does not prove asymptotic acceleration or reproduce the original experiments.'], referenceCaseIds: ['numeric-momentum-recurrence', 'numeric-zero-momentum', 'numeric-spd-solution'] },
  'dijkstra-heap': { name: 'Dijkstra · binary heap', family: 'graph', sourceMethod: 'Shortest-distance application, not the paper’s priority search tree', limitations: ['A binary heap with stale-entry removal replaces the paper’s verified functional priority map.', 'No Isabelle proof, original data structure or hardware benchmark is reproduced.'], referenceCaseIds: ['graph-relax-twice', 'graph-bellman-ford-oracle', 'graph-zero-tie-unreachable'] },
  'dijkstra-scan': { name: 'Dijkstra · linear scan', family: 'graph', sourceMethod: 'Independent shortest-distance baseline', limitations: ['A scan-based baseline for the same task, not a method claimed as new by the paper.'], referenceCaseIds: ['graph-bellman-ford-oracle', 'graph-zero-tie-unreachable'] },
  powersort: { name: 'Powersort', family: 'array', sourceMethod: 'Munro–Wild Algorithm 2, half-open zero-based translation', limitations: ['Uses ordinary stable buffered merging, no insertion-sort cutoff or Java-specific optimizations.', 'Merge scheduling and stable output are checked; the original runtime experiment is not reproduced.'], referenceCaseIds: ['powersort-node-power', 'powersort-merge-order', 'sorting-stability', 'sorting-reference-oracle'] },
  'natural-mergesort': { name: 'Natural mergesort · left to right', family: 'array', sourceMethod: 'Left-fold adjacent natural-run baseline', limitations: ['Same run discovery and stable merge; only scheduling differs.', 'The baseline is intentionally simple and can be quadratic.'], referenceCaseIds: ['sorting-stability', 'sorting-reference-oracle'] },
};

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4_294_967_296; };
}
export function createDefaultInput(family: 'graph' | 'array' | 'matrix', seed = 42): AlgorithmInput {
  checkSeed(seed);
  const random = seededRandom(seed);
  if (family === 'matrix') return { kind: 'matrix', matrix: [[1, 0], [0, 4]], rhs: [1, 4], initial: [2 + Math.floor(random() * 3), -1 - Math.floor(random() * 3)] };
  if (family === 'graph') return {
    kind: 'graph', directed: true, nodeRoles: { start: 's', target: 't' },
    nodes: [{ id: 's', label: 'S' }, { id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 't', label: 'T' }],
    edges: [{ id: 'sa', source: 's', target: 'a', weight: 4 }, { id: 'sb', source: 's', target: 'b', weight: 1 }, { id: 'ba', source: 'b', target: 'a', weight: 2 }, { id: 'at', source: 'a', target: 't', weight: 1 }, { id: 'bt', source: 'b', target: 't', weight: 7 }, { id: 'bc', source: 'b', target: 'c', weight: 2 + Math.floor(random() * 4) }, { id: 'ct', source: 'c', target: 't', weight: 2 }],
  };
  // Rising runs interrupted by decreases, with duplicate keys to expose stability.
  const lengths = [3, 2, 5, 2]; const values: number[] = [];
  for (const length of lengths) { const base = Math.floor(random() * 6); for (let i = 0; i < length; i++) values.push(base + i); }
  return { kind: 'array', values };
}
function checkSeed(seed: number) { if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) throw new Error('Seed must be an unsigned 32-bit integer.'); }
class Halt extends Error { constructor(readonly status: 'cancelled' | 'limit-reached') { super(status); } }
class Recorder {
  operations = 0;
  readonly steps: ExecutionTrace['steps'] = [];
  constructor(readonly budget: number, readonly signal?: AbortSignal) {}
  tick(amount = 1) { if (this.signal?.aborted) throw new Halt('cancelled'); if (this.operations + amount > this.budget || this.steps.length >= 9_000) throw new Halt('limit-reached'); this.operations += amount; }
  emit(description: string, state: TraceState) { if (this.steps.length >= 9_000) throw new Halt('limit-reached'); this.steps.push({ index: this.steps.length, operations: this.operations, description, state: structuredClone(state) }); }
}

export function runEngine(engineId: string, rawInput: AlgorithmInput, options: RunOptions = {}): EngineRun {
  const engine = engineRegistry.find(candidate => candidate.id === engineId);
  if (!engine) throw new Error('Unknown execution engine.');
  const input = algorithmInputSchema.parse(rawInput);
  if (input.kind !== engine.inputKind) throw new Error('Engine and input kinds are incompatible.');
  const seed = options.seed ?? 42; checkSeed(seed);
  const parameters: Record<string, number> = { ...Object.fromEntries(engine.parameters.map(parameter => [parameter.key, parameter.initial])), ...options.parameters };
  if (options.operationLimit !== undefined) parameters.operationLimit = options.operationLimit;
  if (Object.keys(parameters).some(key => !engine.parameters.some(parameter => parameter.key === key)) || engine.parameters.some(parameter => {
    const value = parameters[parameter.key];
    return !Number.isFinite(value) || value < parameter.min || value > parameter.max || Math.abs((value - parameter.min) / parameter.step - Math.round((value - parameter.min) / parameter.step)) > 1e-7;
  })) throw new Error('Invalid execution parameter or operation limit.');
  const binding = engineBindingSchema.parse({ engineId, engineVersion: engine.version, parameters });
  const recorder = new Recorder(parameters.operationLimit, options.signal);
  const implementations: Record<string, () => InternalOutput & { steps?: ExecutionTrace['steps'] }> = {
    'dijkstra-heap': () => runDijkstra(input as GraphInput, true, recorder),
    'dijkstra-scan': () => runDijkstra(input as GraphInput, false, recorder),
    powersort: () => runSort(input as ArrayInput, true, recorder),
    'natural-mergesort': () => runSort(input as ArrayInput, false, recorder),
    'gradient-descent': () => runNumeric(input as Extract<AlgorithmInput, { kind: 'matrix' }>, false, parameters, options.signal),
    'heavy-ball': () => runNumeric(input as Extract<AlgorithmInput, { kind: 'matrix' }>, true, parameters, options.signal),
  };
  const implementation = implementations[engineId];
  if (!implementation) throw new Error('The registered engine has no implementation.');
  const output = implementation();
  const trace: ExecutionTrace = { schemaVersion: 1, kind: 'computed-trace', binding, seed, input: structuredClone(input), status: output.status, steps: output.steps ?? recorder.steps, metrics: output.metrics };
  validateTrace(trace, engineRegistry);
  return { engineId, name: engineMetadata[engineId].name, trace, result: output.result, summary: output.summary };
}

export function runComparison(ids: string[], input: AlgorithmInput, options: RunOptions = {}) {
  if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error('Choose two to four distinct compatible engines.');
  const capabilities = ids.map(id => { const capability = engineRegistry.find(item => item.id === id); if (!capability) throw new Error('Unknown comparison engine.'); return capability; });
  if (capabilities.some(engine => engine.inputKind !== input.kind || engine.comparisonGroup !== capabilities[0].comparisonGroup)) throw new Error('Incompatible comparison groups or inputs.');
  const commonMetrics = capabilities[0].metrics.filter(metric => capabilities.every(engine => engine.metrics.some(other => other.id === metric.id && other.unit === metric.unit)));
  if (!commonMetrics.length) throw new Error('No compatible comparison metrics.');
  if (options.parametersByEngine && Object.keys(options.parametersByEngine).some(id => !ids.includes(id))) throw new Error('Per-engine parameters refer to an unselected method.');
  const { parametersByEngine, ...sharedOptions } = options;
  const runs = ids.map(id => {
    const engine = capabilities.find(item => item.id === id)!;
    const overrides = parametersByEngine?.[id] ?? {};
    if (Object.keys(overrides).some(key => !engine.parameters.some(parameter => parameter.key === key))) throw new Error('Unknown per-engine comparison parameter.');
    const shared = Object.fromEntries(engine.parameters.filter(parameter => options.parameters && Object.hasOwn(options.parameters, parameter.key)).map(parameter => [parameter.key, options.parameters![parameter.key]]));
    return runEngine(id, structuredClone(input), { ...sharedOptions, parameters: { ...shared, ...overrides } });
  });
  if (runs.some(run => run.trace.status !== 'completed')) throw new Error('Comparison requires completed runs; a run was cancelled or reached its operation limit.');
  return { runs, commonMetrics };
}

type InternalOutput = { status: ExecutionTrace['status']; result: GraphResult | ArrayResult | NumericResult; metrics: ExecutionTrace['metrics']; summary: string };
function runDijkstra(input: GraphInput, heapMode: boolean, recorder: Recorder): InternalOutput {
  const nodeIds = input.nodes.map(node => node.id);
  if (new Set(nodeIds).size !== nodeIds.length || new Set(input.edges.map(edge => edge.id)).size !== input.edges.length) throw new Error('Graph identifiers must be unique.');
  const ids = new Set(nodeIds);
  if (input.edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target))) throw new Error('An edge references an unknown vertex.');
  if (input.edges.some(edge => edge.weight < 0)) throw new Error('Dijkstra requires nonnegative edge weights.');
  const start = input.nodeRoles?.start;
  if (!start) throw new Error('Choose an explicit source vertex in nodeRoles.start.');
  if (!ids.has(start) || Object.values(input.nodeRoles ?? {}).some(id => !ids.has(id))) throw new Error('Unknown graph node role.');
  const distances: Record<string, number> = Object.fromEntries(nodeIds.map(id => [id, Infinity])); distances[start] = 0;
  const settled = new Set<string>(); let keyComparisons = 0; let relaxations = 0;
  const adjacency = new Map(nodeIds.map(id => [id, [] as Array<{ edgeId: string; to: string; weight: number }>]));
  for (const edge of input.edges) { adjacency.get(edge.source)!.push({ edgeId: edge.id, to: edge.target, weight: edge.weight }); if (!input.directed) adjacency.get(edge.target)!.push({ edgeId: edge.id, to: edge.source, weight: edge.weight }); }
  const publicDistances = () => Object.fromEntries(nodeIds.map(id => [id, Number.isFinite(distances[id]) ? distances[id] : null]));
  const state = (active: string[] = [], edges: string[] = []): TraceState => ({ kind: 'graph', activeNodeIds: active, visitedNodeIds: [...settled], activeEdgeIds: edges, distances: publicDistances(), frontierNodeIds: nodeIds.filter(id => !settled.has(id) && Number.isFinite(distances[id])) });
  recorder.emit('Initialize the source distance to zero; all other distances are unknown.', state([start]));
  type Entry = { node: string; distance: number }; const heap: Entry[] = [];
  const compare = (a: Entry, b: Entry) => { recorder.tick(); keyComparisons++; return a.distance - b.distance || nodeIds.indexOf(a.node) - nodeIds.indexOf(b.node); };
  function push(entry: Entry) { heap.push(entry); let i = heap.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (compare(heap[p], heap[i]) <= 0) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }
  function pop() { const first = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1; if (child + 1 < heap.length && compare(heap[child + 1], heap[child]) < 0) child++; if (compare(heap[i], heap[child]) <= 0) break; [heap[i], heap[child]] = [heap[child], heap[i]]; i = child; } } return first; }
  let status: ExecutionTrace['status'] = 'completed';
  try {
    recorder.tick(0); if (heapMode) push({ node: start, distance: 0 });
    while (settled.size < nodeIds.length) {
      recorder.tick(); let current: string | undefined;
      if (heapMode) {
        while (heap.length) { const entry = pop(); if (!settled.has(entry.node) && entry.distance === distances[entry.node]) { current = entry.node; break; } recorder.tick(); }
      } else {
        for (const id of nodeIds) { if (settled.has(id)) continue; recorder.tick(); if (current === undefined) current = id; else { recorder.tick(); keyComparisons++; if (distances[id] < distances[current]) current = id; } }
        if (current && !Number.isFinite(distances[current])) current = undefined;
      }
      if (!current) break;
      settled.add(current); recorder.emit(`Settle ${current} at distance ${distances[current]}.`, state([current]));
      for (const edge of adjacency.get(current)!) {
        recorder.tick(); relaxations++;
        if (!settled.has(edge.to) && distances[current] + edge.weight < distances[edge.to]) {
          distances[edge.to] = distances[current] + edge.weight;
          if (heapMode) push({ node: edge.to, distance: distances[edge.to] });
          recorder.emit(`Relax ${current} → ${edge.to}: tentative distance ${distances[edge.to]}.`, state([current, edge.to], [edge.edgeId]));
        } else recorder.emit(`Inspect ${current} → ${edge.to}; no shorter tentative distance.`, state([current], [edge.edgeId]));
      }
    }
    recorder.emit('Shortest-distance computation complete; unreachable vertices remain ∞.', state());
  } catch (error) { if (!(error instanceof Halt)) throw error; status = error.status; if (recorder.steps.length < 9_000) recorder.emit(`Execution ${status}; these are partial results.`, state()); }
  return { status, result: { kind: 'graph', distances: publicDistances() }, metrics: [{ id: 'keyComparisons', value: keyComparisons, unit: 'count' }, { id: 'relaxations', value: relaxations, unit: 'count' }, { id: 'settledNodes', value: settled.size, unit: 'count' }], summary: status === 'completed' ? `${settled.size} reachable vertices settled; ${relaxations} edge relaxation attempts.` : `Computation ${status}; distances are partial.` };
}

type Run = { start: number; end: number };
type Item = { value: number; originalIndex: number };
/** Algorithm 2 NodePower, translated to half-open zero-based intervals. */
export function nodePower(startA: number, endA: number, startB: number, endB: number, length: number): number {
  if (![startA, endA, startB, endB, length].every(Number.isInteger) || startA < 0 || startA >= endA || endA !== startB || startB >= endB || endB > length || length > 256) throw new Error('NodePower requires adjacent nonempty runs in an array of at most 256 items.');
  const denominator = 2 * length; const a = startA + endA; const b = startB + endB;
  for (let power = 1; power <= 12; power++) if (Math.floor(a * 2 ** power / denominator) !== Math.floor(b * 2 ** power / denominator)) return power;
  throw new Error('NodePower failed to separate adjacent midpoints.');
}
function runSort(input: ArrayInput, powersort: boolean, recorder: Recorder): InternalOutput {
  let items: Item[] = input.values.map((value, originalIndex) => ({ value, originalIndex }));
  let comparisons = 0; let mergeCost = 0; let merges = 0;
  const mergeOrder: [number, number, number][] = []; const discovered: Run[] = [];
  const state = (activeIndices: number[] = [], mergeRange?: { start: number; middle: number; end: number }): TraceState => ({ kind: 'array', values: items.map(item => item.value), originalIndices: items.map(item => item.originalIndex), activeIndices, ...(mergeRange ? { mergeRange } : {}), runs: discovered.map(run => ({ ...run })) });
  recorder.emit('Initial array; identities distinguish equal keys.', state());
  const compare = (a: Item, b: Item) => { recorder.tick(); comparisons++; return a.value - b.value; };
  function discover(start: number): Run {
    let end = start + 1;
    if (end < items.length) {
      const descending = compare(items[end], items[start]) < 0;
      end++;
      while (end < items.length) { const order = compare(items[end], items[end - 1]); if (descending ? order >= 0 : order < 0) break; end++; }
      if (descending) { recorder.tick(end - start); items.splice(start, end - start, ...items.slice(start, end).reverse()); }
    }
    const run = { start, end }; discovered.push(run); recorder.emit(`Discover sorted run [${start}, ${end}).`, state(Array.from({ length: end - start }, (_, i) => start + i))); return run;
  }
  function merge(left: Run, right: Run): Run {
    if (left.end !== right.start) throw new Error('Only adjacent runs may be merged.');
    const a = items.slice(left.start, left.end); const b = items.slice(right.start, right.end); const merged: Item[] = []; let i = 0; let j = 0;
    // Compute in a temporary buffer: cancellation cannot leave half-written values/identities.
    while (i < a.length && j < b.length) merged.push(compare(a[i], b[j]) <= 0 ? a[i++] : b[j++]);
    merged.push(...a.slice(i), ...b.slice(j)); recorder.tick(merged.length);
    items.splice(left.start, merged.length, ...merged);
    mergeCost += merged.length; merges++; mergeOrder.push([left.start, right.start, right.end]);
    const first = discovered.findIndex(run => run.start === left.start);
    const last = discovered.findIndex(run => run.end === right.end);
    if (first >= 0 && last >= first) discovered.splice(first, last - first + 1, { start: left.start, end: right.end });
    recorder.emit(`Merge [${left.start}, ${right.start}) with [${right.start}, ${right.end}); cost ${merged.length}.`, state(Array.from({ length: merged.length }, (_, k) => left.start + k), { start: left.start, middle: right.start, end: right.end }));
    return { start: left.start, end: right.end };
  }
  let status: ExecutionTrace['status'] = 'completed';
  try {
    recorder.tick(0);
    if (items.length) {
      let current = discover(0);
      const stack: Array<{ run: Run; power: number }> = [];
      while (current.end < items.length) {
        const next = discover(current.end);
        if (powersort) {
          const power = nodePower(current.start, current.end, next.start, next.end, items.length);
          while (stack.length && stack[stack.length - 1].power > power) current = merge(stack.pop()!.run, current);
          stack.push({ run: current, power }); current = next;
        } else current = merge(current, next);
      }
      while (stack.length) current = merge(stack.pop()!.run, current);
    }
    recorder.emit('Stable sorting complete.', state());
  } catch (error) { if (!(error instanceof Halt)) throw error; status = error.status; if (recorder.steps.length < 9_000) recorder.emit(`Execution ${status}; these are partial results.`, state()); }
  return { status, result: { kind: 'array', values: items.map(item => item.value), originalIndices: items.map(item => item.originalIndex), mergeOrder }, metrics: [{ id: 'comparisons', value: comparisons, unit: 'count' }, { id: 'mergeCost', value: mergeCost, unit: 'items' }, { id: 'merges', value: merges, unit: 'count' }], summary: status === 'completed' ? `${items.length} values stably sorted with ${merges} merges and merge cost ${mergeCost}.` : `Computation ${status}; array is partial.` };
}
