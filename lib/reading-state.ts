import { z } from 'zod';
import { experimentSnapshotSchema, validateSnapshot, type ExperimentSnapshot, type SourceDocument } from '../shared/schema';
import { engineRegistry } from './engines';
import { createEngineFigure, type PreparedExperimentState } from './prepared-figures';
import type { PreparedPaper } from '../data/papers';

const shortId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
export const figureViewStateSchema = z.strictObject({ snapshot: experimentSnapshotSchema, stepIndex: z.number().int().min(0).max(9999), selection: z.string().max(100) });
export type FigureViewState = z.infer<typeof figureViewStateSchema>;
export const readingStateSchema = z.strictObject({
  schemaVersion: z.literal(1), documentId: shortId, sourceVersion: z.string().min(1).max(100), updatedAt: z.number().finite().min(0),
  position: z.strictObject({ blockId: shortId.optional(), figureId: shortId.optional(), scrollY: z.number().finite().min(0).max(10_000_000) }),
  experiment: experimentSnapshotSchema.optional(), figures: z.array(figureViewStateSchema).max(32),
});
export type ReadingState = z.infer<typeof readingStateSchema>;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'paperplay:reading:v1:';
const recentKey = 'paperplay:recent:v1';
const maxStateBytes = 1_000_000;
function storageOrDefault(storage?: StorageLike) { return storage ?? globalThis.localStorage; }
export function validateReadingState(value: unknown, source: SourceDocument): ReadingState {
  const state = readingStateSchema.parse(value);
  if (state.documentId !== source.id || state.sourceVersion !== source.sourceVersion) throw new Error('Saved reading state belongs to a different source or normalization version.');
  if (state.position.blockId && !source.blocks.some(block => block.id === state.position.blockId)) throw new Error('The saved reading passage is unavailable.');
  const snapshots = [...(state.experiment ? [state.experiment] : []), ...state.figures.map(item => item.snapshot)];
  for (const snapshot of snapshots) validateSnapshot(snapshot, source, engineRegistry);
  if (new Set(state.figures.map(item => item.snapshot.figure.id)).size !== state.figures.length) throw new Error('Saved figure IDs must be unique.');
  if (state.position.figureId && !snapshots.some(item => item.figure.id === state.position.figureId)) throw new Error('The saved figure is unavailable.');
  return state;
}
export function loadReadingState(source: SourceDocument, storage?: StorageLike): { state?: ReadingState; warning?: string } {
  try {
    const raw = storageOrDefault(storage)?.getItem(prefix + source.id);
    if (!raw) return {};
    if (new TextEncoder().encode(raw).byteLength > maxStateBytes) throw Error();
    return { state: validateReadingState(JSON.parse(raw), source) };
  } catch { return { warning: 'Saved reading state is unavailable or incompatible with this source/engine version. It was not applied or deleted.' }; }
}
export function saveReadingState(state: ReadingState, source: SourceDocument, storage?: StorageLike): { warning?: string } {
  try {
    const valid = validateReadingState(state, source); const raw = JSON.stringify(valid);
    if (new TextEncoder().encode(raw).byteLength > maxStateBytes) throw Error();
    const target = storageOrDefault(storage);
    if (!target) throw Error();
    target.setItem(prefix + source.id, raw);
    const recent = listRecentPapers(target).filter(item => item.documentId !== source.id);
    target.setItem(recentKey, JSON.stringify([{ documentId: source.id, sourceVersion: source.sourceVersion, title: source.title, updatedAt: valid.updatedAt }, ...recent].slice(0, 12)));
    return {};
  } catch { return { warning: 'Reading state could not be saved. Browser storage may be full or unavailable; the current experiment remains usable.' }; }
}
const recentSchema = z.array(z.strictObject({ documentId: shortId, sourceVersion: z.string().min(1).max(100), title: z.string().min(1).max(500), updatedAt: z.number().finite().min(0) })).max(12);
export type RecentPaper = z.infer<typeof recentSchema>[number];
export function listRecentPapers(storage?: StorageLike): RecentPaper[] {
  try { const raw = storageOrDefault(storage)?.getItem(recentKey); return raw && raw.length < 20_000 ? recentSchema.parse(JSON.parse(raw)) : []; } catch { return []; }
}
export function deleteReadingState(documentId: string, storage?: StorageLike): { warning?: string } {
  try {
    shortId.parse(documentId); const target = storageOrDefault(storage);
    if (!target) throw Error();
    target.removeItem(prefix + documentId);
    target.setItem(recentKey, JSON.stringify(listRecentPapers(target).filter(item => item.documentId !== documentId)));
    return {};
  } catch { return { warning: 'The local reading settings could not be removed. They may remain in browser storage.' }; }
}
export function snapshotFromPrepared(paper: PreparedPaper, state: PreparedExperimentState): ExperimentSnapshot {
  return validateSnapshot({ schemaVersion: 1, documentId: paper.document.id, sourceVersion: paper.document.sourceVersion, seed: state.seed,
    figure: createEngineFigure(paper.document, `${paper.id}-primary`, paper.illustrationAnchors.primary, state) }, paper.document, engineRegistry);
}
export function preparedFromSnapshot(value: unknown, source: SourceDocument): PreparedExperimentState {
  const snapshot = validateSnapshot(value, source, engineRegistry); const figure = snapshot.figure;
  if (figure.kind === 'steps' || figure.kind === 'comparison' || figure.execution.mode !== 'computed') throw new Error('This snapshot is not a prepared computed experiment.');
  return { input: figure.input, seed: snapshot.seed, engineId: figure.execution.binding.engineId, parameters: figure.execution.binding.parameters };
}
