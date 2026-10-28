import { figureSpecificationSchema, type FigureSpecification } from '../shared/schema';
import { engineRegistry } from './engines';

export type FidelityAssessment = {
  level: 'illustrative-walkthrough' | 'simplified-illustration' | 'mechanism-reproduction' | 'experiment-reproduction';
  label: string;
  claim: string;
  limitations: string[];
  referenceCaseIds: string[];
};

/** Trusted, version-specific application policy. Never populated from a model response. */
const checkedMechanisms: Record<string, { claim: string; referenceCaseIds: string[]; limitations: string[] }> = {
  'gradient-descent@1.0.0': {
    claim: 'The basic SPD-quadratic gradient recurrence is checked against independent closed-form iterates and an exact linear-system solution.',
    referenceCaseIds: ['numeric-diagonal-closed-form', 'numeric-spd-solution', 'numeric-residual-recomputed'],
    limitations: ['Small synthetic SPD inputs and a conservative stability restriction.', 'Finite floating-point trajectories do not reproduce the article’s original regression/colorization experiments or establish general convergence.'],
  },
  'heavy-ball@1.0.0': {
    claim: 'The SPD-quadratic heavy-ball recurrence with zero initial velocity is checked against direct recurrence references and exact solutions.',
    referenceCaseIds: ['numeric-momentum-recurrence', 'numeric-zero-momentum', 'numeric-spd-solution'],
    limitations: ['Small synthetic SPD inputs; momentum may oscillate and a finite trace need not reach tolerance.', 'This does not reproduce the source article’s original experiments or prove general acceleration.'],
  },
  'powersort@1.0.0': {
    claim: 'The core Powersort merge-scheduling mechanism is checked against node-power, merge-order and stable-sorting reference cases.',
    referenceCaseIds: ['powersort-node-power', 'powersort-merge-order', 'sorting-stability', 'sorting-reference-oracle'],
    limitations: ['Synthetic inputs, not the paper’s benchmark dataset.', 'A TypeScript teaching implementation; original runtime experiments and implementation optimizations are not reproduced.'],
  },
  'natural-mergesort@1.0.0': {
    claim: 'The stable left-to-right natural-merge baseline is checked against independent sorted-output and stability reference cases.',
    referenceCaseIds: ['sorting-stability', 'sorting-reference-oracle'],
    limitations: ['A comparison baseline, not a claim to implement Powersort.', 'Synthetic inputs and deterministic counts do not reproduce the paper’s runtime benchmarks.'],
  },
};

const simplified = (claim: string, limitations: string[] = []): FidelityAssessment => ({
  level: 'simplified-illustration', label: 'Simplified illustration', claim,
  limitations: ['No original experiment reproduction is claimed.', ...limitations], referenceCaseIds: [],
});

/** Describes implementation evidence, not the scientific truth of a model's explanation. */
export function assessFigureFidelity(input: FigureSpecification | unknown): FidelityAssessment {
  const parsed = figureSpecificationSchema.safeParse(input);
  if (!parsed.success) return simplified('This figure is not a valid executable specification.');
  const figure = parsed.data;
  if (figure.kind === 'steps') return {
    level: 'illustrative-walkthrough', label: 'Illustrative walkthrough',
    claim: 'A source-linked conceptual sequence; no algorithm is executed by this figure.',
    limitations: ['The sequence is an explanation, not an execution trace or an experiment.'], referenceCaseIds: [],
  };
  if (figure.kind !== 'comparison' && figure.execution.mode === 'illustrative') {
    return simplified('A source-linked teaching illustration with no checked algorithm execution.');
  }
  const bindings = figure.kind === 'comparison' ? figure.runs.map(run => run.binding)
    : figure.execution.mode === 'computed' ? [figure.execution.binding] : [];
  const supported = bindings.every(binding => {
    const engine = engineRegistry.find(item => item.id === binding.engineId && item.version === binding.engineVersion);
    if (!engine || engine.inputKind !== figure.input.kind || !engine.figureKinds.includes(figure.kind)) return false;
    if (Object.keys(binding.parameters).length !== engine.parameters.length) return false;
    return engine.parameters.every(parameter => {
      const value = binding.parameters[parameter.key];
      return Number.isFinite(value) && value >= parameter.min && value <= parameter.max
        && Math.abs((value - parameter.min) / parameter.step - Math.round((value - parameter.min) / parameter.step)) < 1e-7;
    });
  });
  if (!supported) return simplified('This engine configuration has no compatible checked implementation.');
  const evidence = bindings.map(binding => checkedMechanisms[`${binding.engineId}@${binding.engineVersion}`]);
  if (evidence.length && evidence.every(Boolean)) {
    return {
      level: 'mechanism-reproduction', label: 'Implementation reference cases',
      claim: evidence.map(item => item.claim).join(' '),
      limitations: ['Implementation checks describe fixed reference cases, not verification of this current run. Use the independent behavior check for a source/input-bound report.', ...new Set(evidence.flatMap(item => item.limitations))],
      referenceCaseIds: [...new Set(evidence.flatMap(item => item.referenceCaseIds))],
    };
  }
  const graphExample = bindings.length > 0 && bindings.every(binding =>
    ['dijkstra-heap', 'dijkstra-scan'].includes(binding.engineId) && binding.engineVersion === '1.0.0');
  return simplified(graphExample
    ? 'Dijkstra shortest-distance computation is reference-checked; the paper’s functional priority search tree and Isabelle proof are not implemented.'
    : 'This configuration has no registered mechanism-reproduction evidence.',
  graphExample ? ['The queue/scan implementations illustrate the graph application with synthetic inputs.', 'A reference-checked algorithm is not a reproduction of this paper’s full data structure or proof.'] : ['Unknown engine versions cannot inherit another implementation’s evidence.']);
}
