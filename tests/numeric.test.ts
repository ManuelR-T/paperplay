import test from 'node:test';
import assert from 'node:assert/strict';
import { algorithmInputSchema, validateSnapshot, validateTrace, validateFigure, type AlgorithmInput } from '../shared/schema';
import { createDefaultInput, engineRegistry, runEngine, runComparison } from '../lib/engines';
import { createPreparedExperiment, createPreparedFigures } from '../lib/prepared-figures';
import { numericPaper } from '../data/numeric-paper';
import { compileAnalysisPlan, type GeneratedPlan } from '../lib/analysis';
import { prepareQuestionContext } from '../lib/questions';

const diagonal: Extract<AlgorithmInput, { kind: 'matrix' }> = { kind: 'matrix', matrix: [[1, 0], [0, 4]], rhs: [1, 4], initial: [4, -3] };
const close = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('gradient descent matches the independent diagonal closed form at every observed iteration', () => {
  const before = structuredClone(diagonal);
  const run = runEngine('gradient-descent', diagonal, { parameters: { iterations: 10, stepSize: 0.2 } });
  assert.deepEqual(diagonal, before);
  assert.equal(run.trace.steps.length, 11);
  for (const step of run.trace.steps) {
    assert.equal(step.state.kind, 'matrix'); if (step.state.kind !== 'matrix') continue;
    const k = step.state.iteration;
    close(step.state.values[0], 1 + 3 * 0.8 ** k);
    close(step.state.values[1], 1 - 4 * 0.2 ** k);
    close(step.state.residual, Math.hypot(step.state.values[0] - 1, 4 * step.state.values[1] - 4));
    assert.equal(step.state.history.length, k + 1);
  }
  validateTrace(run.trace, engineRegistry);
  assert.equal(run.trace.status, 'completed');
  assert.equal(run.result.kind === 'matrix' && run.result.converged, false, 'A completed finite trajectory must not pretend tolerance was reached.');
});

test('both numerical engines approach an independent exact SPD linear-system solution', () => {
  const input = { kind: 'matrix' as const, matrix: [[4, 1], [1, 3]], rhs: [1, 2], initial: [] };
  for (const engine of ['gradient-descent', 'heavy-ball']) {
    const run = runEngine(engine, input, { parameters: { iterations: 200, stepSize: 0.1 } });
    assert.equal(run.result.kind, 'matrix'); if (run.result.kind !== 'matrix') continue;
    close(run.result.values[0], 1 / 11, 1e-8); close(run.result.values[1], 7 / 11, 1e-8);
    assert.ok(run.result.residual <= 1e-8); assert.equal(run.result.converged, true);
    assert.equal(run.trace.status, 'completed');
  }
});

test('heavy-ball follows the cited recurrence and beta zero reduces exactly to gradient descent', () => {
  const gd = runEngine('gradient-descent', diagonal, { parameters: { iterations: 12, stepSize: 0.2 } });
  const zero = runEngine('heavy-ball', diagonal, { parameters: { iterations: 12, stepSize: 0.2, momentum: 0 } });
  assert.deepEqual(zero.trace.steps.map(step => step.state), gd.trace.steps.map(step => step.state));
  const run = runEngine('heavy-ball', diagonal, { parameters: { iterations: 12, stepSize: 0.2, momentum: 0.6 } });
  let x = [...diagonal.initial]; let z = [0, 0];
  for (const step of run.trace.steps) {
    if (step.state.kind !== 'matrix') continue;
    if (step.index) {
      z = z.map((old, i) => 0.6 * old + diagonal.matrix[i][i] * x[i] - diagonal.rhs[i]);
      x = x.map((old, i) => old - 0.2 * z[i]);
    }
    x.forEach((value, i) => close(step.state.kind === 'matrix' ? step.state.values[i] : NaN, value));
  }
});

test('numeric domains, unstable settings, missing dimensions and non-SPD matrices fail before execution', () => {
  for (const input of [
    { ...diagonal, matrix: [[1, 2], [0, 1]] }, { ...diagonal, matrix: [[1, 2], [2, 1]] },
    { ...diagonal, matrix: [[1, 0], [0, 0]] }, { ...diagonal, matrix: [[1], [0]] },
    { ...diagonal, rhs: [1] }, { ...diagonal, initial: [1] },
    { ...diagonal, matrix: [[Infinity]] }, { ...diagonal, matrix: Array.from({ length: 9 }, () => Array(9).fill(0)), rhs: Array(9).fill(1), initial: [] },
  ]) assert.throws(() => runEngine('gradient-descent', input as typeof diagonal));
  assert.throws(() => runEngine('gradient-descent', diagonal, { parameters: { stepSize: 1 } }), /stability/);
  assert.throws(() => runEngine('heavy-ball', diagonal, { parameters: { momentum: 1 } }), /parameter/);
  assert.throws(() => runEngine('gradient-descent', diagonal, { parameters: { iterations: 201 } }), /parameter/);
});

