import type { CustomWidgetSpec } from '../../shared/custom-widget';
import { z } from 'zod';
import {paperReadingGuideSchema,type PaperPlan,type PaperReadingGuide} from './whole-paper';
import {capabilitySelectionReceiptSchema,modelRequestAccountingSchema,type CapabilitySelectionReceipt,type ModelRequestAccounting} from '../../shared/capability-retrieval';
import type { SourceDocument } from '../../shared/schema';
import { validateWidgetEnvelope, validateWidgetSpec, prepareWidgetSource, widgetEnvelopeSchema, WIDGET_KINDS, type WidgetEnvelope } from '../../shared/widgets';
import { sourceBlockText, type SourceSection } from './sections';
import { computeWidget } from '../widgets/compute';

const plain = z.string().trim().min(1).max(2000).refine(s => !/<\/?[a-z][^>]*>|javascript\s*:/i.test(s), 'Only plain text is supported.');
function shortHash(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
function checkControlPromises(prose: string, kind: WidgetEnvelope['spec']['kind'], controls: readonly string[]) {
  const instruction = String.raw`(?:^|[.!?]\s+|\b(?:you|readers?|users?)\s+(?:can|may)\s+)`;
  if (new RegExp(instruction + String.raw`(?:use|adjust|move|drag)\s+(?:(?:the|a)\s+)?(?:parameter\s+)?sliders?\b`, 'i').test(prose) && (!controls.some(c=>/slider/i.test(c)) || /parameter\s+slider/i.test(prose) && !controls.some(c=>/parameter.*slider|slider.*parameter/i.test(c)))) throw Error('This catalog does not declare the promised slider interaction.');
  if (kind !== 'graph' && new RegExp(instruction + String.raw`(?:drag|move|reposition|add|remove|draw)\s+(?:the\s+)?(?:graph\s+)?(?:nodes?|vertices|edges?|obstacles)\b`, 'i').test(prose)) throw Error('This widget does not declare the promised graph editor.');
  if (kind !== 'graph' && new RegExp(instruction + String.raw`(?:edit|toggle|click)\s+(?:the\s+)?(?:blocked|grid)\s+cells?\b`, 'i').test(prose)) throw Error('This widget does not declare a blocked-grid cell editor.');
  if (kind !== 'attention' && new RegExp(instruction + String.raw`(?:edit|toggle|click)\s+(?:the\s+)?mask\s+cells?\b`, 'i').test(prose)) throw Error('This widget does not declare an attention-mask editor.');
  if (!['graph','attention','linear','signal'].includes(kind) && new RegExp(instruction + String.raw`(?:edit|toggle|click)\s+(?:the\s+)?cells?\b`, 'i').test(prose)) throw Error('This widget does not declare the promised cell editor.');
  if (new RegExp(instruction + String.raw`(?:train|fine-tune|finetune)\s+(?:the\s+)?(?:original\s+)?(?:model|transformer|network)\b`, 'i').test(prose)) throw Error('The widget catalog does not train an original model.');
}
/** Meta requests a new isolated interaction when a catalog specification cannot express its chosen concept. */
export const enrichmentCustomFigureSchema = z.strictObject({
  id:z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/),title:plain.max(200),concept:plain.max(300),objective:plain.max(1000),
  blockId:z.string().min(1).max(100),page:z.number().int().min(1).max(500),quote:plain.max(1000),brief:plain.max(1200),
});
export type EnrichmentCustomFigure = z.infer<typeof enrichmentCustomFigureSchema>;
export const enrichmentPlanSchema = z.strictObject({
  summary: plain,
  proposals: z.array(z.strictObject({ id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/), title: plain.max(200), concept: plain.max(300), blockId: z.string().min(1).max(100), page: z.number().int().min(1).max(500), quote: plain.max(1000),
    reason: plain.max(1000), objective: plain.max(1000), neededData: z.array(plain.max(300)).max(8), provenance: z.enum(['synthetic', 'illustrative']),
    interactions: z.array(plain.max(100)).max(12), specJson: z.string().min(2).max(20_000), limitations: z.array(plain.max(500)).max(8) })).max(4),
  customFigures:z.array(enrichmentCustomFigureSchema).max(4).default([]),
  warnings: z.array(plain.max(1000)).max(12), repetitionReason: z.string().max(1000),
});
/** Trusted application hook; throwing rejects only this candidate, never mutates source or grants fidelity. */
export type CustomWidgetReview = (candidate: CustomWidgetSpec, context: { source: SourceDocument; quote: string; blockId: string }) => void;
export type EnrichmentAction = 'plan' | 'repair' | 'edit';
export type EnrichmentProposal = { id: string; concept: string; reason: string; objective: string; neededData: string[]; provenance: 'synthetic' | 'illustrative'; interactions: string[]; limitations: string[]; envelope: WidgetEnvelope; diff?: Array<{ path: string; before: string; after: string }> };
export type EnrichmentResult = { action: EnrichmentAction; sectionId: string; sectionTitle: string; catalogVersion: string; model: string; summary: string; proposals: EnrichmentProposal[]; customFigures?:EnrichmentCustomFigure[]; readingGuide?:PaperReadingGuide; rejected: Array<{ id: string; reason: string }>; warnings: string[]; repetitionReason: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number };retrieval?:CapabilitySelectionReceipt;accounting?:ModelRequestAccounting };
export type EnrichmentJob = { token: string; createdAt: number; action: EnrichmentAction; sectionId: string; model: string };
export type EnrichmentBudget = { requests: number; maxRequests: number; accountedTokens: number; maxTokens: number };
export type EnrichmentReply = { status: 'queued' | 'analyzing' | 'complete' | 'failed' | 'cancelled' | 'expired' | 'incomplete'; job?: EnrichmentJob; result?: EnrichmentResult; paperPlan?:PaperPlan; budget?: EnrichmentBudget; error?: string; uncertain?: boolean;retrieval?:CapabilitySelectionReceipt;accounting?:ModelRequestAccounting };

