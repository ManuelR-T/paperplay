# Versioned artifact experiments (PP-099)

Accepted generated figures now retain exact code, inputs, seed and recorded results. Reopening a compatible record validates and displays its saved frame without inference or compilation. **Resume interaction** admits the exact code locally before another event. Imported files and persisted JSON never recreate a compiler receipt or scientific verification.

## A session owns the cache boundary

`createExperimentSession` exposes open, resume, step, configure, quality, export and lifecycle methods. It owns immutable current settings, bounded transition history, cache keys, cancellation and private compiler admission. Rendering subscribes to its stable snapshot rather than coordinating separate compiler/runtime caches.

Open validates source/manifest/SDK/source hashes and checked asset bindings, then restores compatible frames and reports. This inert revalidation is distinct from compiling generated source. Restoration stages asynchronous work in local variables and commits only after the current job's cancellation check. A stopped older open cannot overwrite a newer seed or exported identity.

Resume explicitly compiles once after a browser reload. Within one page, exact compatible builds can share a private admission across figures; cancellation is reference-counted so one waiter cannot cancel another. The cache holds at most 16 admission entries. No admission identity is serialized. Each new runtime event still uses a disposable capped Worker/interpreter. Cached exact transitions can be replayed without executing again; a cache hit is labeled recorded output.

Configuration preserves code admission while selecting a separate input/seed branch. Returning to a known branch restores it rather than replacing it with an empty record. Invalid input is atomic: the previous valid settings/result survive. Seed/input edits invalidate relevant semantic selections and reports. Late cancelled execution cannot publish a frame or cache record.

## Separate identities

| Level | Bound identity | Effect of change |
| --- | --- | --- |
| Plan / accepted original | Exact source fingerprint and artifact manifest digest | New source/code keeps a separate original |
| Inert build / private page admission | Source/artifact, SDK, compiler and dependency versions/digests | Input and seed changes retain the exact compatible build |
| Execution | Build, runtime/random policy, exact bound assets, effective input digest and seed | New inputs/data/seed select another branch |
| Transition | Exact serialized input, preceding state and event plus source/runtime/seed | Distinct object ordering remains distinct |
| Quality report | Execution/state, policy and environment identity | Changed quality policy/environment invalidates the report without discarding a frame or build |

Manifest digests keep the existing `SHA256(JSON.stringify(validatedManifest))` contract. Cache record content digests preserve exact unknown payload ordering; variants hash their actual JSON bytes before structured key hashing. Generated programs may inspect `Object.keys`, so silently sorting input/state would alter semantics. All records are schema/content checked again when read.

## Reproducible engineering randomness

Runtime `quickjs-seeded-sdk@1.1.0` accepts an unsigned 32-bit seed (default 42). Inside the guest, `Math.random` uses the versioned `mulberry32-payload-fnv1a-v1` policy. A FNV-style mix of UTF-16 code units from the exact serialized input/state/event and seed initializes each invocation's stream. Identical payload/seed reproduces the same values; changed input order, state, event or seed selects another stream. The seed is not a privilege or a source of cryptographic entropy.

Algorithm attribution: [Tommy Ettinger's original Mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) is dedicated to the public domain/CC0; [bryc's JavaScript implementation notes](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) also declare public domain and discuss statistical shortcomings. This runtime provides repeatable teaching interactions, **not a research-quality Monte Carlo generator, statistical validation or cryptographic randomness**. Scientific stochastic adapters require separately reviewed algorithms and references. No passing randomness-quality suite is claimed here.

## Bounded local storage and accepted originals

IndexedDB `paperplay-artifact-experiments` is separate from PDFs/imports and planner job recovery. Content records and logical pointers are limited to 128 entries / 20 MiB by default, with 1 MiB per record and at most 32 retained transitions. Resource limits can retain fewer frames. Only an explicit generic Save protects an accepted plan; ordinary cache results remain evictable.

Eviction checks full content/purpose validity before entering the write transaction and only evicts unchanged, known-valid, unaccepted records. Unknown versions, bad digests, corrupt originals and concurrent unknown rows are not silently removed. Accepted settings updates replace the same known artifact owner's entry atomically instead of accumulating protected duplicates. Quota errors preserve originals and leave the current result available with recovery feedback. LRU touch failures do not prevent a validated read.

The generic source-bound library stores imported or Muse-created artifacts without inventing a Muse plan. Saving captures the **current visible** inputs, seed and optional recorded frame, not stale import defaults. Reading the library rechecks source, assets, hashes and ownership. A separately stored recorded frame can remain visible when derived execution history was evicted; it stays read-only and offers **Start a new local run**. It is never inserted as an active execution result.

Source removal detaches only its owner references, preserves shared/invalid originals and retains pending paid-job capabilities. Known accepted generated jobs block removal until resolved/cancelled, like catalog jobs; uncertain submissions retain the existing explicit-removal warning behavior. This path does not cancel or replace paid work automatically.

## Portable files and missing data

`paperplay-artifact-experiment` v1 is distinct from existing v2 widgets and legacy experiment snapshots. It includes exact artifact code/citations, versioned identity, settings and selected recorded results. Full saved source and original asset attachments are separate unchecked export choices. Recorded values/state may themselves contain copies of data or source text; the UI states this. Jobs, signed run capabilities and compiler receipts are excluded by strict purpose-specific envelopes; legitimate scientific fields named `token` or `job` remain usable data.

When original assets are omitted, reserved `input.assets` becomes a `null` placeholder **at its original position**. Its serialized digest is separate from the original effective input digest. Full execution cache records containing asset input JSON are excluded; a separate checksummed recorded frame can be displayed as unverified, read-only evidence. Exact assets must be checked/rebound and the effective input digest matched before interaction. This preserves assets-first ordering and prevents redacted data from masquerading as a compatible active cache record. Frame-only export selects the exact current input/seed branch, not the last unrelated record.

Unsupported/damaged files retain their original literal bytes and offer download/fallback. No destructive migration or implicit execution occurs. Bound-data replays never grant asset approval. Unknown browser database versions remain untouched and require a compatible reader. Older accepted originals can stay inspectable while changed execution/report policies prevent stale cache reuse.

## Verification

`npm run check` passes TypeScript, **402 tests** and production build. Focused checks cover source/code/version scoping, exact ordering, seed streams, branch reversal, shared compilation, cancellation races, stale open validation, preserved originals, quota eviction, explicit acceptance, owner-scoped removal, asset rebinding and private export boundaries.

[Native Chromium154 evidence](../data/artifact-experiment-browser.json) records a source-bound engineering fixture: seed 42 differs from 43; Save retains 43; reload shows identical values with **zero artifact infrastructure and provider requests**. Explicit resume creates one compiler Worker and preserves existing state before adding the next sample. Export/import restores four values after derived cache removal without compilation. Protected accepted replay remains visible when that history is absent. A schema-99 file downloads byte-for-byte unchanged. At 320px/200% text there is no page overflow.

A separate bound-data fixture computes 2+3=5, then exports without source/assets: input uses the null placeholder, no asset attachments or execution cache payload are bundled, and the recorded value 5 reopens read-only with an exact-data binder and zero compiler/provider requests. The [33-probe isolation rerun](../data/artifact-experiment-isolation-browser.json) has no unexpected outcomes, zero remaining guests, retained host storage and 61 reader heartbeat ticks after the seeded runtime change.

These are local engineering observations using authored fixtures. They are not scientific reproduction, participant review, model-quality evidence or browser/security certification. No paid inference was used. The deferred release and unavailable real-reader studies remain separate gates.
