import { z } from 'zod';

/** Version the persisted envelope separately from individual execution engines. */
export const CONTRACT_VERSION = 1 as const;
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
const text = z.string().trim().min(1);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const finite = z.number().finite();
const sourceUrl = z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'Only HTTP(S) source URLs are supported');
const page = z.number().int().min(1);
const parameterValues = z.record(id, finite).refine(value => Object.keys(value).length <= 16, 'At most 16 parameters');
const versioned = { schemaVersion: z.literal(CONTRACT_VERSION) };

const sourceBlockBase = { id, page, sectionId: id.optional(), reconstruction: z.strictObject({
  rawText: z.string().max(25_000), regionIds: z.array(id).max(256),
  operations: z.array(z.enum(['join-lines', 'witnessed-dehyphenation', 'heading-detection', 'caption-detection'])).max(4),
  confidence: z.enum(['source-text', 'heuristic']), notice: z.string().max(1000).optional(),
}).optional() };
export const sourceBlockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...sourceBlockBase, kind: z.literal('heading'), text: text.max(500), level: z.number().int().min(1).max(6) }),
  z.strictObject({ ...sourceBlockBase, kind: z.literal('paragraph'), text: text.max(20_000) }),
  z.strictObject({ ...sourceBlockBase, kind: z.literal('equation'), latex: text.max(5_000), label: text.max(100).optional() }),
  z.strictObject({ ...sourceBlockBase, kind: z.literal('original-figure'), caption: text.max(5_000), alt: text.max(1_000), sourceUrl: sourceUrl.optional(), imageUrls: z.array(sourceUrl).max(8).optional(), inlineSvg: z.string().max(256_000).optional(), table: z.strictObject({ rows: z.array(z.strictObject({ cells: z.array(z.strictObject({ text: z.string().max(500), header: z.boolean(), rowSpan: z.number().int().min(1).max(100), colSpan: z.number().int().min(1).max(32) })).max(32) })).max(256) }).optional() }),
]);
export const sourceAnchorSchema = z.strictObject({ id, blockId: id, page, quote: text.max(1_000) });
export const sourceDocumentSchema = z.strictObject({
  ...versioned,
  id,
  sourceVersion: text.max(100),
  title: text.max(500),
  authors: z.array(text.max(200)).min(1).max(100),
  source: z.strictObject({ kind: z.enum(['arxiv', 'pdf', 'prepared']), url: sourceUrl.optional() }),
  pageCount: page.max(500),
  blocks: z.array(sourceBlockSchema).min(1).max(5_000),
  anchors: z.array(sourceAnchorSchema).max(1_000),
  extractionWarnings: z.array(text.max(1_000)).max(100),
  reconstruction: z.strictObject({ version: z.literal('pdf-layout-v3'), pages: z.array(z.strictObject({ page, width: finite.positive(), height: finite.positive().optional(),
    regions: z.array(z.strictObject({ id, text: z.string().max(5000), x: finite, y: finite, width: finite.min(0), height: finite.positive() })).max(500),
    coordinatesComplete: z.boolean(),
  })).max(50) }).optional(),
});
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type SourceAnchor = z.infer<typeof sourceAnchorSchema>;

export const graphInputSchema = z.strictObject({
  kind: z.literal('graph'),
  directed: z.boolean(),
  nodeRoles: z.record(id, id).refine(roles => Object.keys(roles).length <= 16, 'At most 16 node roles').optional(),
  nodes: z.array(z.strictObject({ id, label: text.max(100) })).min(1).max(256),
  edges: z.array(z.strictObject({ id, source: id, target: id, weight: finite.min(-1_000_000).max(1_000_000) })).max(2_048),
});
export const arrayInputSchema = z.strictObject({ kind: z.literal('array'), values: z.array(finite.min(-1_000_000).max(1_000_000)).max(256) });
/** Small dense linear systems; SPD is an executable engine requirement, not an arbitrary matrix requirement. */
export const matrixInputSchema = z.strictObject({
  kind: z.literal('matrix'),
  matrix: z.array(z.array(finite.min(-1_000_000).max(1_000_000)).min(1).max(8)).min(1).max(8),
  rhs: z.array(finite.min(-1_000_000).max(1_000_000)).min(1).max(8),
  initial: z.array(finite.min(-1_000_000).max(1_000_000)).max(8),
}).superRefine((value, ctx) => {
  const n = value.matrix.length;
  if (value.matrix.some(row => row.length !== n) || value.rhs.length !== n || value.initial.length !== 0 && value.initial.length !== n) ctx.addIssue({ code: 'custom', message: 'Matrix must be square with matching RHS/initial vector dimensions.' });
});
export const algorithmInputSchema = z.discriminatedUnion('kind', [graphInputSchema, arrayInputSchema, matrixInputSchema]);
export type AlgorithmInput = z.infer<typeof algorithmInputSchema>;

