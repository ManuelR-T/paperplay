import type { WidgetKind } from '../../shared/widgets';

export const widgetGuides: Record<WidgetKind, { name: string; action: string; step: string }> = {
  equation: { name: 'Equation', action: 'Change a variable and watch the result update. The definitions explain what each symbol means.', step: 'Step' },
  function: { name: 'Function', action: 'Move the probe along the curve. Change the inputs to see how the function responds.', step: 'Step' },
  diagram: { name: 'Concept diagram', action: 'Select a concept to read its connections. Step through the explanation at your own pace.', step: 'Step' },
  table: { name: 'Data table', action: 'Filter the rows, select an item, or click a column heading to sort it.', step: 'Step' },
  linear: { name: 'Linear transformation', action: 'Move the input vector in its plane. Compare it with the transformed vector; edit the matrix in Inputs.', step: 'Step' },
  probability: { name: 'Probability', action: 'Change the distribution or observations. Compare the analytic result with reproducible samples.', step: 'Step' },
  attention: { name: 'Attention', action: 'Choose a query and inspect which keys receive weight. Change temperature to spread or concentrate attention.', step: 'Query' },
  graph: { name: 'Shortest path', action: 'Choose a start and target, then follow the search. Edit the graph or its obstacles in Inputs.', step: 'Step' },
  signal: { name: 'Convolution', action: 'Select an output cell to inspect its local products. Change the boundary rule or edit the signal and kernel in Inputs.', step: 'Output' },
  custom: { name: 'Custom teaching model', action: 'Change a declared parameter, play the model and inspect its scene. This model is not independently scientifically verified.', step: 'Frame' },
};

export type NumericDraft = { kind: 'valid'; value: number } | { kind: 'incomplete' } | { kind: 'invalid'; message: string };
export function parseNumericDraft(text: string, min = -1_000_000, max = 1_000_000, integer = false): NumericDraft {
  const value = text.trim();
  if (!value || /^[+-]?(?:\.|(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?)$/.test(value) || value === '-' || value === '+') return { kind: 'incomplete' };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) return { kind: 'invalid', message: 'Enter a finite number.' };
  const number = Number(value);
  if (integer && !Number.isInteger(number)) return { kind: 'invalid', message: 'Use a whole number.' };
  if (number < min || number > max) return { kind: 'invalid', message: `Use a value from ${min} to ${max}.` };
  return { kind: 'valid', value: number };
}

export function histogramBins(samples: number[], discrete = false) {
  if (!samples.length) return [];
  const min = Math.min(...samples), max = Math.max(...samples);
  if (discrete || min === max) return [...new Set(samples)].sort((a, b) => a - b).map(value => ({ from: value, to: value, count: samples.filter(sample => sample === value).length }));
  const width = (max - min) / 12;
  const bins = Array.from({ length: 12 }, (_, index) => ({ from: min + index * width, to: index === 11 ? max : min + (index + 1) * width, count: 0 }));
  for (const value of samples) bins[Math.min(11, Math.max(0, Math.floor((value - min) / width)))].count++;
  return bins;
}

/** SVG CTM includes responsive scaling and preserveAspectRatio letterboxing. */
export function svgPointer(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
}