test('cancellation and operation ceilings preserve bounded honest numeric traces', () => {
  const limited = runEngine('gradient-descent', diagonal, { operationLimit: 1 });
  assert.equal(limited.trace.status, 'limit-reached'); assert.equal(limited.trace.steps.length, 1);
  const abort = new AbortController(); abort.abort();
  const cancelled = runEngine('heavy-ball', diagonal, { signal: abort.signal });
  assert.equal(cancelled.trace.status, 'cancelled'); assert.equal(cancelled.trace.steps.length, 1);
  validateTrace(cancelled.trace, engineRegistry);
  const tampered = structuredClone(limited.trace); if (tampered.steps[0].state.kind === 'matrix') tampered.steps[0].state.residual += 1;
  assert.throws(() => validateTrace(tampered, engineRegistry), /residual/);
});

test('the real licensed third source exercises matrix, convergence and comparison through shared contracts', () => {
  const state = createPreparedExperiment(numericPaper);
  assert.equal(state.input.kind, 'matrix');
  assert.deepEqual(createDefaultInput('matrix', 42), createDefaultInput('matrix', 42));
  const figures = createPreparedFigures(numericPaper, state);
  assert.equal(figures.primary.kind, 'matrix'); assert.equal(figures.walkthrough.kind, 'plot');
  for (const figure of Object.values(figures)) {
    validateFigure(figure, numericPaper.document, engineRegistry);
    validateSnapshot({ schemaVersion: 1, documentId: numericPaper.document.id, sourceVersion: numericPaper.document.sourceVersion, figure, seed: state.seed }, numericPaper.document, engineRegistry);
  }
  const comparison = runComparison(['gradient-descent', 'heavy-ball'], state.input, { seed: 42, parameters: state.parameters });
  assert.equal(comparison.runs.length, 2); assert.ok(comparison.commonMetrics.some(metric => metric.id === 'residual'));
  assert.throws(() => runComparison(['powersort', 'gradient-descent'], state.input), /Incompatible/);
});

function numericPlan(): GeneratedPlan {
  const block = numericPaper.document.blocks.find(item => item.id === 'q-gradient')!;
  const quote = block.kind === 'equation' ? block.latex : '';
  return { schemaVersion: 1, summary: 'A computed synthetic quadratic example.', figures: [{ id: 'quadratic-residual', title: 'Residual convergence', explanation: 'Follow actual residual norms on a small synthetic SPD system.', sourceBlockId: block.id, sourcePage: 1, sourceQuote: quote,
    kind: 'plot', engineId: 'gradient-descent', baselineEngineId: 'none', assumptions: ['Synthetic SPD system, not the article dataset.'], steps: [{ label: 'Form the gradient', detail: 'Evaluate Ax−b.' }, { label: 'Update', detail: 'Subtract a stable step in the gradient direction.' }],
    arrayValues: [], graphDirected: false, graphSource: '', nodes: [], edges: [], matrixValues: diagonal.matrix, matrixRhs: diagonal.rhs, matrixInitial: diagonal.initial }] };
}
test('Meta planning and contextual questions use grounded numeric figures and recomputed residual state', () => {
  const result = compileAnalysisPlan(numericPlan(), numericPaper.document, 'fixture-model');
  assert.equal(result.figures[0].figure.kind, 'plot');
  const context = prepareQuestionContext({ source: result.document, blockId: 'q-gradient', figure: result.figures[0].figure, stepIndex: 2 });
  assert.equal(context.runs.length, 1); assert.equal(context.runs[0].selectedStep.state.kind, 'matrix');
  const bad = numericPlan(); bad.figures[0].engineId = 'none';
  const fallback = compileAnalysisPlan(bad, numericPaper.document, 'fixture-model');
  assert.equal(fallback.figures[0].figure.kind, 'steps'); assert.match(fallback.warnings[0], /convergence/);
});
