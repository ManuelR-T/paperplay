import { z } from 'zod';
import { experimentSnapshotSchema, type SourceDocument, type ExperimentSnapshot } from '../../shared/schema';
import { widgetEnvelopeSchema, validateWidgetEnvelope, type WidgetEnvelope } from '../../shared/widgets';

export const readingPreferencesSchema = z.strictObject({
  version: z.literal(1), fontSize: z.union([z.literal(18), z.literal(20), z.literal(22)]),
  measure: z.number().int().min(55).max(75), lineHeight: z.number().min(1.55).max(1.85),
  theme: z.enum(['light', 'sepia', 'contrast']), focus: z.boolean(),
});
export type ReadingPreferences = z.infer<typeof readingPreferencesSchema>;
export const defaultReadingPreferences: ReadingPreferences = { version: 1, fontSize: 20, measure: 64, lineHeight: 1.75, theme: 'light', focus: false };
export const noteSchema = z.strictObject({
  version: z.literal(1), id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/), documentId: z.string().min(1).max(100),
  sourceVersion: z.string().min(1).max(100), blockId: z.string().min(1).max(100), page: z.number().int().min(1).max(500),
  quote: z.string().min(1).max(1000), text: z.string().max(8000), tags: z.array(z.string().trim().min(1).max(60)).max(12),
  kind: z.enum(['note', 'highlight', 'definition']), createdAt: z.number().finite().nonnegative(), updatedAt: z.number().finite().nonnegative(),
  experiment: experimentSnapshotSchema.optional(), widgetExperiment: widgetEnvelopeSchema.optional(),
});
export type PersonalNote = z.infer<typeof noteSchema>;
export const notesBundleSchema = z.strictObject({ format: z.literal('paperplay-notes'), version: z.literal(1), notes: z.array(noteSchema).max(300) });
export const PREFERENCES_KEY = 'paperplay:reading-preferences:v1';
export const NOTES_KEY = 'paperplay:notes:v1';
export function sourceText(block: SourceDocument['blocks'][number]) { return block.kind === 'equation' ? block.latex : block.kind === 'original-figure' ? block.caption : block.text; }
const normalized = (text: string) => text.replace(/\s+/g, ' ').trim();
export function noteLocation(note: PersonalNote, source: SourceDocument): 'resolved' | 'source-changed' | 'missing-passage' {
  if (note.documentId !== source.id || note.sourceVersion !== source.sourceVersion) return 'source-changed';
  const block = source.blocks.find(item => item.id === note.blockId);
  return block && block.page === note.page && normalized(sourceText(block)).includes(normalized(note.quote)) ? 'resolved' : 'missing-passage';
}
export function createPersonalNote(source: SourceDocument, blockId: string, options: { text?: string; quote?: string; tags?: string[]; kind?: PersonalNote['kind']; experiment?: ExperimentSnapshot; widgetExperiment?: WidgetEnvelope } = {}): PersonalNote {
  const block = source.blocks.find(item => item.id === blockId); if (!block) throw Error('This passage is unavailable.');
  const quote = options.quote?.trim() || sourceText(block).slice(0, 600);
  if (!normalized(sourceText(block)).includes(normalized(quote))) throw Error('The selected quotation does not match this source passage.');
  if (options.kind !== 'highlight' && !(options.text ?? '').trim()) throw Error('Write a note or definition, or choose Highlight to save only the quotation.');
  if (options.kind === 'definition' && !options.tags?.[0]?.trim()) throw Error('Enter a term for this scoped definition.');
  const widgetExperiment = options.widgetExperiment ? validateWidgetEnvelope(options.widgetExperiment,source) : undefined;
  const now = Date.now();
  return noteSchema.parse({ version: 1, id: crypto.randomUUID(), documentId: source.id, sourceVersion: source.sourceVersion, blockId, page: block.page,
    quote, text: options.text ?? '', tags: options.tags ?? [], kind: options.kind ?? 'note', createdAt: now, updatedAt: now, ...(options.experiment ? { experiment: options.experiment } : {}), ...(widgetExperiment ? {widgetExperiment} : {}) });
}
export function parseNotesBundle(text: string): PersonalNote[] {
  if (new TextEncoder().encode(text).length > 2_000_000) throw Error('Choose a notes file smaller than 2 MB.');
  let parsed: z.infer<typeof notesBundleSchema>;
  try { parsed = notesBundleSchema.parse(JSON.parse(text)); } catch { throw Error('This notes file is invalid or uses an unsupported version. Existing notes were not changed.'); }
  if (new Set(parsed.notes.map(note => note.id)).size !== parsed.notes.length) throw Error('The notes file contains repeated note identifiers.');
  return parsed.notes;
}
export function exportNotesBundle(notes: PersonalNote[]) {
  const parsed = notesBundleSchema.safeParse({ format: 'paperplay-notes', version: 1, notes });
  if (!parsed.success) throw Error('A note exceeds its text, tag or experiment limits. Use at most 12 short tags and 8,000 characters per note. Existing notes were not changed.');
  const text = JSON.stringify(parsed.data, null, 2);
  if (new TextEncoder().encode(text).length > 2_000_000) throw Error('The notebook exceeds its 2 MB bound. Export a smaller collection before adding more notes.');
  return text;
}
export function readNotes(storage: Pick<Storage, 'getItem'> = localStorage): PersonalNote[] {
  const text = storage.getItem(NOTES_KEY); if (!text) return [];
  return parseNotesBundle(text);
}
export function saveNotes(notes: PersonalNote[], storage: Pick<Storage, 'setItem'> = localStorage) {
  if (notes.length > 300) throw Error('This local notebook holds up to 300 notes. Export a backup before removing notes.');
  const text = exportNotesBundle(notes); storage.setItem(NOTES_KEY, text);
}
export type GlossaryEntry = { term: string; definition: string; blockId: string; quote: string; scope: string; provenance: 'Authored study aid' | 'Personal definition' };
export function glossaryFor(source: SourceDocument, blockId: string, notes: PersonalNote[] = []): GlossaryEntry[] {
  const block = source.blocks.find(item => item.id === blockId); if (!block) return [];
  const content = sourceText(block);
  const definitions: { term: string; pattern: RegExp; definition: string }[] = source.id === 'quadratic-optimization' ? [
    { term: 'α (alpha)', pattern: /alpha/, definition: 'The step size in the displayed update. In a quadratic model, its admissible range depends on the eigenvalues of A.' },
    { term: 'A', pattern: /A/, definition: 'The matrix defining curvature in this quadratic example. The prepared solver requires a small symmetric positive definite matrix.' },
    { term: 'b', pattern: /b/, definition: 'The supplied right-hand-side vector. A stationary point of this quadratic satisfies Aw = b.' },
    { term: 'β (beta)', pattern: /beta/, definition: 'The momentum coefficient in this displayed recurrence. This meaning is scoped to the momentum section.' },
    { term: 'λᵢ (lambda)', pattern: /lambda/, definition: 'An eigenvalue of A in the diagonalized quadratic analysis. The stability inequality concerns each such direction.' },
    { term: 'wᵏ', pattern: /w/, definition: 'The iterate (parameter vector) at iteration k. It is a model variable, not a measurement from trained neural networks.' },
  ] : source.id === 'priority-search-trees' ? [
    { term: 'priority', pattern: /priority/i, definition: 'A value used to order or select stored entries. The paper distinguishes map/search-tree structure from the priority attached to an entry.' },
    { term: 'Dijkstra', pattern: /Dijkstra/i, definition: 'A shortest-distance method for nonnegative weighted graphs. Paperplay’s toy heap/scan implementations do not implement this paper’s verified priority search tree.' },
    { term: 'getmin', pattern: /getmin/i, definition: 'The operation that retrieves a minimum-priority entry in the displayed priority-map interface. Consult the original type signature for its precise domain.' },
  ] : source.id === 'adaptive-mergesort' ? [
    { term: 'run', pattern: /run/i, definition: 'A consecutive ordered segment of the input. Adaptive mergesort exploits runs already present instead of treating every element as an unrelated singleton.' },
    { term: 'merge cost', pattern: /merge|cost/i, definition: 'A count based on sizes of merged ranges. This operation-based teaching metric is different from measured hardware running time.' },
    { term: 'Powersort', pattern: /Powersort/i, definition: 'A merge scheduling method described by the paper. The prepared implementation checks the scheduling mechanism on synthetic stable-sorting inputs.' },
  ] : [];
  return [ ...definitions.filter(item => item.pattern.test(content)).map(item => ({ term: item.term, definition: item.definition, blockId, quote: content.slice(0, 350), scope: source.blocks.find(item => item.id === block.sectionId)?.kind === 'heading' ? (source.blocks.find(item => item.id === block.sectionId) as { text: string }).text : `This source passage (${block.id})`, provenance: 'Authored study aid' as const })),
    ...notes.filter(note => note.kind === 'definition' && note.blockId === blockId && noteLocation(note, source) === 'resolved').map(note => ({ term: note.tags[0] ?? note.quote, definition: note.text, blockId, quote: note.quote, scope: `Personal definition in ${blockId}`, provenance: 'Personal definition' as const })) ];
}
export function authoredExplanation(source: SourceDocument, blockId: string) {
  const block = source.blocks.find(item => item.id === blockId); if (!block) return null;
  const content = sourceText(block);
  if (source.id === 'quadratic-optimization' && /alpha|quadratic|Aw|lambda/.test(content)) return {
    intuition: 'The matrix determines how steep the objective is in each direction. A step that is gentle in one direction may overshoot in another.',
    example: 'Authored scalar teaching case: A = [2], b = [2], w⁰ = [0], α = 0.25. The gradient is 2·0 − 2 = −2, so the first update gives w¹ = 0 − 0.25·(−2) = 0.5. The stationary solution is w = 1. This hand-worked example is synthetic, not a reported experiment.',
    assumptions: 'This example is one-dimensional and positive definite. General matrices, convergence rates and momentum require their own assumptions; the original equation remains above.',
    technical: 'For f(w) = ½wᵀAw − bᵀw with symmetric A, ∇f(w) = Aw − b. The gradient update subtracts α times this vector. Diagonalizing A reveals the scalar factors 1 − αλᵢ.',
  };
  if (source.id === 'priority-search-trees' && /Dijkstra|priority|getmin/i.test(content)) return {
    intuition: 'Separate the key used to find an entry from the priority used to choose the next entry. The source explains how its data structure supports these operations.',
    example: 'Authored graph teaching case: S→A has weight 4, S→B has weight 1, and B→A has weight 2. Starting at S, the tentative value for A is first 4 and can later improve to 3 through B. These synthetic distances explain an update; they do not execute the paper’s verified tree.',
    assumptions: 'The graph example uses nonnegative weights. The priority-map interface and the functional implementation have additional invariants described in the original.',
    technical: 'The invariant connecting a priority value to a stored key matters independently of which graph algorithm requests the minimum. Read the type signatures and refinements alongside the application.',
  };
  if (source.id === 'adaptive-mergesort' && /merge|run|sort/i.test(content)) return {
    intuition: 'An input can already contain ordered pieces. The order in which these pieces are merged changes how often their elements are processed.',
    example: 'Authored teaching case: three sorted runs have lengths 2, 2 and 8. Merging the first two and then the result with the last costs 4 + 12 = 16 element-visits under the sum-of-merged-lengths model. Merging the last two first costs 10 + 12 = 22. This illustrates the metric; it is not a paper benchmark or a proof of a particular schedule.',
    assumptions: 'Run boundaries are explicit and merging is stable. Operation counts are not elapsed times or a universal speedup guarantee.',
    technical: 'A binary merge tree represents each merge as an internal node. The total merge cost equals the sum of merged range lengths, or equivalently weighted leaf depth for the run lengths.',
  };
  return null;
}
export type SearchEntry = { id: string; documentId: string; sourceVersion: string; title: string; blockId: string; kind: 'passage' | 'note' | 'definition'; text: string };
export function buildSearchEntries(sources: SourceDocument[], notes: PersonalNote[]): SearchEntry[] {
  let characters = 0; const result: SearchEntry[] = [];
  for (const source of sources.slice(0, 100)) for (const block of source.blocks) {
    const text = sourceText(block); if (characters + text.length > 2_000_000 || result.length >= 10_000) break;
    result.push({ id: `${source.id}:${block.id}`, documentId: source.id, sourceVersion: source.sourceVersion, title: source.title, blockId: block.id, kind: 'passage', text }); characters += text.length;
    for (const item of glossaryFor(source, block.id, notes)) result.push({ id: `${source.id}:${block.id}:${item.term}`, documentId: source.id, sourceVersion: source.sourceVersion, title: source.title, blockId: block.id, kind: 'definition', text: `${item.term}: ${item.definition}` });
  }
  for (const note of notes) {
    const source = sources.find(item => item.id === note.documentId && item.sourceVersion === note.sourceVersion);
    if (source && noteLocation(note, source) === 'resolved') result.push({ id: `note:${note.id}`, documentId: source.id, sourceVersion: source.sourceVersion, title: source.title, blockId: note.blockId, kind: note.kind === 'definition' ? 'definition' : 'note', text: `${note.text} ${note.tags.join(' ')}` });
  }
  return result.slice(0, 10_000);
}
export function searchEntries(entries: SearchEntry[], query: string) {
  const words = normalized(query).toLocaleLowerCase().split(' ').filter(Boolean).slice(0, 8); if (!words.length) return [];
  return entries.filter(item => words.every(word => item.text.toLocaleLowerCase().includes(word) || item.title.toLocaleLowerCase().includes(word))).slice(0, 40).map(item => {
    const start = Math.max(0, item.text.toLocaleLowerCase().indexOf(words[0]) - 70);
    return { ...item, text: item.text.slice(start, start + 230) };
  });
}