export const enrichmentResultSchema = z.strictObject({ retrieval:capabilitySelectionReceiptSchema.optional(),accounting:modelRequestAccountingSchema.optional(),action: z.enum(['plan','repair','edit']), sectionId: z.string().min(1).max(100), sectionTitle: z.string().min(1).max(1000), catalogVersion: z.string().max(30), model: z.string().max(120), summary: plain,
  readingGuide:paperReadingGuideSchema.optional(),
  proposals: z.array(z.strictObject({ id: z.string().max(40), concept: plain.max(300), reason: plain.max(1000), objective: plain.max(1000), neededData: z.array(plain.max(300)).max(8), provenance: z.enum(['synthetic','illustrative']), interactions: z.array(plain.max(100)).max(12), limitations: z.array(plain.max(500)).max(8), envelope: widgetEnvelopeSchema, diff: z.array(z.strictObject({ path: z.string().max(500), before: z.string().max(25_000), after: z.string().max(25_000) })).max(100).optional() })).max(4),
  customFigures:z.array(enrichmentCustomFigureSchema).max(4).default([]),
  rejected: z.array(z.strictObject({ id: z.string().max(40), reason: z.string().max(2000) })).max(8), warnings: z.array(z.string().max(2000)).max(20), repetitionReason: z.string().max(1000), usage: z.strictObject({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0), totalTokens: z.number().int().min(0) }).optional(),
});

