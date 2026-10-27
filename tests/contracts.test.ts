import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceFixture, graphFigureFixture, arrayFigureFixture, walkthroughFixture, registryFixture, traceFixture, graphEngineFixture } from '../shared/fixtures';
import { validateDocument, validateFigure, validateTrace, validateSnapshot, figureSpecificationSchema } from '../shared/schema';

const clone = <T>(value: T): T => structuredClone(value);

test('one versioned envelope supports graph, array, original equations/figures and illustrative steps', () => {
  const source = validateDocument(sourceFixture);
  for (const figure of [graphFigureFixture, arrayFigureFixture, walkthroughFixture]) {
    assert.equal(validateFigure(figure, source, registryFixture).id, figure.id);
  }
  assert.equal(source.blocks.find(block => block.kind === 'equation')?.kind, 'equation');
});

test('anchors accept normalized whitespace but reject absent quotes, wrong pages and references', () => {
  const source = clone(sourceFixture);
  source.anchors[0].quote = 'Visit  the\ngraph nodes';
  assert.doesNotThrow(() => validateDocument(source));
  source.anchors[0].quote = 'A claim not in the source';
  assert.throws(() => validateDocument(source), /Quote not found/);
  source.anchors[0] = { ...sourceFixture.anchors[0], page: 2 };
  assert.throws(() => validateDocument(source), /Wrong source page/);
  source.anchors[0] = { ...sourceFixture.anchors[0], blockId: 'missing' };
  assert.throws(() => validateDocument(source), /Unknown source block/);
});

test('duplicate source identifiers, out-of-range pages and invalid section references are rejected', () => {
  const source = clone(sourceFixture);
  source.blocks.push(clone(source.blocks[0]));
  assert.throws(() => validateDocument(source), /Duplicate source block/);
  source.blocks.pop();
  source.anchors.push(clone(source.anchors[0]));
  assert.throws(() => validateDocument(source), /Duplicate source anchor/);
  source.anchors.pop();
  source.blocks[0].page = 3;
  assert.throws(() => validateDocument(source), /exceeds page count/);
  source.blocks[0].page = 1;
  source.blocks[1].sectionId = 'equation';
  assert.throws(() => validateDocument(source), /Invalid section reference/);
});

test('source URLs cannot contain executable schemes', () => {
  const source = clone(sourceFixture);
  source.source.url = 'javascript:alert(1)';
  assert.throws(() => validateDocument(source), /HTTP/);
});

test('unknown figure types, versions and model-supplied fidelity labels are rejected', () => {
  assert.equal(figureSpecificationSchema.safeParse({ ...graphFigureFixture, kind: 'generated-code' }).success, false);
  assert.equal(figureSpecificationSchema.safeParse({ ...graphFigureFixture, schemaVersion: 2 }).success, false);
  assert.equal(figureSpecificationSchema.safeParse({ ...graphFigureFixture, fidelity: 'experiment-reproduction' }).success, false);
});

test('figures reject invented source anchors and graph endpoints', () => {
  assert.throws(() => validateFigure({ ...graphFigureFixture, sourceAnchorIds: ['invented'] }, sourceFixture, registryFixture), /Unknown figure source anchor/);
  if (graphFigureFixture.kind !== 'graph') throw new Error('Invalid fixture');
  const graph = clone(graphFigureFixture);
  graph.input.edges[0].target = 'unknown';
  assert.throws(() => validateFigure(graph, sourceFixture, registryFixture), /Unknown endpoint/);
  graph.input.edges[0].target = 'b';
  graph.input.nodes.push(clone(graph.input.nodes[0]));
  assert.throws(() => validateFigure(graph, sourceFixture, registryFixture), /Duplicate graph node/);
});

test('engine versions, input kinds, parameter bounds and defaults are enforced', () => {
  if (arrayFigureFixture.kind !== 'array' || arrayFigureFixture.execution.mode !== 'computed') throw new Error('Invalid fixture');
  const figure = clone(arrayFigureFixture);
  if (figure.execution.mode !== 'computed') throw new Error('Invalid fixture');
  figure.execution.binding.engineVersion = '2.0.0';
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /incompatible engine/);
  figure.execution.binding.engineVersion = '1.0.0';
  figure.execution.binding.engineId = 'fixture.graph';
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /does not support/);
  figure.execution.binding.engineId = 'fixture.array';
  figure.execution.binding.parameters.limit = 101;
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /outside bounds/);
  figure.execution.binding.parameters = {};
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /Missing engine parameter/);
  figure.execution.binding.parameters = { limit: 10, hidden: 2 };
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /Unknown engine parameter/);
});

