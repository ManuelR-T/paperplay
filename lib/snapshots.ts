import { z } from 'zod';
import { experimentSnapshotSchema, sourceDocumentSchema, validateDocument, validateSnapshot, validateFigure, type ExperimentSnapshot, type SourceDocument } from '../shared/schema';
import { engineRegistry } from './engines';
import { preparedPapers, type PreparedPaper } from '../data/papers';
import { preparedFromSnapshot } from './reading-state';
import { createPreparedExperiment } from './prepared-figures';

export const MAX_SNAPSHOT_ENCODED = 12_000;
export const MAX_SNAPSHOT_BYTES = 8_000;
export const MAX_BUNDLE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const encoder = new TextEncoder();
function plainStrings(value: unknown) {
  if (typeof value === 'string' && /<\/?[a-z][^>]*>|javascript\s*:/i.test(value)) throw new Error('Snapshot figure content must be plain text.');
  if (Array.isArray(value)) value.forEach(plainStrings);
  else if (value && typeof value === 'object') Object.values(value).forEach(plainStrings);
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = ''; for (let offset = 0; offset < bytes.length; offset += 16_384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value); return Uint8Array.from(binary, character => character.charCodeAt(0));
}
/** Public prepared figures must remain in their registered scientific family and placement. */
export function validatePreparedSnapshot(value: unknown, paper: PreparedPaper): ExperimentSnapshot {
  const snapshot = validateSnapshot(value, paper.document, engineRegistry);
  const entry = Object.entries(paper.illustrationAnchors).find(([kind]) => snapshot.figure.id === `${paper.id}-${kind}`);
  if (!entry) throw new Error('The snapshot references an unknown prepared figure ID.');
  const [kind, anchorId] = entry;
  if (snapshot.figure.sourceAnchorIds.length !== 1 || snapshot.figure.sourceAnchorIds[0] !== anchorId) throw new Error('The snapshot does not match the prepared figure source anchor.');
  const figure = snapshot.figure;
  const family = createPreparedExperiment(paper).input.kind;
  if (kind === 'walkthrough') {
    if (family === 'matrix' ? figure.kind !== 'plot' || figure.execution.mode !== 'computed' : figure.kind !== 'steps') throw new Error('The prepared guide does not match this source family.');
  } else if (kind === 'comparison') {
    if (figure.kind !== 'comparison' || figure.input.kind !== family) throw new Error('The snapshot is incompatible with this prepared comparison family.');
  } else if ((figure.kind !== 'graph' && figure.kind !== 'array' && figure.kind !== 'matrix') || figure.kind !== family || figure.execution.mode !== 'computed') {
    throw new Error('The snapshot is incompatible with this prepared mechanism family.');
  }
  plainStrings(figure);
  return snapshot;
}
function knownPublicSnapshot(value: unknown): { paper: PreparedPaper; snapshot: ExperimentSnapshot } {
  const parsed = experimentSnapshotSchema.parse(value);
  const paper = preparedPapers.find(item => item.document.id === parsed.documentId);
  if (!paper) throw new Error('URL sharing supports prepared public papers only. Export a bundle to move a local paper; a URL does not transfer its PDF.');
  const snapshot = validatePreparedSnapshot(parsed, paper);
  if (snapshot.figure.id !== `${paper.id}-primary`) throw new Error('Public URLs currently support the prepared mechanism figure.');
  return { paper, snapshot };
}
export function encodePublicSnapshot(value: ExperimentSnapshot): string {
  const { snapshot } = knownPublicSnapshot(value); const bytes = encoder.encode(JSON.stringify(snapshot));
  if (bytes.byteLength > MAX_SNAPSHOT_BYTES) throw new Error('This snapshot is too large for a URL. Export an experiment bundle instead.');
  const encoded = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (encoded.length > MAX_SNAPSHOT_ENCODED) throw new Error('This snapshot is too large for a URL. Export an experiment bundle instead.');
  return encoded;
}
export function decodePublicSnapshot(encoded: string) {
  if (!encoded || encoded.length > MAX_SNAPSHOT_ENCODED || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('The shared snapshot is corrupt or too large.');
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = base64ToBytes(base64 + '='.repeat((4 - base64.length % 4) % 4));
    if (bytes.byteLength > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot decoded size exceeds the limit.');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const { paper, snapshot } = knownPublicSnapshot(JSON.parse(text));
    return { paper, snapshot, state: preparedFromSnapshot(snapshot, paper.document) };
  } catch (error) { throw new Error(`The shared snapshot could not be opened. ${error instanceof Error ? error.message : 'Invalid data.'}`); }
}

export const bundleAttributionSchema = z.strictObject({
  authors: z.string().min(1).max(2000), notice: z.string().min(1).max(5000),
  sourceUrl: z.url().refine(value => /^https?:/.test(value)).optional(),
  license: z.string().min(1).max(500).optional(), licenseUrl: z.url().refine(value => /^https?:/.test(value)).optional(),
});
export type BundleAttribution = z.infer<typeof bundleAttributionSchema>;
const bundleSchema = z.strictObject({
  format: z.literal('paperplay-experiment'), bundleVersion: z.literal(1), createdAt: z.string().datetime(),
  contents: z.enum(['metadata-only', 'source-text', 'source-text-and-pdf']), snapshot: experimentSnapshotSchema,
  source: sourceDocumentSchema.optional(), attribution: bundleAttributionSchema,
  original: z.strictObject({ name: z.string().min(1).max(500), mime: z.literal('application/pdf'), byteLength: z.number().int().min(1).max(MAX_PDF_BYTES), base64: z.string().max(Math.ceil(MAX_PDF_BYTES / 3) * 4) }).optional(),
});
export type ExperimentBundle = z.infer<typeof bundleSchema>;
function validateUnresolvedSnapshot(snapshot: ExperimentSnapshot) {
  // This validates shapes, graph endpoints and engine versions only. It never
  // certifies the absent source's quotations or activates a figure for reading.
  const temporary: SourceDocument = { schemaVersion: 1, id: snapshot.documentId, sourceVersion: snapshot.sourceVersion,
    title: 'Unavailable source reference', authors: ['Unavailable source'], source: { kind: 'pdf' }, pageCount: 1,
    blocks: [{ kind: 'paragraph', id: 'unavailable-source', page: 1, text: 'Unavailable source reference.' }],
    anchors: snapshot.figure.sourceAnchorIds.map(id => ({ id, blockId: 'unavailable-source', page: 1, quote: 'Unavailable source reference.' })), extractionWarnings: [] };
  validateFigure(snapshot.figure, temporary, engineRegistry);
}
function defaultAttribution(source: SourceDocument | undefined, snapshot: ExperimentSnapshot): BundleAttribution {
  const paper = preparedPapers.find(item => item.document.id === snapshot.documentId && item.document.sourceVersion === snapshot.sourceVersion);
  if (paper) return { authors: paper.attribution.authors, notice: paper.attribution.notice, sourceUrl: paper.sourceUrl, license: paper.attribution.license, licenseUrl: paper.attribution.licenseUrl };
  if (!source) throw new Error('Attribution is required when the referenced local source is unavailable.');
  return { authors: source.authors.join(' · '), notice: 'Source belongs to its authors. Importing or exporting does not establish redistribution permission.', ...(source.source.url ? { sourceUrl: source.source.url } : {}) };
}
export async function createExperimentBundle(options: {
  snapshot: ExperimentSnapshot; source?: SourceDocument; original?: Blob; originalName?: string;
  includeSource: boolean; includePdf: boolean; attribution?: BundleAttribution;
}): Promise<string> {
  const snapshot = experimentSnapshotSchema.parse(options.snapshot); plainStrings(snapshot.figure);
  const source = options.source ? validateDocument(options.source) : preparedPapers.find(paper => paper.document.id === snapshot.documentId)?.document;
  if (source) validateSnapshot(snapshot, source, engineRegistry); else validateUnresolvedSnapshot(snapshot);
  if (options.includeSource && !source) throw new Error('The source text is unavailable on this device.');
  if (options.includePdf && !options.includeSource) throw new Error('Including a PDF requires explicit source-text inclusion as well.');
  if (options.includePdf && !options.original) throw new Error('The original PDF is unavailable on this device.');
  let original: ExperimentBundle['original'];
  if (options.includePdf && options.original) {
    if (options.original.size < 1 || options.original.size > MAX_PDF_BYTES) throw new Error('A bundled PDF must be between 1 byte and 10 MiB.');
    const bytes = new Uint8Array(await options.original.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('The original file is not a PDF.');
    original = { name: options.originalName ?? 'original.pdf', mime: 'application/pdf', byteLength: bytes.byteLength, base64: bytesToBase64(bytes) };
  }
  const bundle = bundleSchema.parse({ format: 'paperplay-experiment', bundleVersion: 1, createdAt: new Date().toISOString(),
    contents: options.includePdf ? 'source-text-and-pdf' : options.includeSource ? 'source-text' : 'metadata-only', snapshot,
    attribution: options.attribution ?? defaultAttribution(source, snapshot), ...(options.includeSource ? { source } : {}), ...(original ? { original } : {}) });
  const text = JSON.stringify(bundle, null, 2);
  if (encoder.encode(text).byteLength > MAX_BUNDLE_BYTES) throw new Error('The experiment bundle exceeds the 20 MiB limit.');
  return text;
}
export async function parseExperimentBundle(text: string, options: { sources?: SourceDocument[] } = {}): Promise<{
  snapshot: ExperimentSnapshot; source?: SourceDocument; original?: Blob; originalName?: string;
  attribution: BundleAttribution; missingSource: boolean; contents: ExperimentBundle['contents'];
}> {
  if (encoder.encode(text).byteLength > MAX_BUNDLE_BYTES) throw new Error('The experiment bundle exceeds the 20 MiB limit.');
  let bundle: ExperimentBundle;
  try { bundle = bundleSchema.parse(JSON.parse(text)); } catch { throw new Error('The experiment bundle is damaged or uses an unsupported format version.'); }
  plainStrings(bundle.snapshot.figure);
  const { contents } = bundle;
  if ((contents === 'metadata-only' && (bundle.source || bundle.original)) || (contents !== 'metadata-only' && !bundle.source) || (contents === 'source-text-and-pdf') !== !!bundle.original) throw new Error('The bundle contents do not match its inclusion declaration.');
  const available = [...preparedPapers.map(item => item.document), ...(options.sources ?? [])];
  const source = bundle.source ? validateDocument(bundle.source) : available.find(item => item.id === bundle.snapshot.documentId && item.sourceVersion === bundle.snapshot.sourceVersion);
  if (source) validateSnapshot(bundle.snapshot, source, engineRegistry); else validateUnresolvedSnapshot(bundle.snapshot);
  let original: Blob | undefined;
  if (bundle.original) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(bundle.original.base64)) throw new Error('The bundled PDF encoding is damaged.');
    const bytes = base64ToBytes(bundle.original.base64);
    if (bytes.byteLength !== bundle.original.byteLength || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('The bundled PDF is damaged or has a mismatched size.');
    original = new Blob([bytes], { type: 'application/pdf' });
  }
  return { snapshot: bundle.snapshot, ...(source ? { source } : {}), ...(original ? { original, originalName: bundle.original!.name } : {}), attribution: bundle.attribution, missingSource: !source, contents };
}