export function configurationDiff(before: unknown, after: unknown) {
  const changes: Array<{ path: string; before: string; after: string }> = [];
  function visit(a: unknown, b: unknown, path: string, depth: number) {
    if (changes.length >= 100 || depth > 15) throw Error('The proposed change is too large to review safely.');
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path}.${key}` : key, depth + 1);
    } else changes.push({ path, before: JSON.stringify(a) ?? '(absent)', after: JSON.stringify(b) ?? '(absent)' });
  }
  visit(before, after, '', 0); return changes;
}

export function compileEnrichmentPlan(input: unknown, options: { source: SourceDocument; section: SourceSection; action: EnrichmentAction; target?: WidgetEnvelope; model: string; catalogVersion: string; allowedInteractions: (kind: typeof WIDGET_KINDS[number]) => readonly string[]; usage?: EnrichmentResult['usage']; reviewCustom?: CustomWidgetReview;allowedKind?:(kind:WidgetEnvelope['spec']['kind'])=>void }): EnrichmentResult {
  const plan = enrichmentPlanSchema.parse(input); const { source, section, action, target } = options;
  const proposals: EnrichmentProposal[] = []; const rejected: EnrichmentResult['rejected'] = []; const seen = new Set<string>();
  for (const proposal of plan.proposals) {
    try {
      if (seen.has(proposal.id)) throw Error('Duplicate proposal identity.'); seen.add(proposal.id);
      const block = source.blocks.find(b => b.id === proposal.blockId);
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      if (!block || block.page !== proposal.page || norm(proposal.quote).length < 12 || !norm(sourceBlockText(block)).includes(norm(proposal.quote))) throw Error('The exact quote, source block or page is invalid.');
      if (!section.segments.some(s => s.blockId === block.id && norm(s.text).includes(norm(proposal.quote)))) throw Error('The proposal is outside the selected section coverage.');
      if (target && (proposal.blockId !== target.source.blockId || proposal.quote !== target.source.quote)) throw Error('A targeted change must preserve the widget source anchor.');
      const spec = validateWidgetSpec(JSON.parse(proposal.specJson));options.allowedKind?.(spec.kind);
      if (spec.kind === 'table' && spec.provenance !== 'illustrative') throw Error('Generated tables must be labeled illustrative; source/computed provenance needs separate verified data.');
      if(spec.kind==='custom'&&options.reviewCustom){
        const candidate=structuredClone(spec);
        const freeze=(value:unknown)=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};freeze(candidate);
        options.reviewCustom(candidate,{source:prepareWidgetSource(source),quote:proposal.quote,blockId:block.id});
      }
      const initial = computeWidget(spec,target?.seed ?? 42);
      if (spec.kind === 'function' && initial.points?.every(p=>p.y === null)) throw Error('The proposed function is undefined across its entire declared plotting domain.');
      const controls = options.allowedInteractions(spec.kind);
      if (proposal.interactions.some(c => !controls.includes(c))) throw Error('The proposed interaction is unavailable in this catalog entry.');
      checkControlPromises([proposal.reason, proposal.objective, spec.mapping, ...proposal.limitations].join('. '), spec.kind, controls);
      if (action === 'edit' && target && spec.kind !== target.spec.kind) throw Error('A configuration edit cannot replace a widget type. Use an explicit replacement instead.');
      const envelope = validateWidgetEnvelope({ ...(target ?? {}), format: 'paperplay-widget', schemaVersion: 2, id: target?.id ?? `${proposal.id.slice(0,24)}-${shortHash(`${section.id}:${block.id}:${proposal.quote}:${spec.kind}`)}`, title: target?.title ?? proposal.title,
        authorship: { kind: 'meta', label: target ? `Meta-proposed revision of a ${target.authorship.kind}-authored widget` : 'Meta-proposed teaching model' },
        source: target?.source ?? { documentId: source.id, sourceVersion: source.sourceVersion, blockId: block.id, page: block.page, quote: proposal.quote, citation: { title: source.title, authors: source.authors, ...(source.source.url ? { url: source.source.url } : {}) } }, spec, seed: target?.seed ?? 42,
        ...(target ? { view: { ...target.view, step: 0, selection: '' } } : {}) }, source);
      const diff = target ? configurationDiff(target.spec, spec) : undefined;
      if (diff && !diff.length) throw Error('The proposal is unchanged; the existing valid widget is retained.');
      proposals.push({ id: proposal.id, concept: proposal.concept, reason: proposal.reason, objective: proposal.objective, neededData: proposal.neededData, provenance: proposal.provenance, interactions: proposal.interactions, limitations: spec.kind==='custom'?[...proposal.limitations.slice(0,7),'Model-designed teaching program. Local evaluation does not independently validate scientific correctness.']:proposal.limitations, envelope, ...(diff ? { diff } : {}) });
      if (action !== 'plan') break;
    } catch (error) { rejected.push({ id: proposal.id, reason: error instanceof z.ZodError ? ('The proposed configuration does not match the widget catalog schema: '+error.issues.slice(0,6).map(issue=>issue.path.join('.')+': '+issue.message).join('; ')).slice(0,1000) : error instanceof SyntaxError ? 'The proposed configuration is not valid JSON.' : error instanceof Error ? error.message.slice(0,1000) : 'This proposal failed validation.' }); }
  }
  const customFigures:EnrichmentCustomFigure[]=[];
  for(const request of plan.customFigures){
    try{
      if(action!=='plan')throw Error('A targeted repair or settings edit cannot request a new generated interaction.');
      if(seen.has(request.id))throw Error('Duplicate proposal identity.');seen.add(request.id);
      const block=source.blocks.find(block=>block.id===request.blockId),norm=(value:string)=>value.replace(/\s+/g,' ').trim();
      if(!block||block.page!==request.page||norm(request.quote).length<12||!norm(sourceBlockText(block)).includes(norm(request.quote)))throw Error('The exact quote, source block or page is invalid.');
      if(!section.segments.some(segment=>segment.blockId===block.id&&norm(segment.text).includes(norm(request.quote))))throw Error('The custom figure request is outside the selected section coverage.');
      customFigures.push(request);
    }catch(error){rejected.push({id:request.id,reason:error instanceof Error?error.message.slice(0,1000):'The custom figure request failed validation.'});}
  }
  const warnings = [...plan.warnings];
  if (proposals.length > 1 && new Set(proposals.map(p => p.envelope.spec.kind)).size === 1 && !plan.repetitionReason.trim()) warnings.push('Repeated widget types have no supplied pedagogical reason; inspect the plan before accepting.');
  return { action, sectionId: section.id, sectionTitle: section.title, catalogVersion: options.catalogVersion, model: options.model, summary: plan.summary, proposals, customFigures, rejected, warnings, repetitionReason: plan.repetitionReason, ...(options.usage ? { usage: options.usage } : {}) };
}
