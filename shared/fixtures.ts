/** Structural examples, not real research papers or implemented algorithms. */
import type { EngineCapability, ExecutionTrace, FigureSpecification, SourceDocument } from './schema';

export const sourceFixture: SourceDocument = {
  schemaVersion: 1,
  id: 'contract-example',
  sourceVersion: 'fixture-1',
  title: 'Synthetic source for contract validation',
  authors: ['Paperplay contract fixtures'],
  source: { kind: 'prepared' },
  pageCount: 2,
  blocks: [
    { id: 'heading', kind: 'heading', page: 1, text: 'Example mechanisms', level: 1 },
    { id: 'graph-passage', kind: 'paragraph', page: 1, sectionId: 'heading', text: 'Visit the graph nodes in an ordered sequence.' },
    { id: 'array-passage', kind: 'paragraph', page: 2, sectionId: 'heading', text: 'Compare the array values before exchanging adjacent items.' },
    { id: 'equation', kind: 'equation', page: 2, sectionId: 'heading', latex: 'f(x) = x^2', label: '1' },
    { id: 'original-figure', kind: 'original-figure', page: 2, sectionId: 'heading', caption: 'A synthetic array with three values.', alt: 'Values 3, 1, 2.' },
  ],
  anchors: [
    { id: 'graph-anchor', blockId: 'graph-passage', page: 1, quote: 'Visit the graph nodes' },
    { id: 'array-anchor', blockId: 'array-passage', page: 2, quote: 'Compare the array values' },
  ],
  extractionWarnings: [],
};
const parameter = { key: 'limit', label: 'Operation limit', min: 1, max: 100, step: 1, initial: 10 };
export const graphEngineFixture: EngineCapability = {
  id: 'fixture.graph', version: '1.0.0', inputKind: 'graph', figureKinds: ['graph', 'comparison'],
  parameters: [parameter], comparisonGroup: 'graph-visit', metrics: [{ id: 'operations', label: 'Operations', unit: 'count' }],
};
export const arrayEngineFixture: EngineCapability = {
  id: 'fixture.array', version: '1.0.0', inputKind: 'array', figureKinds: ['array', 'comparison'],
  parameters: [parameter], comparisonGroup: 'array-order', metrics: [{ id: 'operations', label: 'Operations', unit: 'count' }],
};
export const registryFixture = [graphEngineFixture, arrayEngineFixture];
export const graphFigureFixture: FigureSpecification = {
  schemaVersion: 1, id: 'graph-figure', kind: 'graph', title: 'Visit a graph', caption: 'Structural fixture, not a verified experiment.',
  sourceAnchorIds: ['graph-anchor'], assumptions: ['The graph is synthetic.'],
  input: { kind: 'graph', directed: true, nodeRoles: { start: 'a', target: 'b' }, nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ id: 'ab', source: 'a', target: 'b', weight: 1 }] },
  controls: [parameter], execution: { mode: 'computed', binding: { engineId: graphEngineFixture.id, engineVersion: graphEngineFixture.version, parameters: { limit: 10 } } },
};
export const arrayFigureFixture: FigureSpecification = {
  schemaVersion: 1, id: 'array-figure', kind: 'array', title: 'Inspect an array', caption: 'Structural fixture, not a verified experiment.',
  sourceAnchorIds: ['array-anchor'], assumptions: ['The values are synthetic.'],
  input: { kind: 'array', values: [3, 1, 2] }, controls: [parameter],
  execution: { mode: 'computed', binding: { engineId: arrayEngineFixture.id, engineVersion: arrayEngineFixture.version, parameters: { limit: 10 } } },
};
export const walkthroughFixture: FigureSpecification = {
  schemaVersion: 1, id: 'walkthrough', kind: 'steps', title: 'Understand a method', caption: 'An illustrative walkthrough; no algorithm has run.',
  sourceAnchorIds: ['array-anchor'], assumptions: ['This is a conceptual description.'],
  steps: [{ label: 'Inspect', detail: 'Compare the supplied values.' }, { label: 'Explain', detail: 'Describe the next exchange without claiming an executed result.' }],
};
export const traceFixture: ExecutionTrace = {
  schemaVersion: 1, kind: 'computed-trace', binding: { engineId: 'fixture.array', engineVersion: '1.0.0', parameters: { limit: 10 } },
  seed: 42, input: { kind: 'array', values: [3, 1, 2] }, status: 'completed',
  steps: [
    { index: 0, operations: 0, description: 'Initial values', state: { kind: 'array', values: [3, 1, 2], activeIndices: [] } },
    { index: 1, operations: 1, description: 'Inspect first pair', state: { kind: 'array', values: [3, 1, 2], activeIndices: [0, 1] } },
  ],
  metrics: [{ id: 'operations', value: 1, unit: 'count' }],
};
