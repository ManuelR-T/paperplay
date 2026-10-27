import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFigureFidelity } from '../lib/fidelity';
import { graphFigureFixture, arrayFigureFixture, walkthroughFixture } from '../shared/fixtures';

function computedFigure(id: string, version = '1.0.0') {
  return { ...structuredClone(arrayFigureFixture), execution: { mode: 'computed', binding: { engineId: id, engineVersion: version, parameters: { operationLimit: 10_000 } } } };
}

test('a model cannot self-issue a scientific verification label', () => {
  const claim = { ...computedFigure('powersort'), fidelity: 'experiment-reproduction' };
  assert.equal(assessFigureFidelity(claim).level, 'simplified-illustration');
  assert.equal(assessFigureFidelity({ ...claim, evidence: { passed: true } }).level, 'simplified-illustration');
});

test('source-linked walkthrough and illustration remain non-executable claims', () => {
  assert.equal(assessFigureFidelity(walkthroughFixture).level, 'illustrative-walkthrough');
  assert.equal(assessFigureFidelity({ ...arrayFigureFixture, controls: [], execution: { mode: 'illustrative' } }).level, 'simplified-illustration');
});

test('exact mechanism evidence never promotes an implementation to experiment reproduction', () => {
  const assessment = assessFigureFidelity(computedFigure('powersort'));
  assert.equal(assessment.level, 'mechanism-reproduction');
  assert.ok(assessment.referenceCaseIds.includes('powersort-merge-order'));
  assert.ok(assessment.limitations.some(text => text.includes('Synthetic')));
  assert.equal(assessFigureFidelity(computedFigure('powersort', '2.0.0')).level, 'simplified-illustration');
  assert.equal(assessFigureFidelity(computedFigure('invented')).level, 'simplified-illustration');
});

test('Dijkstra reference cases cannot certify the functional-tree paper or its original experiments', () => {
  const graph = { ...graphFigureFixture, execution: { mode: 'computed', binding: { engineId: 'dijkstra-heap', engineVersion: '1.0.0', parameters: { operationLimit: 10_000 } } } };
  const assessment = assessFigureFidelity(graph);
  assert.equal(assessment.level, 'simplified-illustration');
  assert.match(assessment.claim, /not implemented/);
});

test('comparison uses the weaker evidence rather than elevating an unverified method', () => {
  if (arrayFigureFixture.kind !== 'array') throw new Error('Invalid fixture');
  const comparison = { schemaVersion: 1, id: 'comparison-policy', kind: 'comparison', title: 'Compare', caption: 'Synthetic comparison',
    sourceAnchorIds: ['array-anchor'], assumptions: [], input: arrayFigureFixture.input,
    runs: [{ label: 'Known', binding: { engineId: 'powersort', engineVersion: '1.0.0', parameters: { operationLimit: 10_000 } } },
      { label: 'Unknown', binding: { engineId: 'unverified', engineVersion: '1.0.0', parameters: { operationLimit: 10_000 } } }],
  };
  assert.equal(assessFigureFidelity(comparison).level, 'simplified-illustration');
});
