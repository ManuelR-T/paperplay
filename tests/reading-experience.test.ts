import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedPapers } from '../data/papers';
import { createPreparedExperiment, createPreparedFigures } from '../lib/prepared-figures';
import { engineRegistry, runComparison, runEngine } from '../lib/engines';
import { assessFigureFidelity } from '../lib/fidelity';
import { validateFigure, validateTrace } from '../shared/schema';

test('three real prepared sources compose the same source/figure/engine pipeline', () => {
  assert.equal(preparedPapers.length, 3);
  const kinds = new Set<string>();
  for (const paper of preparedPapers) {
    const initial = createPreparedExperiment(paper);
    const figures = createPreparedFigures(paper, initial);
    kinds.add(figures.primary.kind);
    for (const figure of Object.values(figures)) {
      validateFigure(figure, paper.document, engineRegistry);
      for (const anchorId of figure.sourceAnchorIds) {
        const anchor = paper.document.anchors.find(item => item.id === anchorId);
        assert.ok(anchor);
        assert.ok(paper.document.blocks.some(block => block.id === anchor.blockId));
      }
      assert.notEqual(assessFigureFidelity(figure).level, 'experiment-reproduction');
    }
    const run = runEngine(initial.engineId, initial.input, initial);
    assert.equal(run.trace.status, 'completed');
    validateTrace(run.trace, engineRegistry);
    const comparison = runComparison(figures.comparison.runs.map(item => item.binding.engineId), initial.input, initial);
    assert.equal(comparison.runs.length, 2);
    assert.ok(comparison.runs.every(item => item.trace.status === 'completed'));
    assert.equal(assessFigureFidelity(figures.walkthrough).level, figures.walkthrough.kind === 'steps' ? 'illustrative-walkthrough' : 'mechanism-reproduction');
    assert.deepEqual(createPreparedExperiment(paper), initial);
  }
  assert.deepEqual([...kinds].sort(), ['array', 'graph', 'matrix']);
});

test('a broken source anchor cannot be attached to an arbitrary source passage', () => {
  const paper = structuredClone(preparedPapers[0]);
  paper.illustrationAnchors.primary = 'absent-anchor';
  assert.throws(() => createPreparedFigures(paper), /Unknown figure source anchor/);
});

test('parameter edits invalidate the old specification and remain bounded by the registered engine', () => {
  const paper = preparedPapers[0];
  const state = createPreparedExperiment(paper);
  const initial = createPreparedFigures(paper, state);
  state.parameters.operationLimit = 1;
  const limited = createPreparedFigures(paper, state);
  assert.notDeepEqual(limited.primary, initial.primary);
  assert.equal(runEngine(state.engineId, state.input, state).trace.status, 'limit-reached');
  state.parameters.operationLimit = 50_001;
  assert.throws(() => createPreparedFigures(paper, state));
});

test('mechanism evidence cannot elevate an invalid engine binding or a different input kind', () => {
  const paper = preparedPapers[1];
  const figure = createPreparedFigures(paper).primary;
  assert.equal(assessFigureFidelity(figure).level, 'mechanism-reproduction');
  if (figure.kind !== 'array' || figure.execution.mode !== 'computed') throw new Error('Wrong fixture');
  figure.execution.binding.parameters.operationLimit = 99_999;
  assert.equal(assessFigureFidelity(figure).level, 'simplified-illustration');
});
