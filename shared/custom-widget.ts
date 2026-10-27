import { z } from 'zod';
import { expressionSchema, name, text, variableSchema, type Expression } from './widget-primitives';

export const CUSTOM_RUNTIME_VERSION = 1 as const;
export const CUSTOM_LIMITS = { steps: 120, registers: 8, marks: 24, expressionTerms: 768, operations: 80_000 } as const;
const paint = z.enum(['ink', 'accent', 'olive']);
const base = { id: name, label: text.max(160), paint };
export const customMarkSchema = z.discriminatedUnion('shape', [
  z.strictObject({ ...base, shape: z.literal('circle'), x: expressionSchema, y: expressionSchema, radius: expressionSchema }),
  z.strictObject({ ...base, shape: z.literal('rect'), x: expressionSchema, y: expressionSchema, width: expressionSchema, height: expressionSchema }),
  z.strictObject({ ...base, shape: z.literal('line'), x: expressionSchema, y: expressionSchema, x2: expressionSchema, y2: expressionSchema }),
  z.strictObject({ ...base, shape: z.literal('text'), x: expressionSchema, y: expressionSchema, value: expressionSchema }),
]);
export const customWidgetSchema = z.strictObject({
  kind: z.literal('custom'), runtimeVersion: z.literal(CUSTOM_RUNTIME_VERSION),
  purpose: text.max(600), catalogGap: text.min(20).max(1000), mapping: text,
  parameters: z.array(variableSchema).max(8),
  registers: z.array(z.strictObject({ name, definition: text.max(300), initial: expressionSchema, update: expressionSchema })).max(CUSTOM_LIMITS.registers),
  steps: z.number().int().min(0).max(CUSTOM_LIMITS.steps),
  metrics: z.array(z.strictObject({ name, label: text.max(160), unit: z.string().max(40), expression: expressionSchema })).min(1).max(8),
  plot: z.strictObject({ label: text.max(160), xLabel: text.max(80), yLabel: text.max(80), x: expressionSchema, y: expressionSchema }).optional(),
  marks: z.array(customMarkSchema).max(CUSTOM_LIMITS.marks),
});
export type CustomWidgetSpec = z.infer<typeof customWidgetSchema>;
export type CustomMark = z.infer<typeof customMarkSchema>;

/** One validation seam for authored, model-proposed and imported programs. No code loading. */
export function validateCustomWidget(input: unknown): CustomWidgetSpec {
  const spec = customWidgetSchema.parse(input);
  const names = [...spec.parameters.map(p=>p.name), ...spec.registers.map(r=>r.name), ...spec.metrics.map(m=>m.name), 'step'];
  if (new Set(names).size !== names.length) throw Error('Custom parameter, register and metric names must be unique; step is reserved.');
  if (new Set(spec.marks.map(m=>m.id)).size !== spec.marks.length) throw Error('Custom visual element IDs must be unique.');
  if (spec.parameters.some(p=>p.unit !== 'scalar')) throw Error('Custom runtime v1 accepts dimensionless parameters; output unit labels are descriptive, not dimensionally verified.');
  let terms = 0;
  const inspect = (expression: Expression, allowed: Set<string>) => {
    const visit = (e: Expression) => {
      terms++;
      if (e.op==='variable' && !allowed.has(e.name)) throw Error(`Custom expression refers to unavailable symbol ${e.name}.`);
      if (e.op==='dot') { e.left.forEach(visit); e.right.forEach(visit); }
      else if ('left' in e) { visit(e.left); visit(e.right); }
      else if ('arg' in e) visit(e.arg);
    }; visit(expression);
  };
  const parameters = new Set(spec.parameters.map(p=>p.name));
  const state = new Set([...parameters, ...spec.registers.map(r=>r.name), 'step']);
  const outputs = new Set([...state, ...spec.metrics.map(m=>m.name)]);
  spec.registers.forEach(r=>{inspect(r.initial, parameters); inspect(r.update, state);});
  spec.metrics.forEach(m=>inspect(m.expression, state));
  if (spec.plot) { inspect(spec.plot.x, outputs); inspect(spec.plot.y, outputs); }
  spec.marks.forEach(mark=>Object.values(mark).forEach(value=>{
    if (value && typeof value==='object' && 'op' in value) inspect(value as Expression, outputs);
  }));
  if (terms > CUSTOM_LIMITS.expressionTerms || terms * (spec.steps+1) > CUSTOM_LIMITS.operations) throw Error('Custom program exceeds its expression/operation budget. Reduce the number of steps or visual elements.');
  return spec;
}
