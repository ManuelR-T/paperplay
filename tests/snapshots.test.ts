import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedPapers } from '../data/papers';
import { createPreparedExperiment, createPreparedFigures } from '../lib/prepared-figures';
import { snapshotFromPrepared, preparedFromSnapshot, loadReadingState, saveReadingState, deleteReadingState, listRecentPapers, type ReadingState, type StorageLike } from '../lib/reading-state';
import { createExperimentBundle, parseExperimentBundle, encodePublicSnapshot, decodePublicSnapshot, MAX_BUNDLE_BYTES, validatePreparedSnapshot } from '../lib/snapshots';
import { runEngine } from '../lib/engines';

function storage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
const paper = preparedPapers[1];
function example() {
  const state = createPreparedExperiment(paper); state.seed = 196; state.input = { kind: 'array', values: [4, 8, 1, 3, 4, 0] }; state.engineId = 'natural-mergesort'; state.parameters.operationLimit = 500;
  return snapshotFromPrepared(paper, state);
}
function reading(): ReadingState {
  const snapshot = example();
  return { schemaVersion: 1, documentId: paper.document.id, sourceVersion: paper.document.sourceVersion, updatedAt: 20,
    position: { blockId: paper.document.blocks[1].id, figureId: snapshot.figure.id, scrollY: 1234 }, experiment: snapshot,
    figures: [{ snapshot, stepIndex: 3, selection: '2' }] };
}

test('reading state restores input, method, seed, controls, passage and view state, with bounded recents and deletion', () => {
  const local = storage(); const state = reading();
  assert.deepEqual(saveReadingState(state, paper.document, local), {});
  const restored = loadReadingState(paper.document, local).state!;
  assert.deepEqual(restored, state);
  assert.deepEqual(preparedFromSnapshot(restored.experiment!, paper.document), { input: { kind: 'array', values: [4, 8, 1, 3, 4, 0] }, seed: 196, engineId: 'natural-mergesort', parameters: { operationLimit: 500 } });
  assert.equal(listRecentPapers(local)[0].documentId, paper.document.id);
  assert.deepEqual(deleteReadingState(paper.document.id, local), {});
  assert.equal(loadReadingState(paper.document, local).state, undefined);
  assert.deepEqual(listRecentPapers(local), []);
});

test('incompatible source/engine/schema versions and unavailable storage are visible and never silently applied', () => {
  const local = storage(); const saved = reading(); saveReadingState(saved, paper.document, local);
  assert.match(loadReadingState({ ...paper.document, sourceVersion: 'changed-normalizer' }, local).warning!, /incompatible/);
  const changed = structuredClone(saved); changed.experiment!.figure = { ...changed.experiment!.figure, schemaVersion: 2 } as never;
  assert.match(saveReadingState(changed, paper.document, local).warning!, /could not be saved/);
  const raw = structuredClone(saved);
  if (raw.experiment!.figure.kind === 'array' && raw.experiment!.figure.execution.mode === 'computed') raw.experiment!.figure.execution.binding.engineVersion = '99.0.0';
  local.setItem(`paperplay:reading:v1:${paper.document.id}`, JSON.stringify(raw));
  assert.match(loadReadingState(paper.document, local).warning!, /incompatible/);
  const denied: StorageLike = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
  assert.match(saveReadingState(saved, paper.document, denied).warning!, /storage/);
  assert.match(deleteReadingState(paper.document.id, denied).warning!, /may remain/);
});

test('public URL snapshots round-trip in an independent reader to the same deterministic trace', () => {
  const snapshot = example(); const payload = encodePublicSnapshot(snapshot);
  const restored = decodePublicSnapshot(payload);
  assert.equal(restored.paper.id, paper.id);
  assert.deepEqual(restored.snapshot, snapshot);
  const originalState = preparedFromSnapshot(snapshot, paper.document);
  assert.deepEqual(runEngine(originalState.engineId, originalState.input, originalState).trace, runEngine(restored.state.engineId, restored.state.input, restored.state).trace);
  assert.ok(!payload.includes('source-text'));
});

test('numeric matrix URL snapshots restore their input, optimizer and controls', () => {
  const numeric = preparedPapers.find(item => item.id === 'quadratic-optimization')!;
  const state = createPreparedExperiment(numeric);
  state.parameters.stepSize = 0.12;
  const snapshot = snapshotFromPrepared(numeric, state);
  const restored = decodePublicSnapshot(encodePublicSnapshot(snapshot));
  assert.deepEqual(restored.state, state);
  assert.deepEqual(runEngine(state.engineId, state.input, state).result, runEngine(restored.state.engineId, restored.state.input, restored.state).result);
});

test('URL decoding rejects corruption, excessive size, unknown versions, engines, private sources and markup', () => {
  assert.throws(() => decodePublicSnapshot('x'.repeat(12_001)), /too large/);
  assert.throws(() => decodePublicSnapshot('%bad'), /corrupt/);
  const encodeRaw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  assert.throws(() => decodePublicSnapshot(encodeRaw({ ...example(), schemaVersion: 2 })), /could not be opened/);
  assert.throws(() => encodePublicSnapshot({ ...example(), documentId: 'private-import' }), /URL does not transfer/);
  const markup = example(); markup.figure.title = '<script>attack()</script>';
  assert.throws(() => encodePublicSnapshot(markup), /plain text/);
  const stale = example(); if (stale.figure.kind === 'array' && stale.figure.execution.mode === 'computed') stale.figure.execution.binding.engineVersion = '9.0.0';
  assert.throws(() => decodePublicSnapshot(encodeRaw(stale)), /incompatible engine/);
});

