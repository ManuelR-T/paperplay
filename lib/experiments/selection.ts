import type { WidgetEnvelope } from '../../shared/widgets';

export function widgetRevision(widget:WidgetEnvelope) {
  let hash=2166136261;for(const character of JSON.stringify({spec:widget.spec,seed:widget.seed}))hash=Math.imul(hash^character.charCodeAt(0),16777619);
  return (hash>>>0).toString(16);
}
export function semanticSelection(widget:WidgetEnvelope) {
  const labels={equation:'symbol/substitution',function:'function probe',diagram:'concept node/step',table:'row',linear:'matrix/vector coordinate',probability:'distribution/sample',attention:'query',graph:'vertex/search operation',signal:'output product'};
  return {sourceId:widget.source.documentId,sourceVersion:widget.source.sourceVersion,widgetId:widget.id,revision:widgetRevision(widget),type:labels[widget.spec.kind],selection:widget.view.selection||'whole model',step:widget.view.step,mapping:widget.spec.mapping};
}
export function semanticAlgorithm(widget:WidgetEnvelope):string[] {
  switch(widget.spec.kind){
    case 'attention':return ['scores = Q Kᵀ / (sqrt(d) × temperature)','weights = masked stable softmax(scores)','output = weights V'];
    case 'linear':return ['Read the explicit 2×2 matrix A and vector x.','Transform each basis vector by A.','Compute y = Ax; inspect singularity and determinant.'];
    case 'graph':return ['Use the supplied graph/grid and nonnegative weights.','Choose the unsettled vertex with smallest tentative distance.','Relax its admissible outgoing edges; retain predecessor links.'];
    case 'signal':return ['Apply the declared boundary convention and stride.','Reverse the supplied convolution kernel.','Multiply the local input region by the kernel and sum the products.'];
    case 'probability':return ['Read the declared analytic model and parameters.','Use the recorded seeded random generator for samples.','For beta-Bernoulli: posterior α = α₀ + successes, β = β₀ + failures.'];
    case 'equation':case 'function':return ['Read the supported expression tree and declared symbol domains.','Substitute current values; reject invalid domains or units.','Evaluate only declared arithmetic operations, never generated code.'];
    case 'diagram':return ['Read the cited illustrative relationships.','Select a concept or explanatory step.','No algorithm execution is implied by the highlight.'];
    case 'table':return ['Keep original row identities and declared data origin.','Filter and sort the view without modifying the source data.','Inspect a selected row and its units.'];
  }
}