test('figure controls cannot exceed registered bounds or disagree with the execution', () => {
  if (arrayFigureFixture.kind !== 'array') throw new Error('Invalid fixture');
  const figure = clone(arrayFigureFixture);
  figure.controls[0].max = 101;
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /exceeds engine capability/);
  figure.controls[0].max = 100;
  figure.controls[0].initial = 11;
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /differs from bound parameter/);
  figure.execution = { mode: 'illustrative' };
  assert.throws(() => validateFigure(figure, sourceFixture, registryFixture), /cannot expose executable/);
});

test('comparisons require compatible engines, input and metric units', () => {
  if (graphFigureFixture.kind !== 'graph' || graphFigureFixture.execution.mode !== 'computed') throw new Error('Invalid fixture');
  const baseline = { ...clone(graphEngineFixture), id: 'fixture.baseline' };
  const registry = [...registryFixture, baseline];
  const figure = {
    schemaVersion: 1, id: 'comparison', kind: 'comparison', title: 'Compare graph runs', caption: 'Two compatible fixtures.',
    sourceAnchorIds: ['graph-anchor'], assumptions: [], input: graphFigureFixture.input,
    runs: [
      { label: 'Candidate', binding: graphFigureFixture.execution.binding },
      { label: 'Baseline', binding: { ...graphFigureFixture.execution.binding, engineId: baseline.id } },
    ],
  };
  assert.equal(validateFigure(figure, sourceFixture, registry).kind, 'comparison');
  baseline.comparisonGroup = 'different-objective';
  assert.throws(() => validateFigure(figure, sourceFixture, registry), /Incompatible comparison groups/);
  baseline.comparisonGroup = graphEngineFixture.comparisonGroup;
  baseline.metrics[0].unit = 'milliseconds';
  assert.throws(() => validateFigure(figure, sourceFixture, registry), /Incompatible metric unit/);
});

test('computed trace steps have contiguous indexes and monotonic operation counts', () => {
  assert.equal(validateTrace(traceFixture, registryFixture).steps.length, 2);
  const trace = clone(traceFixture);
  trace.steps[1].index = 4;
  assert.throws(() => validateTrace(trace, registryFixture), /contiguous/);
  trace.steps[1].index = 1;
  trace.steps[0].operations = 2;
  assert.throws(() => validateTrace(trace, registryFixture), /monotonic/);
});

test('computed trace state references and metric units are verified', () => {
  const trace = clone(traceFixture);
  if (trace.steps[1].state.kind !== 'array') throw new Error('Invalid fixture');
  trace.steps[1].state.activeIndices = [3];
  assert.throws(() => validateTrace(trace, registryFixture), /outside state bounds/);
  trace.steps[1].state.activeIndices = [0];
  trace.metrics[0].unit = 'seconds';
  assert.throws(() => validateTrace(trace, registryFixture), /Undeclared trace metric/);
});

test('snapshots retain source and engine compatibility and reject arbitrary payload fields', () => {
  const snapshot = { schemaVersion: 1, documentId: sourceFixture.id, sourceVersion: sourceFixture.sourceVersion, figure: arrayFigureFixture, seed: 42 };
  assert.equal(validateSnapshot(snapshot, sourceFixture, registryFixture).seed, 42);
  assert.throws(() => validateSnapshot({ ...snapshot, sourceVersion: 'changed' }, sourceFixture, registryFixture), /source\/version/);
  assert.throws(() => validateSnapshot({ ...snapshot, schemaVersion: 2 }, sourceFixture, registryFixture));
  assert.throws(() => validateSnapshot({ ...snapshot, script: 'arbitrary code' }, sourceFixture, registryFixture));
});

test('generic inputs retain empty-array and negative-weight cases without imposing Dijkstra on all graphs', () => {
  const array = clone(arrayFigureFixture);
  if (array.kind !== 'array') throw new Error('Invalid fixture');
  array.input.values = [];
  assert.deepEqual(validateFigure(array, sourceFixture, registryFixture).kind, 'array');
  const graph = clone(graphFigureFixture);
  if (graph.kind !== 'graph') throw new Error('Invalid fixture');
  graph.input.edges[0].weight = -2;
  assert.equal(validateFigure(graph, sourceFixture, registryFixture).kind, 'graph');
  // Actual engine implementations must validate their own preconditions before execution.
  graph.input.edges[0].weight = Number.POSITIVE_INFINITY;
  assert.throws(() => validateFigure(graph, sourceFixture, registryFixture));
});