test('prepared restoration rejects wrong families, figure IDs, anchors and roles while accepting registered figures', () => {
  const figures = createPreparedFigures(paper);
  for (const figure of Object.values(figures)) {
    assert.equal(validatePreparedSnapshot({ ...example(), figure }, paper).figure.id, figure.id);
  }
  const unknown = example(); unknown.figure.id = 'arbitrary-custom-id';
  assert.throws(() => validatePreparedSnapshot(unknown, paper), /unknown prepared figure/);
  const wrongAnchor = example(); wrongAnchor.figure.sourceAnchorIds = [paper.illustrationAnchors.comparison];
  assert.throws(() => validatePreparedSnapshot(wrongAnchor, paper), /source anchor/);
  const wrongFamily = snapshotFromPrepared(preparedPapers[0], createPreparedExperiment(preparedPapers[0]));
  wrongFamily.documentId = paper.document.id; wrongFamily.sourceVersion = paper.document.sourceVersion;
  wrongFamily.figure.id = `${paper.id}-primary`; wrongFamily.figure.sourceAnchorIds = [paper.illustrationAnchors.primary];
  assert.throws(() => validatePreparedSnapshot(wrongFamily, paper), /mechanism family/);
  assert.throws(() => encodePublicSnapshot(wrongFamily), /mechanism family/);
  const wrongRole = { ...example(), figure: { ...figures.walkthrough, id: `${paper.id}-primary`, sourceAnchorIds: [paper.illustrationAnchors.primary] } };
  assert.throws(() => validatePreparedSnapshot(wrongRole, paper), /mechanism family/);
});

test('public metadata bundle retains license and opens without including source text or any provider access token', async () => {
  const text = await createExperimentBundle({ snapshot: example(), includeSource: false, includePdf: false });
  const bundle = JSON.parse(text);
  assert.equal(bundle.contents, 'metadata-only'); assert.equal(bundle.source, undefined); assert.equal(bundle.original, undefined);
  assert.equal(bundle.attribution.license, paper.attribution.license);
  assert.ok(!text.includes('job') && !text.includes('token'));
  const imported = await parseExperimentBundle(text);
  assert.equal(imported.missingSource, false); assert.deepEqual(imported.snapshot, example());
});

test('private source-inclusive bundles move a validated figure and original PDF with explicit content declarations', async () => {
  const source = structuredClone(paper.document); source.id = 'private-import'; source.source = { kind: 'pdf' };
  const snapshot = { ...example(), documentId: source.id };
  const original = new Blob(['%PDF-1.7\noriginal test bytes'], { type: 'application/pdf' });
  const text = await createExperimentBundle({ snapshot, source, original, originalName: 'private.pdf', includeSource: true, includePdf: true });
  const imported = await parseExperimentBundle(text);
  assert.equal(imported.contents, 'source-text-and-pdf'); assert.deepEqual(imported.source, source);
  assert.equal(imported.originalName, 'private.pdf'); assert.equal(await imported.original!.text(), await original.text());
  assert.equal(imported.attribution.license, undefined);
  assert.match(imported.attribution.notice, /does not establish/);
  const metadata = await createExperimentBundle({ snapshot, source, includeSource: false, includePdf: false });
  const missing = await parseExperimentBundle(metadata);
  assert.equal(missing.missingSource, true); assert.equal(missing.source, undefined);
  assert.equal((await parseExperimentBundle(metadata, { sources: [source] })).missingSource, false);
  await assert.rejects(createExperimentBundle({ snapshot, source, original, includeSource: false, includePdf: true }), /explicit source-text/);
});

test('bundle imports reject undeclared source inclusion, damaged PDFs, unknown fields, wrong source and oversized files before activation', async () => {
  const text = await createExperimentBundle({ snapshot: example(), includeSource: true, includePdf: false });
  const bundle = JSON.parse(text);
  await assert.rejects(parseExperimentBundle(JSON.stringify({ ...bundle, job: { token: 'secret-handle' } })), /damaged/);
  await assert.rejects(parseExperimentBundle(JSON.stringify({ ...bundle, contents: 'metadata-only' })), /inclusion/);
  await assert.rejects(parseExperimentBundle(JSON.stringify({ ...bundle, source: { ...bundle.source, sourceVersion: 'different' } })), /source\/version/);
  await assert.rejects(parseExperimentBundle('x'.repeat(MAX_BUNDLE_BYTES + 1)), /20 MiB/);
  await assert.rejects(parseExperimentBundle(JSON.stringify({ ...bundle, contents: 'source-text-and-pdf', original: { name: 'fake.pdf', mime: 'application/pdf', byteLength: 2, base64: 'YWJj' } })), /damaged/);
  await assert.rejects(createExperimentBundle({ snapshot: example(), source: paper.document, original: new Blob(['not a PDF']), includeSource: true, includePdf: true }), /not a PDF/);
});
