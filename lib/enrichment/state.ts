import { z } from 'zod';
import { validateWidgetEnvelope, widgetEnvelopeSchema, type WidgetEnvelope } from '../../shared/widgets';
import type { SourceDocument } from '../../shared/schema';
import { enrichmentResultSchema, type EnrichmentAction, type EnrichmentBudget, type EnrichmentJob, type EnrichmentResult } from './contracts';
import { WIDGET_CATALOG_VERSION } from '../widgets/catalog';

export type PendingEnrichment = { requestId: string; sectionId: string; action: EnrichmentAction; feedback: string; target?: WidgetEnvelope; job?: EnrichmentJob; uncertain?: boolean };
export type EnrichmentState = { version: 2; catalogVersion: string; fingerprint: string; coverage: Record<string, 'analysed' | 'unsupported' | 'failed'>; decisions: Record<string, 'accepted' | 'deferred' | 'removed'>; plans: EnrichmentResult[]; accepted: WidgetEnvelope[]; history: Record<string, WidgetEnvelope[]>; pending?: PendingEnrichment; budget?: EnrichmentBudget };
const pendingSchema = z.strictObject({ requestId: z.string().regex(/^[a-zA-Z0-9-]{16,100}$/), sectionId: z.string().max(100), action: z.enum(['plan','repair','edit']), feedback: z.string().max(1200), target: widgetEnvelopeSchema.optional(), uncertain: z.boolean().optional(), job: z.strictObject({ token: z.string().max(5000), createdAt: z.number().finite(), action: z.enum(['plan','repair','edit']), sectionId: z.string().max(100), model: z.string().max(120) }).optional() });
const schema = z.strictObject({ version: z.literal(2), catalogVersion: z.string().max(30), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), coverage: z.record(z.string().max(100), z.enum(['analysed','unsupported','failed'])), decisions: z.record(z.string().max(40), z.enum(['accepted','deferred','removed'])).default({}), plans: z.array(enrichmentResultSchema).max(32), accepted: z.array(widgetEnvelopeSchema).max(32), history: z.record(z.string().max(40), z.array(widgetEnvelopeSchema).max(8)), pending: pendingSchema.optional(), budget: z.strictObject({ requests: z.number().int().min(0), maxRequests: z.number().int().positive(), accountedTokens: z.number().int().min(0), maxTokens: z.number().int().positive() }).optional() });
const PREFIX = 'paperplay:enrichment:v2:';
export function enrichmentStorageKey(source: SourceDocument, fingerprint: string) { return `${PREFIX}${source.id}:${fingerprint}`; }
/** Added figure anchors are not original source changes; source content/provenance still participates in full identity. */
export function enrichmentSourceIdentity(source: SourceDocument) { return JSON.stringify({ ...source, anchors: [] }); }
export async function enrichmentFingerprint(source: SourceDocument) { const bytes = new TextEncoder().encode(enrichmentSourceIdentity(source)); return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); }
export function emptyEnrichmentState(fingerprint: string): EnrichmentState { return { version: 2, catalogVersion: WIDGET_CATALOG_VERSION, fingerprint, coverage: {}, decisions: {}, plans: [], accepted: [], history: {} }; }
export function parseEnrichmentState(raw: string, source: SourceDocument, fingerprint: string): EnrichmentState {
  if (new TextEncoder().encode(raw).byteLength > 2_000_000) throw Error('The saved enrichment exceeds the local cache limit.');
  const state = schema.parse(JSON.parse(raw));
  if (state.fingerprint !== fingerprint || state.catalogVersion !== WIDGET_CATALOG_VERSION) throw Error('This saved enrichment belongs to a different source or catalog version. Its original record was retained.');
  for (const e of [...state.accepted, ...Object.values(state.history).flat(), ...state.plans.flatMap(p => p.proposals.map(v => v.envelope)), ...(state.pending?.target ? [state.pending.target] : [])]) validateWidgetEnvelope(e, source);
  return state;
}
export function acceptEnrichmentWidget(state: EnrichmentState, envelope: WidgetEnvelope): EnrichmentState {
  const previous = state.accepted.find(e => e.id === envelope.id); const history = { ...state.history };
  if (previous && JSON.stringify(previous) !== JSON.stringify(envelope)) history[envelope.id] = [...(Object.hasOwn(history,envelope.id) ? history[envelope.id] : []), previous].slice(-8);
  const accepted = [...state.accepted.filter(e => e.id !== envelope.id), envelope];
  if (accepted.length > 32) throw Error('At most 32 accepted enrichment widgets can be kept in one paper cache.');
  return { ...state, accepted, history };
}
export function undoEnrichmentWidget(state: EnrichmentState, id: string) {
  const history = [...(Object.hasOwn(state.history,id) ? state.history[id] : [])]; const previous = history.pop();
  if (!previous) return { state, envelope: undefined };
  return { state: { ...state, history: { ...state.history, [id]: history }, accepted: state.accepted.map(e => e.id === id ? previous : e) }, envelope: previous };
}
export function serializeEnrichmentState(state: EnrichmentState) { const parsed = schema.parse(state); const raw = JSON.stringify(parsed); if (new TextEncoder().encode(raw).byteLength > 2_000_000) throw Error('Enrichment is available now, but this cache exceeds 2 MB and was not saved. Export accepted widgets before closing.'); return raw; }
/** Called on explicit source removal. Never visits or clears unrelated browser storage. */
export function forgetEnrichment(sourceId: string, storage: Storage = localStorage) { const prefix = `${PREFIX}${sourceId}:`; const keys = Array.from({ length: storage.length }, (_,i) => storage.key(i)).filter((k): k is string => !!k && k.startsWith(prefix)); keys.forEach(k => storage.removeItem(k)); }
