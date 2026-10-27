import { preparedPapers } from '../../data/papers';
import { widgetReferenceSources } from '../../data/widget-sources';
import type { WidgetKind } from '../../shared/widgets';
import type { SourceDocument } from '../../shared/schema';
import type { EnrichmentResult } from './contracts';
import { buildSourceSections } from './sections';

/** Frozen source choices. Notes are authored teaching notes, not full-paper imports. No provider call occurs here. */
export const enrichmentEvaluationCases: Array<{ id: string; family: string; source: SourceDocument; preferredBlockId: string; candidateKinds: WidgetKind[]; scope: string }> = [
  { id: 'graph-priority-maps', family: 'graph algorithms', source: preparedPapers[0].document, preferredBlockId: 'g-dijkstra', candidateKinds: ['graph','diagram','table'], scope: 'Licensed prepared source selection, not complete paper.' },
  { id: 'sorting-powersort', family: 'adaptive sorting', source: preparedPapers[1].document, preferredBlockId: 's-powersort', candidateKinds: ['diagram','table'], scope: 'Licensed prepared source selection, not complete paper.' },
  { id: 'optimization-quadratic', family: 'numerical optimization', source: preparedPapers[2].document, preferredBlockId: 'q-objective', candidateKinds: ['equation','function','linear'], scope: 'Attributed selected Distill equation and text, not complete article.' },
  { id: 'attention-mechanism', family: 'attention', source: widgetReferenceSources[0], preferredBlockId: 'attention-equation', candidateKinds: ['attention','diagram'], scope: 'Independently authored source-linked note and mathematical formula, not original paper prose/pagination.' },
  { id: 'probability-update', family: 'Bayesian updating', source: widgetReferenceSources[1], preferredBlockId: 'beta-equation', candidateKinds: ['probability','diagram'], scope: 'Independently authored source-linked note and mathematical formula, not original paper prose/pagination.' },
  { id: 'signal-convolution', family: 'signal/image operators', source: widgetReferenceSources[2], preferredBlockId: 'convolution-equation', candidateKinds: ['signal','diagram'], scope: 'Independently authored source-linked note and mathematical formula, not original paper prose/pagination.' },
];
export function evaluationRequest(id: string, requestId: string) {
  const item = enrichmentEvaluationCases.find(c => c.id === id); if (!item) throw Error('Unknown frozen evaluation case.');
  const section = buildSourceSections(item.source).find(s => s.segments.some(p => p.blockId === item.preferredBlockId)) ?? buildSourceSections(item.source).find(s => s.segments.some(p => item.source.blocks.find(b=>b.id===p.blockId)?.kind !== 'heading'))!;
  return { source: item.source, sectionId: section.id, action: 'plan' as const, feedback: '', requestId };
}
export function scoreEnrichmentResult(result: EnrichmentResult, candidateKinds: readonly WidgetKind[]) {
  return { validProposals: result.proposals.length, rejectedProposals: result.rejected.length, distinctKinds: [...new Set(result.proposals.map(p=>p.envelope.spec.kind))], alignedKinds: result.proposals.filter(p=>candidateKinds.includes(p.envelope.spec.kind)).length,
    unsupportedControlRejections: result.rejected.filter(p=>/interaction|editor|slider|train/i.test(p.reason)).length,
    syntheticOrIllustrativeLabels: result.proposals.every(p=>p.provenance==='synthetic'||p.provenance==='illustrative'), warnings: result.warnings,
    scope: 'Structural validation/proposal variety only; scientific usefulness requires source review and understanding requires actual readers.' };
}
