import { z } from 'zod';
import { validateDocument, type SourceDocument } from './schema';
import { widgetEnvelopeSchema, validateWidgetEnvelope, type WidgetEnvelope } from './widgets';
import { name, text } from './widget-primitives';

export const REPRESENTATION_VERSION = 1 as const;
export const MAX_REPRESENTATION_BYTES = 256 * 1024;
export const representationAnchorSchema = z.strictObject({ id: name, blockId: z.string().min(1).max(100), page: z.number().int().min(1).max(500), quote: text.max(1000) });
export const evidenceLevelSchema = z.enum(['illustrative-walkthrough','simplified-illustration','mechanism-reproduction','experiment-reproduction']);
const ids = z.array(name).min(1).max(32);
export const representationViewSchema = z.discriminatedUnion('kind', [
  z.strictObject({ id: name, kind: z.literal('widget'), widget: widgetEnvelopeSchema }),
  z.strictObject({ id: name, kind: z.literal('source-guide'), steps: z.array(z.strictObject({ id: name, title: text.max(160), explanation: text, anchorIds: ids })).min(1).max(32) }),
]);
export const representationPlanSchema = z.strictObject({
  format: z.literal('paperplay-representation'), schemaVersion: z.literal(REPRESENTATION_VERSION), id: name, title: text.max(200),
  source: z.strictObject({ documentId: z.string().min(1).max(100), sourceVersion: z.string().min(1).max(100) }),
  authorship: z.strictObject({kind:z.enum(['user','meta','prepared','imported']),label:text.max(200)}),
  objective: text.max(1000), anchors: z.array(representationAnchorSchema).min(1).max(32),
  claims: z.array(z.strictObject({ id: name, kind: z.enum(['source','pedagogical-addition']), text, anchorIds: ids })).min(1).max(32),
  assumptions: z.array(text.max(500)).max(16), requestedEvidence: evidenceLevelSchema,
  assets: z.array(z.strictObject({ id: name, kind: z.enum(['table','tensor','image','sequence','graph','geometry']), description: text.max(500) })).max(32),
  quantities: z.array(z.strictObject({ id: name, symbol: text.max(80), unit: text.max(80), description: text.max(500) })).max(32),
  execution: z.strictObject({ kind: z.enum(['none','local-computation']), capabilities: z.array(z.strictObject({ id: name, version: z.string().regex(/^\d+\.\d+\.\d+$/) })).min(1).max(16), assetIds: z.array(name).max(32) }),
  interactions: z.array(z.enum(['widget-controls','select-step','return-source'])).max(3),
  views: z.array(representationViewSchema).min(1).max(8),
});
export type RepresentationPlan = z.infer<typeof representationPlanSchema>;
export type RepresentationAnchor = z.infer<typeof representationAnchorSchema>;

const normalized = (value: string) => value.replace(/\s+/g,' ').trim();
function unique(values: string[], label: string) { if(new Set(values).size !== values.length) throw Error(`Duplicate ${label}.`); }
export function validateRepresentationPlan(input: unknown, originalSource: SourceDocument): RepresentationPlan {
  if(new TextEncoder().encode(JSON.stringify(input)).length > MAX_REPRESENTATION_BYTES) throw Error('Representation exceeds its 256 KiB allowance.');
  const plan = representationPlanSchema.parse(input), source = validateDocument(originalSource);
  if(plan.source.documentId !== source.id || plan.source.sourceVersion !== source.sourceVersion) throw Error('This representation requires its exact source version.');
  for(const [values,label] of [[plan.anchors,'anchor'],[plan.claims,'claim'],[plan.views,'view'],[plan.assets,'asset'],[plan.quantities,'quantity'],[plan.execution.capabilities,'capability']] as const) unique(values.map(value=>value.id),label);
  unique(plan.interactions,'interaction'); unique(plan.execution.assetIds,'asset binding');
  const anchors = new Map(plan.anchors.map(anchor=>[anchor.id,anchor]));
  const checkAnchors = (refs: string[]) => { unique(refs,'anchor reference'); if(refs.some(id=>!anchors.has(id))) throw Error('A representation refers to an undeclared source anchor.'); };
  for(const anchor of plan.anchors) {
    const block=source.blocks.find(block=>block.id===anchor.blockId);
    const content=block?.kind==='equation'?block.latex:block?.kind==='original-figure'?block.caption:block?.text;
    if(!block || block.page !== anchor.page || !content || !normalized(content).includes(normalized(anchor.quote))) throw Error('A representation quote or page does not match the original source.');
  }
  for(const claim of plan.claims) {
    checkAnchors(claim.anchorIds);
    // A source claim is a quotation; interpretation belongs to the added layer.
    if(claim.kind==='source'&&!claim.anchorIds.some(id=>normalized(anchors.get(id)!.quote).includes(normalized(claim.text)))) throw Error('A source claim must quote its anchor; label interpretations as pedagogical additions.');
  }
  if(plan.execution.assetIds.some(id=>!plan.assets.some(asset=>asset.id===id))) throw Error('Execution requires an undeclared asset.');
  for(const view of plan.views) {
    const capability=view.kind==='widget'?'widget-v2':'source-guide';
    if(!plan.execution.capabilities.some(item=>item.id===capability)) throw Error('A view requires its declared execution capability.');
    if(view.kind==='widget') {
      validateWidgetEnvelope(view.widget,source);
      if(!plan.anchors.some(anchor=>anchor.blockId===view.widget.source.blockId&&anchor.page===view.widget.source.page&&normalized(anchor.quote)===normalized(view.widget.source.quote))) throw Error('A widget must use an anchor declared in its representation.');
      if(plan.execution.kind!=='local-computation') throw Error('Widget views require local computation.');
    } else { unique(view.steps.map(step=>step.id),'guide step'); view.steps.forEach(step=>checkAnchors(step.anchorIds)); }
  }
  if(plan.interactions.includes('widget-controls')&&!plan.views.some(view=>view.kind==='widget')) throw Error('This representation has no widget controls.');
  if(plan.interactions.includes('select-step')&&!plan.views.some(view=>view.kind==='source-guide')) throw Error('This representation has no source-guide steps.');
  return plan;
}

/** Wrap an existing snapshot without changing its source, input, view or authorship. */
export function representationFromWidget(input: WidgetEnvelope, source: SourceDocument): RepresentationPlan {
  const widget=validateWidgetEnvelope(input,source);
  return validateRepresentationPlan({
    format:'paperplay-representation',schemaVersion:1,id:widget.id,title:widget.title,
    source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:widget.authorship,objective:widget.spec.mapping,
    anchors:[{id:'passage',blockId:widget.source.blockId,page:widget.source.page,quote:widget.source.quote}],
    claims:[{id:'mapping',kind:'pedagogical-addition',text:widget.spec.mapping,anchorIds:['passage']}],assumptions:[],requestedEvidence:widget.spec.kind==='diagram'?'illustrative-walkthrough':'simplified-illustration',
    assets:[],quantities:[],execution:{kind:'local-computation',capabilities:[{id:'widget-v2',version:'2.1.0'}],assetIds:[]},interactions:['widget-controls','return-source'],views:[{id:'figure',kind:'widget',widget}],
  },source);
}