export const numericParameterSchema = z.strictObject({
  key: id,
  label: text.max(100),
  min: finite,
  max: finite,
  step: finite.positive(),
  initial: finite,
}).superRefine((value, ctx) => {
  if (value.min >= value.max) ctx.addIssue({ code: 'custom', message: 'Parameter min must be less than max' });
  if (value.initial < value.min || value.initial > value.max) ctx.addIssue({ code: 'custom', message: 'Parameter initial value is outside bounds' });
  const steps = (value.initial - value.min) / value.step;
  if (Math.abs(steps - Math.round(steps)) > 1e-7) ctx.addIssue({ code: 'custom', message: 'Initial value must align with parameter step' });
});
export const engineBindingSchema = z.strictObject({ engineId: id, engineVersion: version, parameters: parameterValues });
const executionSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('illustrative') }),
  z.strictObject({ mode: z.literal('computed'), binding: engineBindingSchema }),
]);
const figureBase = {
  ...versioned,
  id,
  title: text.max(200),
  caption: text.max(2_000),
  sourceAnchorIds: z.array(id).min(1).max(16),
  assumptions: z.array(text.max(1_000)).max(16),
};
export const figureSpecificationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...figureBase, kind: z.literal('graph'), input: graphInputSchema, controls: z.array(numericParameterSchema).max(16), execution: executionSchema }),
  z.strictObject({ ...figureBase, kind: z.literal('array'), input: arrayInputSchema, controls: z.array(numericParameterSchema).max(16), execution: executionSchema }),
  z.strictObject({ ...figureBase, kind: z.literal('matrix'), input: matrixInputSchema, controls: z.array(numericParameterSchema).max(16), execution: executionSchema }),
  z.strictObject({ ...figureBase, kind: z.literal('plot'), input: matrixInputSchema, controls: z.array(numericParameterSchema).max(16), execution: executionSchema }),
  z.strictObject({ ...figureBase, kind: z.literal('steps'), steps: z.array(z.strictObject({ label: text.max(200), detail: text.max(2_000) })).min(2).max(20) }),
  z.strictObject({ ...figureBase, kind: z.literal('comparison'), input: algorithmInputSchema, runs: z.array(z.strictObject({ label: text.max(100), binding: engineBindingSchema })).min(2).max(4) }),
]);
export type FigureSpecification = z.infer<typeof figureSpecificationSchema>;

/** These capabilities come from the trusted application registry, never model output. */
export const engineCapabilitySchema = z.strictObject({
  id,
  version,
  inputKind: z.enum(['graph', 'array', 'matrix']),
  figureKinds: z.array(z.enum(['graph', 'array', 'matrix', 'plot', 'comparison'])).min(1).max(5),
  parameters: z.array(numericParameterSchema).max(16),
  comparisonGroup: id,
  metrics: z.array(z.strictObject({ id, label: text.max(100), unit: text.max(50) })).max(16),
});
export type EngineCapability = z.infer<typeof engineCapabilitySchema>;

const traceStateSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('matrix'), values: z.array(finite).min(1).max(8), residual: finite.min(0), iteration: z.number().int().min(0).max(200), history: z.array(z.strictObject({ iteration: z.number().int().min(0).max(200), residual: finite.min(0) })).min(1).max(201) }),
  z.strictObject({ kind: z.literal('graph'), activeNodeIds: z.array(id).max(256), visitedNodeIds: z.array(id).max(256), activeEdgeIds: z.array(id).max(2_048), distances: z.record(id, finite.nullable()).optional(), frontierNodeIds: z.array(id).max(256).optional() }),
  z.strictObject({ kind: z.literal('array'), values: z.array(finite).max(256), activeIndices: z.array(z.number().int().min(0)).max(256), originalIndices: z.array(z.number().int().min(0)).max(256).optional(), mergeRange: z.strictObject({ start: z.number().int().min(0), middle: z.number().int().min(0), end: z.number().int().min(0) }).optional(), runs: z.array(z.strictObject({ start: z.number().int().min(0), end: z.number().int().min(0) })).max(256).optional() }),
]);
export const executionTraceSchema = z.strictObject({
  ...versioned,
  kind: z.literal('computed-trace'),
  binding: engineBindingSchema,
  seed: z.number().int().min(0).max(4_294_967_295),
  input: algorithmInputSchema,
  status: z.enum(['completed', 'cancelled', 'limit-reached']),
  steps: z.array(z.strictObject({ index: z.number().int().min(0), operations: z.number().int().min(0), description: text.max(1_000), state: traceStateSchema })).min(1).max(10_000),
  metrics: z.array(z.strictObject({ id, value: finite.min(0), unit: text.max(50) })).max(16),
});
export type ExecutionTrace = z.infer<typeof executionTraceSchema>;

/** Evidence records do not belong to the untrusted figure-generation contract. */
export const fidelityEvidenceSchema = z.discriminatedUnion('level', [
  z.strictObject({ level: z.literal('illustrative-walkthrough'), limitations: z.array(text.max(1_000)).min(1).max(16) }),
  z.strictObject({ level: z.literal('simplified-illustration'), limitations: z.array(text.max(1_000)).min(1).max(16) }),
  z.strictObject({ level: z.literal('mechanism-reproduction'), binding: engineBindingSchema, referenceCaseIds: z.array(id).min(1).max(100) }),
  z.strictObject({ level: z.literal('experiment-reproduction'), binding: engineBindingSchema, referenceCaseIds: z.array(id).min(1).max(100), protocolReference: text.max(2_000), datasetReference: text.max(2_000), environment: text.max(2_000), comparisons: z.array(z.strictObject({ metricId: id, reference: finite, measured: finite, tolerance: finite.min(0) })).min(1).max(16) }),
]);
export type FidelityEvidence = z.infer<typeof fidelityEvidenceSchema>;

export const experimentSnapshotSchema = z.strictObject({
  ...versioned,
  documentId: id,
  sourceVersion: text.max(100),
  figure: figureSpecificationSchema,
  seed: z.number().int().min(0).max(4_294_967_295),
});
export type ExperimentSnapshot = z.infer<typeof experimentSnapshotSchema>;

export class ContractError extends Error {
  constructor(message: string) { super(message); this.name = 'ContractError'; }
}
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new ContractError(message); }
const unique = (values: string[], label: string) => assert(new Set(values).size === values.length, `Duplicate ${label}`);
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
function blockContent(block: SourceDocument['blocks'][number]) {
  return block.kind === 'equation' ? block.latex : block.kind === 'original-figure' ? block.caption : block.text;
}

export function validateDocument(input: unknown): SourceDocument {
  const document = sourceDocumentSchema.parse(input);
  unique(document.blocks.map(block => block.id), 'source block ID');
  unique(document.anchors.map(anchor => anchor.id), 'source anchor ID');
  const blocks = new Map(document.blocks.map(block => [block.id, block]));
  for (const block of document.blocks) {
    assert(block.page <= document.pageCount, `Block ${block.id} exceeds page count`);
    if (block.sectionId) assert(blocks.get(block.sectionId)?.kind === 'heading', `Invalid section reference ${block.sectionId}`);
    if (block.reconstruction?.regionIds.length) {
      const geometry=document.reconstruction?.pages.find(p=>p.page===block.page);
      assert(geometry && block.reconstruction.regionIds.every(id=>geometry.regions.some(r=>r.id===id)),`Invalid raw-region reference in ${block.id}`);
    }
  }
  if(document.reconstruction){unique(document.reconstruction.pages.map(p=>String(p.page)),'reconstruction page');for(const p of document.reconstruction.pages){assert(p.page<=document.pageCount,'Reconstruction page exceeds source');unique(p.regions.map(r=>r.id),'raw-region identity');}}
  for (const anchor of document.anchors) {
    const block = blocks.get(anchor.blockId);
    assert(block, `Unknown source block ${anchor.blockId}`);
    assert(anchor.page === block.page, `Wrong source page for anchor ${anchor.id}`);
    assert(normalize(blockContent(block)).includes(normalize(anchor.quote)), `Quote not found for anchor ${anchor.id}`);
  }
  return document;
}

