import type { SourceDocument } from '../shared/schema';
import type { GeneratedPlan } from '../lib/analysis';

export function analysisSource(method = 'Dijkstra'): SourceDocument {
  return { schemaVersion: 1, id: 'analysis-source', sourceVersion: 'test-v1', title: 'A source-linked algorithm example', authors: ['Test author'], source: { kind: 'pdf' }, pageCount: 1,
    blocks: [{ id: 'method', kind: 'paragraph', page: 1, text: `${method} is the method described in this paragraph. We inspect its state transitions, assumptions and input data to understand the mechanism. This text is a source fixture for grounding verification and is not a reported benchmark or reproduction of an experiment.` }],
    anchors: [{ id: 'original-anchor', blockId: 'method', page: 1, quote: `${method} is the method described in this paragraph.` }], extractionWarnings: [] };
}
export function analysisPlan(source = analysisSource()): GeneratedPlan {
  const text = source.blocks[0].kind === 'paragraph' ? source.blocks[0].text : '';
  return { schemaVersion: 1, summary: 'A conceptual explanation and a synthetic computation.', figures: [{
    id: 'inspect-method', title: 'Inspect the cited mechanism', explanation: 'Compare the tentative states using a small synthetic input.',
    sourceBlockId: 'method', sourcePage: 1, sourceQuote: text.slice(0, 80), kind: 'graph', engineId: 'dijkstra-heap', baselineEngineId: 'none',
    assumptions: ['Synthetic, nonnegative weighted graph.'], steps: [{ label: 'Read', detail: 'Inspect the cited mechanism.' }, { label: 'Explain', detail: 'Review its assumptions without claiming an original benchmark.' }],
    arrayValues: [], matrixValues: [], matrixRhs: [], matrixInitial: [], graphDirected: true, graphSource: 'a', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ id: 'ab', source: 'a', target: 'b', weight: 3 }],
  }] };
}
