import { validateFigure, type AlgorithmInput, type FigureSpecification, type SourceDocument } from '@/shared/schema';
import { createDefaultInput, engineMetadata, engineRegistry } from '@/lib/engines';

export type PreparedExperimentState = { input: AlgorithmInput; seed: number; engineId: string; parameters: Record<string, number> };
type PaperSource = { id: string; document: SourceDocument; illustrationAnchors: { primary: string; comparison: string; walkthrough: string } };

/** Contributor extension seam: a source preset selects a registered engine/input family. */
export const preparedExperimentPresets: Record<string, { family: AlgorithmInput['kind']; engineId: string }> = {
  'priority-search-trees': { family: 'graph', engineId: 'dijkstra-heap' },
  'adaptive-mergesort': { family: 'array', engineId: 'powersort' },
  'quadratic-optimization': { family: 'matrix', engineId: 'gradient-descent' },
};
export function createPreparedExperiment(paper: Pick<PaperSource, 'id'>): PreparedExperimentState {
  const preset = preparedExperimentPresets[paper.id];
  if (!preset) throw new Error('No prepared experiment is registered for this source.');
  const engine = engineRegistry.find(item => item.id === preset.engineId);
  if (!engine) throw new Error('The prepared execution engine is unavailable.');
  return { input: createDefaultInput(preset.family, 42), seed: 42, engineId: engine.id, parameters: Object.fromEntries(engine.parameters.map(parameter => [parameter.key, parameter.initial])) };
}

export function createEngineFigure(document: SourceDocument, id: string, anchorId: string, state: PreparedExperimentState): FigureSpecification {
  const capability = engineRegistry.find(engine => engine.id === state.engineId);
  if (!capability) throw new Error('The selected engine is unavailable.');
  const base = { schemaVersion: 1 as const, id, title: engineMetadata[state.engineId].name, caption: 'A prepared source-linked experiment with deterministic synthetic inputs.', sourceAnchorIds: [anchorId], assumptions: engineMetadata[state.engineId].limitations,
    controls: capability.parameters.map(parameter => ({ ...parameter, initial: state.parameters[parameter.key] })), execution: { mode: 'computed' as const, binding: { engineId: state.engineId, engineVersion: capability.version, parameters: state.parameters } } };
  return validateFigure({ ...base, kind: state.input.kind, input: state.input }, document, engineRegistry);
}

export function createComparisonFigure(document: SourceDocument, id: string, anchorId: string, state: PreparedExperimentState): Extract<FigureSpecification, { kind: 'comparison' }> {
  const selected = engineRegistry.find(engine => engine.id === state.engineId);
  if (!selected) throw new Error('The selected engine is unavailable.');
  const candidates = engineRegistry.filter(engine => engine.inputKind === state.input.kind && engine.comparisonGroup === selected.comparisonGroup);
  if (candidates.length < 2) throw new Error('No compatible baseline is registered for this method.');
  const figure = validateFigure({ schemaVersion: 1, id, kind: 'comparison', title: 'Compare compatible methods', caption: 'Both methods receive exactly the same synthetic input and seed.', sourceAnchorIds: [anchorId], assumptions: ['Counts come from these TypeScript implementations, not the paper’s original hardware experiment.'], input: state.input,
    runs: candidates.map(engine => ({ label: engineMetadata[engine.id].name, binding: { engineId: engine.id, engineVersion: engine.version, parameters: Object.fromEntries(engine.parameters.map(parameter => [parameter.key, state.parameters[parameter.key] ?? parameter.initial])) } })) }, document, engineRegistry);
  if (figure.kind !== 'comparison') throw new Error('Unexpected comparison contract.');
  return figure;
}

export function createWalkthroughFigure(document: SourceDocument, id: string, anchorId: string, family: AlgorithmInput['kind']): Extract<FigureSpecification, { kind: 'steps' }> {
  const steps = family === 'matrix' ? [
    { label: 'Describe curvature', detail: 'The synthetic SPD matrix A and vector b define a convex quadratic with gradient Ax−b.' },
    { label: 'Update an iterate', detail: 'Gradient descent subtracts α times the gradient. Heavy-ball momentum additionally carries a decaying velocity from earlier updates.' },
    { label: 'Inspect actual residuals', detail: 'The plot records computed residual norms for these synthetic inputs; finite iterations do not reproduce the paper’s experiments or prove a general acceleration claim.' },
  ] : family === 'graph' ? [
    { label: 'Associate priorities', detail: 'A priority map associates graph vertices with tentative distance information.' },
    { label: 'Inspect a minimum', detail: 'The shortest-distance application repeatedly inspects an entry with minimal tentative distance.' },
    { label: 'Update information', detail: 'A better candidate distance changes the corresponding priority. This conceptual sequence does not implement the functional priority search tree or its proof.' },
  ] : [
    { label: 'Recognize existing order', detail: 'Consecutive sorted runs provide structure that an adaptive sorting method can exploit.' },
    { label: 'Choose a merge order', detail: 'Different orders for merging adjacent runs lead to different accumulated merge costs.' },
    { label: 'Separate mechanism and experiment', detail: 'A merge-order simulation does not reproduce a full Java runtime benchmark, cache behavior or the paper’s original hardware.' },
  ];
  const figure = validateFigure({ schemaVersion: 1, id, kind: 'steps', title: 'A conceptual reading guide', caption: 'Prepared explanation anchored to the source. No algorithm is executed in this figure.', sourceAnchorIds: [anchorId], assumptions: ['This figure is a conceptual walkthrough, not an execution trace.'], steps }, document, engineRegistry);
  if (figure.kind !== 'steps') throw new Error('Unexpected walkthrough contract.');
  return figure;
}

export function createConvergenceFigure(document: SourceDocument, id: string, anchorId: string, state: PreparedExperimentState): FigureSpecification {
  if (state.input.kind !== 'matrix') throw new Error('Convergence plots require a matrix optimization input.');
  const primary = createEngineFigure(document, id, anchorId, state);
  return validateFigure({ ...primary, kind: 'plot', title: 'Computed residual convergence', caption: 'Actual residual norms from the configured finite synthetic trajectory, not source-reported experimental measurements.' }, document, engineRegistry);
}
export function createPreparedFigures(paper: PaperSource, state = createPreparedExperiment(paper)) {
  return {
    primary: createEngineFigure(paper.document, `${paper.id}-primary`, paper.illustrationAnchors.primary, state),
    comparison: createComparisonFigure(paper.document, `${paper.id}-comparison`, paper.illustrationAnchors.comparison, state),
    walkthrough: state.input.kind === 'matrix'
      ? createConvergenceFigure(paper.document, `${paper.id}-walkthrough`, paper.illustrationAnchors.walkthrough, state)
      : createWalkthroughFigure(paper.document, `${paper.id}-walkthrough`, paper.illustrationAnchors.walkthrough, state.input.kind),
  };
}