function validateInput(input: AlgorithmInput) {
  if (input.kind !== 'graph') return;
  unique(input.nodes.map(node => node.id), 'graph node ID');
  unique(input.edges.map(edge => edge.id), 'graph edge ID');
  const ids = new Set(input.nodes.map(node => node.id));
  for (const [role, nodeId] of Object.entries(input.nodeRoles ?? {})) assert(ids.has(nodeId), `Unknown graph node for role ${role}`);
  for (const edge of input.edges) assert(ids.has(edge.source) && ids.has(edge.target), `Unknown endpoint for edge ${edge.id}`);
}

function registryFrom(input: readonly EngineCapability[]) {
  const engines = input.map(value => engineCapabilitySchema.parse(value));
  unique(engines.map(engine => `${engine.id}@${engine.version}`), 'engine version');
  for (const engine of engines) {
    unique(engine.parameters.map(parameter => parameter.key), 'engine parameter');
    unique(engine.metrics.map(metric => metric.id), 'engine metric');
  }
  return engines;
}
function validateBinding(binding: z.infer<typeof engineBindingSchema>, kind: AlgorithmInput['kind'], figureKind: 'graph' | 'array' | 'matrix' | 'plot' | 'comparison', engines: EngineCapability[]) {
  const engine = engines.find(candidate => candidate.id === binding.engineId && candidate.version === binding.engineVersion);
  assert(engine, `Unknown or incompatible engine ${binding.engineId}@${binding.engineVersion}`);
  assert(engine.inputKind === kind && engine.figureKinds.includes(figureKind), `Engine ${engine.id} does not support ${figureKind}/${kind}`);
  for (const [key, value] of Object.entries(binding.parameters)) {
    const parameter = engine.parameters.find(candidate => candidate.key === key);
    assert(parameter, `Unknown engine parameter ${key}`);
    assert(value >= parameter.min && value <= parameter.max, `Engine parameter ${key} is outside bounds`);
    const steps = (value - parameter.min) / parameter.step;
    assert(Math.abs(steps - Math.round(steps)) <= 1e-7, `Engine parameter ${key} does not align with step`);
  }
  for (const parameter of engine.parameters) assert(Object.hasOwn(binding.parameters, parameter.key), `Missing engine parameter ${parameter.key}`);
  return engine;
}

export function validateFigure(input: unknown, source: SourceDocument, registry: readonly EngineCapability[] = []): FigureSpecification {
  const document = validateDocument(source);
  const figure = figureSpecificationSchema.parse(input);
  unique(figure.sourceAnchorIds, 'figure source anchor');
  const anchors = new Set(document.anchors.map(anchor => anchor.id));
  for (const anchor of figure.sourceAnchorIds) assert(anchors.has(anchor), `Unknown figure source anchor ${anchor}`);
  const engines = registryFrom(registry);
  if (figure.kind === 'steps') return figure;
  validateInput(figure.input);
  if (figure.kind === 'comparison') {
    const candidates = figure.runs.map(run => validateBinding(run.binding, figure.input.kind, 'comparison', engines));
    assert(candidates.every(engine => engine.comparisonGroup === candidates[0].comparisonGroup), 'Incompatible comparison groups');
    const units = new Map<string, string>();
    for (const engine of candidates) for (const metric of engine.metrics) {
      assert(!units.has(metric.id) || units.get(metric.id) === metric.unit, `Incompatible metric unit for ${metric.id}`);
      units.set(metric.id, metric.unit);
    }
    assert(candidates[0].metrics.some(metric => candidates.every(engine => engine.metrics.some(other => other.id === metric.id && other.unit === metric.unit))), 'Comparison has no common metric');
    return figure;
  }
  unique(figure.controls.map(control => control.key), 'figure control');
  if (figure.execution.mode === 'illustrative') {
    assert(figure.controls.length === 0, 'Illustrative figures cannot expose executable parameter controls');
    return figure;
  }
  const engine = validateBinding(figure.execution.binding, figure.input.kind, figure.kind, engines);
  for (const control of figure.controls) {
    const parameter = engine.parameters.find(candidate => candidate.key === control.key);
    assert(parameter, `Unknown figure control ${control.key}`);
    assert(control.min >= parameter.min && control.max <= parameter.max && control.step === parameter.step, `Control ${control.key} exceeds engine capability`);
    assert(control.initial === figure.execution.binding.parameters[control.key], `Control ${control.key} differs from bound parameter`);
  }
  return figure;
}

