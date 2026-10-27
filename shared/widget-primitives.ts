import { z } from 'zod';

export const num = z.number().finite().min(-1_000_000).max(1_000_000);
export const name = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/);
export const text = z.string().trim().min(1).max(2000).refine(s => !/<\/?[a-z][^>]*>|javascript\s*:/i.test(s), 'Use plain text, not markup.');
export type Expression = { op: 'number'; value: number } | { op: 'variable'; name: string } | { op: 'add' | 'sub' | 'mul' | 'div' | 'pow'; left: Expression; right: Expression } | { op: 'neg' | 'sin' | 'cos' | 'exp' | 'log' | 'sqrt' | 'abs'; arg: Expression } | { op: 'dot'; left: Expression[]; right: Expression[] };
const recursiveExpression: z.ZodType<Expression> = z.lazy(() => z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('number'), value: num }), z.strictObject({ op: z.literal('variable'), name }),
  ...(['add','sub','mul','div','pow'] as const).map(op => z.strictObject({ op: z.literal(op), left: recursiveExpression, right: recursiveExpression })),
  ...(['neg','sin','cos','exp','log','sqrt','abs'] as const).map(op => z.strictObject({ op: z.literal(op), arg: recursiveExpression })),
  z.strictObject({ op: z.literal('dot'), left: z.array(recursiveExpression).min(1).max(8), right: z.array(recursiveExpression).min(1).max(8) }),
]));
/** Inspect depth before Zod recursion, so adversarial JSON cannot overflow the validator. */
export const expressionSchema = z.unknown().transform((value, ctx) => {
  let count = 0; const visit = (v: unknown, depth: number) => { if (++count > 128 || depth > 12) throw Error('Expression exceeds 128 terms or depth 12.'); if (v && typeof v === 'object') for (const item of Object.values(v)) if (item && typeof item === 'object') Array.isArray(item) ? item.forEach(x => visit(x, depth + 1)) : visit(item, depth + 1); };
  try { visit(value, 0); return recursiveExpression.parse(value); } catch (e) { ctx.addIssue({ code: 'custom', message: e instanceof Error ? e.message : 'Invalid expression.' }); return z.NEVER; }
});
export const variableSchema = z.strictObject({ name, value: num, min: num, max: num, step: z.number().finite().positive().max(1_000_000), definition: text, sourceSymbol: z.string().max(120).optional(), unit: z.enum(['scalar','length','time','mass']).default('scalar') }).superRefine((v,c) => { if(v.min >= v.max || v.value < v.min || v.value > v.max)c.addIssue({code:'custom',message:'Variable value must lie in its nonempty domain.'}); });
