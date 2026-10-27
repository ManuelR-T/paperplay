import { z } from 'zod';
import { validateDocument, type SourceDocument } from './schema';

import { num, name, text, expressionSchema, variableSchema } from './widget-primitives';
export { expressionSchema, variableSchema } from './widget-primitives';
export type { Expression } from './widget-primitives';
import { customWidgetSchema, validateCustomWidget } from './custom-widget';

const variables = z.array(variableSchema).max(12).superRefine((v,c) => { if(new Set(v.map(x=>x.name)).size!==v.length)c.addIssue({code:'custom',message:'Variable names must be unique.'}); });
const vector = z.tuple([num,num]); const matrix2 = z.tuple([vector,vector]);
const node = z.strictObject({ id: name, label: text.max(120), x: z.number().finite().min(0).max(100), y: z.number().finite().min(0).max(100) });
const edge = z.strictObject({ id: name, source: name, target: name, label: z.string().max(120).default(''), weight: z.number().finite().min(0).max(1000).default(1) });
export const widgetSpecSchema = z.discriminatedUnion('kind', [
  customWidgetSchema,
  z.strictObject({ kind:z.literal('equation'), expression:expressionSchema, variables, resultLabel:text.max(120), mapping:text }),
  z.strictObject({ kind:z.literal('function'), expression:expressionSchema, variables, xVariable:name, domain:vector, samples:z.number().int().min(16).max(257), probe:num, derivative:z.boolean().default(false), mapping:text }),
  z.strictObject({ kind:z.literal('diagram'), nodes:z.array(node).min(1).max(20), edges:z.array(edge).max(40), steps:z.array(z.strictObject({label:text.max(120),description:text,activeNodeIds:z.array(name).max(20)})).min(1).max(20), mapping:text }),
  z.strictObject({ kind:z.literal('table'), columns:z.array(z.strictObject({id:name,label:text.max(120),unit:z.string().max(50)})).min(1).max(12), rows:z.array(z.strictObject({id:name,cells:z.record(name,z.union([num,z.string().max(500),z.null()]))})).max(64), provenance:z.enum(['source-reported','computed','illustrative']), mapping:text }),
  z.strictObject({ kind:z.literal('linear'), matrix:matrix2, vector, mapping:text }),
  z.strictObject({ kind:z.literal('probability'), distribution:z.enum(['bernoulli','binomial','normal','beta-bernoulli']), probability:z.number().min(0).max(1), trials:z.number().int().min(1).max(40), mean:num, deviation:z.number().finite().min(0.05).max(100), alpha:z.number().finite().min(0.2).max(100), beta:z.number().finite().min(0.2).max(100), successes:z.number().int().min(0).max(1000), failures:z.number().int().min(0).max(1000), samples:z.number().int().min(1).max(512), mapping:text }),
  z.strictObject({ kind:z.literal('attention'), queries:z.array(z.array(num).min(1).max(8)).min(1).max(8), keys:z.array(z.array(num).min(1).max(8)).min(1).max(8), values:z.array(z.array(num).min(1).max(8)).min(1).max(8), mask:z.array(z.array(z.boolean()).min(1).max(8)).max(8), temperature:z.number().finite().min(0.05).max(10), mapping:text }),
  z.strictObject({ kind:z.literal('graph'), mode:z.enum(['graph','grid']), directed:z.boolean(), nodes:z.array(node).min(1).max(36), edges:z.array(edge).max(100), start:name, target:name, rows:z.number().int().min(2).max(6), columns:z.number().int().min(2).max(6), blocked:z.array(z.number().int().min(0).max(35)).max(36), mapping:text }),
  z.strictObject({ kind:z.literal('signal'), mode:z.enum(['1d','2d']), input:z.array(z.array(num).min(1).max(16)).min(1).max(16), kernel:z.array(z.array(num).min(1).max(5)).min(1).max(5), boundary:z.enum(['zero','wrap','reflect']), stride:z.number().int().min(1).max(3), normalize:z.boolean(), mapping:text }),
]);
export type WidgetSpec = z.infer<typeof widgetSpecSchema>;
export type WidgetKind = WidgetSpec['kind'];
export const WIDGET_KINDS = widgetSpecSchema.options.map(option => option.shape.kind.value) as [WidgetKind, ...WidgetKind[]];
export const widgetEnvelopeSchema = z.strictObject({
  format:z.literal('paperplay-widget'), schemaVersion:z.literal(2), id:name, title:text.max(200),
  source:z.strictObject({ documentId:z.string().min(1).max(100), sourceVersion:z.string().min(1).max(100), blockId:z.string().min(1).max(100), page:z.number().int().min(1).max(500), quote:text.max(1000), citation:z.strictObject({title:text.max(500),authors:z.array(text.max(200)).min(1).max(100),url:z.url().refine(v=>['http:','https:'].includes(new URL(v).protocol)).optional()}).optional() }),
  authorship:z.strictObject({kind:z.enum(['user','meta','prepared','imported']),label:text.max(200)}).default({kind:'prepared',label:'Authored teaching example'}),
  spec:widgetSpecSchema, seed:z.number().int().min(0).max(4_294_967_295),
  view:z.strictObject({ step:z.number().int().min(0).max(1000).default(0), selection:z.string().max(100).default(''), sortKey:z.string().max(40).default(''), descending:z.boolean().default(false), filter:z.string().max(100).default(''), zoom:z.number().min(0.5).max(3).default(1) }).default({step:0,selection:'',sortKey:'',descending:false,filter:'',zoom:1}),
});
export type WidgetEnvelope = z.infer<typeof widgetEnvelopeSchema>;
const normalized=(s:string)=>s.replace(/\s+/g,' ').trim();
const trustedSources=new WeakSet<object>();
/** One validated immutable copy per reader/source revision; untrusted mutable inputs never bypass validation. */
export function prepareWidgetSource(input:SourceDocument):SourceDocument{
  if(trustedSources.has(input))return input;
  const source=validateDocument(input);const freeze=(value:unknown)=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}};freeze(source);trustedSources.add(source);return source;
}
export function validateWidgetEnvelope(input:unknown, source:SourceDocument):WidgetEnvelope {
  const doc=trustedSources.has(source)?source:validateDocument(source);const e=widgetEnvelopeSchema.parse(input);const block=doc.blocks.find(x=>x.id===e.source.blockId);const content=block?.kind==='equation'?block.latex:block?.kind==='original-figure'?block.caption:block?.text;
  if(e.source.documentId!==doc.id||e.source.sourceVersion!==doc.sourceVersion||!block||block.page!==e.source.page||!content||!normalized(content).includes(normalized(e.source.quote)))throw Error('The widget source version, block or exact quote is unavailable. The original experiment is retained.');
  if(e.source.citation&&(e.source.citation.title!==doc.title||JSON.stringify(e.source.citation.authors)!==JSON.stringify(doc.authors)||e.source.citation.url!==doc.source.url))throw Error('The portable source citation does not match this document.');
  validateWidgetSpec(e.spec);return e;
}
export function validateWidgetSpec(input:unknown):WidgetSpec {
  const s=widgetSpecSchema.parse(input);
  if(s.kind==='custom')validateCustomWidget(s);
  if(s.kind==='function' && (s.domain[0]>=s.domain[1]||!s.variables.some(v=>v.name===s.xVariable)||s.probe<s.domain[0]||s.probe>s.domain[1]))throw Error('A function needs its declared x variable and a valid probe/domain.');
  if(s.kind==='function'){const x=s.variables.find(v=>v.name===s.xVariable)!;if(s.domain[0]<x.min||s.domain[1]>x.max)throw Error('The plotted domain exceeds its declared variable domain.');}
  if(s.kind==='diagram'||s.kind==='graph'){
    const ids=new Set(s.nodes.map(n=>n.id));if(ids.size!==s.nodes.length||new Set(s.edges.map(e=>e.id)).size!==s.edges.length)throw Error('Node/edge identities must be unique.');
    if(s.edges.some(e=>!ids.has(e.source)||!ids.has(e.target)))throw Error('Every edge endpoint must exist.');
    if(s.kind==='diagram'&&s.steps.some(step=>step.activeNodeIds.some(id=>!ids.has(id))))throw Error('A diagram step refers to a missing node.');
    if(s.kind==='graph'&&s.mode==='graph'&&(!ids.has(s.start)||!ids.has(s.target)))throw Error('Start and target must be existing nodes.');
    if(s.kind==='graph'&&s.blocked.some(n=>n>=s.rows*s.columns))throw Error('A blocked cell exceeds the grid.');
    if(s.kind==='graph'&&s.mode==='grid'){const validRole=(id:string)=>/^c\d+$/.test(id)&&Number(id.slice(1))<s.rows*s.columns&&!s.blocked.includes(Number(id.slice(1)));if(!validRole(s.start)||!validRole(s.target))throw Error('Grid start/target is outside the grid or blocked.');}
  }
  if(s.kind==='table'){
    const ids=s.columns.map(c=>c.id);if(new Set(ids).size!==ids.length||new Set(s.rows.map(r=>r.id)).size!==s.rows.length)throw Error('Table row/column identities must be unique.');
    if(s.rows.some(r=>Object.keys(r.cells).some(k=>!ids.includes(k))))throw Error('A table cell refers to an unknown column.');
  }
  if(s.kind==='attention'){
    const dim=s.queries[0].length,width=s.values[0].length;
    if(s.queries.some(r=>r.length!==dim)||s.keys.some(r=>r.length!==dim)||s.values.some(r=>r.length!==width)||s.keys.length!==s.values.length)throw Error('Q/K feature dimensions and K/V row counts must match.');
    if(s.mask.length&&(s.mask.length!==s.queries.length||s.mask.some(r=>r.length!==s.keys.length)))throw Error('Attention mask must match query × key shape.');
  }
  if(s.kind==='signal'&&(s.input.some(r=>r.length!==s.input[0].length)||s.kernel.some(r=>r.length!==s.kernel[0].length)||s.mode==='1d'&&(s.input.length!==1||s.kernel.length!==1)))throw Error('Signal/kernel must be rectangular; 1D mode uses one row.');
  return s;
}
