# Reading state, public links and experiment bundles — M3

M3 retains experiments without an account. Local records, public URL snapshots and downloadable bundles serve different purposes. None starts a Meta request while opening.

## Local reading state

`lib/reading-state.ts` stores a versioned `ReadingState` under `paperplay:reading:v1:<documentId>` in localStorage. Imported documents, original files and Meta results remain in the existing IndexedDB store; this small record contains the experiment and reading controls only.

A reading state includes exact document ID and source version, the selected source block or figure, scroll position, the prepared experiment snapshot if applicable, and per-figure snapshots with step index/selection. A snapshot contains the current input, seed, engine/version and parameter binding. Reading-state validation runs the existing source/figure/engine validators. Unknown schema, source and engine versions are rejected with a visible warning rather than migrated to different results. Invalid records are not silently deleted. At most 32 figure views and 1,000,000 serialized UTF-8 bytes are allowed.

API:

- `loadReadingState(source, storage?)` returns `{ state?, warning? }`.
- `saveReadingState(state, source, storage?)` returns `{ warning? }` and updates the bounded recent-paper list after saving.
- `listRecentPapers(storage?)` returns up to twelve newest-selected records; its first entry can restore the last document selection.
- `deleteReadingState(documentId, storage?)` removes its settings and recent-paper entry; it reports a warning if deletion fails.
- `snapshotFromPrepared(paper, experimentState)` and `preparedFromSnapshot(snapshot, source)` convert prepared engine controls without losing seed/input/parameters.

The optional storage argument is a small `getItem/setItem/removeItem` interface used for independent-browser fixtures. Default browser storage access is caught and converted to warnings, including quota and permission errors. The workspace owns restoring scroll after its document renders and must remove these settings when deleting a local paper.

## Public URL snapshots

`encodePublicSnapshot(snapshot)` returns a UTF-8 base64url payload. `decodePublicSnapshot(payload)` returns `{ paper, snapshot, state }` after validation. The UI places this in its snapshot fragment; the payload is data, not executable code. URL contents are visible to recipients, browser history and anyone receiving the URL.

`validatePreparedSnapshot(value, paper)` enforces the registered primary/comparison/walkthrough ID, exact source anchor, expected figure role and paper input family in addition to the general contract. Bundle restoration into a prepared reader uses this helper as well. Links currently support only the prepared public mechanism figures, with their registered paper, primary source anchor, figure ID, input family and compatible engine version. They embed the finite input, seed and controls, not the source paper or a provider handle. The recipient already has the public prepared source in the application. Opening in a clean browser recomputes the deterministic result from those inputs, rather than trusting serialized measurement claims. No PDF stored on the sender's device is transferred.

Payloads are capped at 12,000 encoded characters and 8,000 decoded bytes. Decoding rejects unknown versions, corrupt base64/JSON/UTF-8, excessive size, incompatible engines/source versions and markup in figure text. Larger or private experiments use the file-bundle path. User-supplied source text and arbitrary local PDFs cannot be shared through this URL encoder.

## Explicit bundle contents

`createExperimentBundle(options)` returns JSON with format `paperplay-experiment`, `bundleVersion: 1`, creation time, one versioned snapshot and attribution. `includeSource` and `includePdf` are required booleans. The content declaration is one of:

- `metadata-only`: figure/input/seed/controls plus source ID/version and attribution. No original document blocks or PDF are included. Figure labels, assumptions and step explanations are still part of the experiment data.
- `source-text`: also includes the normalized source blocks, warnings and anchors. Generated anchors referenced by the snapshot must be present in that document copy.
- `source-text-and-pdf`: also includes the explicitly selected original PDF as base64, its name, MIME type and byte count. PDF inclusion requires source-text inclusion.

The root object uses strict validation. Provider credentials, pending job capabilities, cookies, unrelated Meta records and local reading history have no field and are not exported. Prepared-source attribution defaults to the existing license and author notice. Private sources default to their authors/source URL with an explicit notice that import/export does not establish redistribution permission; a license is never invented.

`parseExperimentBundle(text, { sources? })` validates the entire bundle before callers apply state. It returns `{ snapshot, source?, original?, originalName?, attribution, missingSource, contents }`. Known prepared sources are available automatically; `sources` can supply matching local documents for metadata-only imports. If source text is absent and no compatible local source exists, `missingSource` is true. The snapshot shape and engine compatibility are checked, but it must not be activated as a source-grounded reading until its source is available. A metadata reference does not itself prove the existence or correctness of a source quotation.

Bundles are capped at 20 MiB serialized UTF-8; included PDFs at 10 MiB. Signature, encoding and declared byte size are checked. This is not an OCR parser or cryptographic attestation of authorship, PDF/source correspondence or scientific fidelity. Imported source text and figure interpretations remain untrusted data. The UI must retain the bundle's provenance and not silently replace canonical prepared-paper data with bundled content that happens to use the same ID.

## Verification

`npx tsx --test tests/snapshots.test.ts` tests exact local restoration/deletion, unavailable/quota storage, schema/source/engine mismatch, independent deterministic public-link round trips, malicious/oversized payloads, public metadata attribution, private source/PDF transport, missing-source resolution, undeclared source inclusion, unknown secret fields, corrupt PDFs and bundle size bounds. Tests do not use inference or network requests. Browser integration evidence belongs in the M3 milestone report.
