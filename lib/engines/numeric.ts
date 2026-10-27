import type { AlgorithmInput, ExecutionTrace } from '../../shared/schema';

export type MatrixInput = Extract<AlgorithmInput, { kind: 'matrix' }>;
export type NumericResult = { kind: 'matrix'; values: number[]; residual: number; converged: boolean };
type State = Extract<ExecutionTrace['steps'][number]['state'], { kind: 'matrix' }>;
export const numericParameters = [
  { key: 'operationLimit', label: 'Operation limit', min: 1, max: 50_000, step: 1, initial: 10_000 },
  { key: 'iterations', label: 'Maximum iterations', min: 1, max: 200, step: 1, initial: 100 },
  { key: 'stepSize', label: 'Step size α', min: 0.001, max: 1, step: 0.001, initial: 0.2 },
];
export const momentumParameter = { key: 'momentum', label: 'Momentum β', min: 0, max: 0.99, step: 0.01, initial: 0.6 };
export const numericMetrics = [
  { id: 'iterations', label: 'Completed updates', unit: 'count' },
  { id: 'matrixProducts', label: 'Matrix-vector products', unit: 'count' },
  { id: 'residual', label: 'Final residual ‖Ax−b‖₂', unit: 'norm' },
];
export const NUMERIC_TOLERANCE = 1e-8;
/** A conservative matrix row-sum bound avoids silently accepting unstable teaching settings. */
export function inspectPositiveDefinite(input: MatrixInput) {
  const n = input.matrix.length;
  const scale = Math.max(1, ...input.matrix.flat().map(Math.abs));
  const lower = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    if (Math.abs(input.matrix[i][j] - input.matrix[j][i]) > scale * 1e-12) throw new Error('The optimization engine requires a symmetric positive definite matrix.');
    let value = input.matrix[i][j];
    for (let k = 0; k < j; k++) value -= lower[i][k] * lower[j][k];
    if (i === j) {
      if (!(value > scale * 1e-12)) throw new Error('The optimization engine requires a numerically positive definite matrix.');
      lower[i][j] = Math.sqrt(value);
    } else lower[i][j] = value / lower[j][j];
  }
  return { curvatureBound: Math.max(...input.matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value), 0))) };
}
export function runNumeric(input: MatrixInput, momentum: boolean, parameters: Record<string, number>, signal?: AbortSignal) {
  const n = input.matrix.length;
  const { curvatureBound } = inspectPositiveDefinite(input);
  const beta = momentum ? parameters.momentum : 0;
  if (parameters.stepSize * curvatureBound >= 2 * (1 + beta)) throw new Error('This step size is outside the conservative stability bound. Reduce α or the matrix curvature.');
  let values = input.initial.length ? [...input.initial] : Array<number>(n).fill(0);
  let velocity = Array<number>(n).fill(0);
  let products = 0; let operations = 0; let iteration = 0;
  const budget = parameters.operationLimit;
  const steps: ExecutionTrace['steps'] = [];
  const history: State['history'] = [];
  let status: ExecutionTrace['status'] = 'completed';
  const gradient = () => {
    products++;
    return input.matrix.map((row, i) => row.reduce((sum, value, j) => sum + value * values[j], 0) - input.rhs[i]);
  };
  let g = gradient();
  let residual = Math.hypot(...g);
  const emit = (description: string) => {
    history.push({ iteration, residual });
    const state: State = { kind: 'matrix', values: [...values], residual, iteration, history: structuredClone(history) };
    steps.push({ index: steps.length, operations, description, state });
  };
  emit('Initial synthetic iterate. Residual is computed from the supplied matrix and RHS.');
  for (let count = 0; count < parameters.iterations && residual > NUMERIC_TOLERANCE; count++) {
    if (signal?.aborted) { status = 'cancelled'; break; }
    // Count one dense matrix-vector product plus vector-update arithmetic per update.
    const cost = n * n + 3 * n;
    if (operations + cost > budget) { status = 'limit-reached'; break; }
    const nextVelocity = g.map((value, i) => beta * velocity[i] + value);
    const next = values.map((value, i) => value - parameters.stepSize * nextVelocity[i]);
    if (next.some(value => !Number.isFinite(value) || Math.abs(value) > 1e100)) throw new Error('The bounded numeric trajectory overflowed; reduce the step size.');
    values = next; velocity = nextVelocity; iteration++; operations += cost;
    g = gradient(); residual = Math.hypot(...g);
    if (!Number.isFinite(residual)) throw new Error('The numeric residual is not finite.');
    emit(`Update ${iteration}: residual norm ${residual.toPrecision(5)} on synthetic input.`);
  }
  if (signal?.aborted) status = 'cancelled';
  const converged = residual <= NUMERIC_TOLERANCE;
  const result: NumericResult = { kind: 'matrix', values, residual, converged };
  return { status, steps, result, metrics: [
    { id: 'iterations', value: iteration, unit: 'count' }, { id: 'matrixProducts', value: products, unit: 'count' }, { id: 'residual', value: residual, unit: 'norm' },
  ], summary: `${iteration} synthetic updates; residual ${residual.toPrecision(5)}. ${converged ? 'The 1e−8 residual tolerance was reached.' : status === 'completed' ? 'The configured iteration count finished; tolerance was not reached.' : 'Computation stopped before the configured iteration count.'}` };
}