export function validateTrace(input: unknown, registry: readonly EngineCapability[]): ExecutionTrace {
  const trace = executionTraceSchema.parse(input);
  validateInput(trace.input);
  const engine = validateBinding(trace.binding, trace.input.kind, trace.input.kind, registryFrom(registry));
  unique(trace.metrics.map(metric => metric.id), 'trace metric');
  for (const metric of trace.metrics) assert(engine.metrics.some(expected => expected.id === metric.id && expected.unit === metric.unit), `Undeclared trace metric or unit ${metric.id}`);
  let operations = 0;
  for (const [index, step] of trace.steps.entries()) {
    assert(step.index === index, 'Trace step indexes must be contiguous from zero');
    assert(step.operations >= operations, 'Trace operations must be monotonic');
    assert(step.state.kind === trace.input.kind, 'Trace state/input kinds differ');
    operations = step.operations;
    if (step.state.kind === 'array') {
      const state = step.state;
      unique(state.activeIndices.map(String), 'active array index');
      assert(state.activeIndices.every(position => position < state.values.length), 'Array trace index is outside state bounds');
      if (state.originalIndices) {
        assert(state.originalIndices.length === state.values.length, 'Array identity length differs from values');
        unique(state.originalIndices.map(String), 'array original identity');
        assert(state.originalIndices.every(position => position < (trace.input.kind === 'array' ? trace.input.values.length : 0)), 'Array original identity is outside input bounds');
      }
      if (state.mergeRange) assert(state.mergeRange.start < state.mergeRange.middle && state.mergeRange.middle < state.mergeRange.end && state.mergeRange.end <= state.values.length, 'Invalid merge range');
      if (state.runs) for (const run of state.runs) assert(run.start < run.end && run.end <= state.values.length, 'Invalid run range');
    } else if (step.state.kind === 'matrix' && trace.input.kind === 'matrix') {
      assert(step.state.values.length === trace.input.rhs.length, 'Numeric state dimensions differ from input');
      assert(step.state.history.length === step.state.iteration + 1, 'Numeric history must retain every observed iteration');
      assert(step.state.history.every((point, i) => point.iteration === i), 'Numeric history iterations must be contiguous');
      assert(step.state.history.at(-1)!.residual === step.state.residual, 'Numeric state residual differs from its history');
    } else if (step.state.kind === 'graph' && trace.input.kind === 'graph') {
      const nodes = new Set(trace.input.nodes.map(node => node.id));
      const edges = new Set(trace.input.edges.map(edge => edge.id));
      unique(step.state.activeNodeIds, 'active graph node');
      unique(step.state.visitedNodeIds, 'visited graph node');
      unique(step.state.activeEdgeIds, 'active graph edge');
      assert([...step.state.activeNodeIds, ...step.state.visitedNodeIds].every(node => nodes.has(node)), 'Graph trace references an unknown node');
      assert(step.state.activeEdgeIds.every(edge => edges.has(edge)), 'Graph trace references an unknown edge');
      if (step.state.frontierNodeIds) { unique(step.state.frontierNodeIds, 'frontier node'); assert(step.state.frontierNodeIds.every(node => nodes.has(node)), 'Unknown frontier node'); }
      if (step.state.distances) assert(Object.keys(step.state.distances).every(node => nodes.has(node)), 'Unknown distance node');
    }
  }
  return trace;
}

export function validateSnapshot(input: unknown, source: SourceDocument, registry: readonly EngineCapability[] = []): ExperimentSnapshot {
  const snapshot = experimentSnapshotSchema.parse(input);
  assert(snapshot.documentId === source.id && snapshot.sourceVersion === source.sourceVersion, 'Snapshot source/version does not match');
  validateFigure(snapshot.figure, source, registry);
  return snapshot;
}
