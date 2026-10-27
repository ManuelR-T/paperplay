# M0 completion report

Local date: 27 October 2026. Scope: PP-001 through PP-005. This report distinguishes completed foundation work from later reading, import and algorithm-engine milestones.

## PP-001 — source selection

Complete: [demo-corpus.md](demo-corpus.md) selects two publisher editions with explicit CC BY 3.0 reuse licenses: Lammich/Nipkow on priority search trees applied to graph algorithms, and Munro/Wild on adaptive mergesort. Three held-out sources and an evaluation rubric are reserved, with separate edition/license handling. Reference cases, extraction risks and reproduction limitations are documented. No complete original papers or figures are bundled yet.

## PP-002 — Next.js and shadcn/ui shell

Complete: a single Next App Router application replaces the incomplete Vite/Express/Groq scaffold. It uses TypeScript, Tailwind CSS and actual shadcn/ui Button, Badge, Slider and Dialog components generated with the official CLI/registry. The user's frontend instruction was clarified to shadcn, not ChatGPT.

The opening English workspace contains two original explanatory notes with source links and small synthetic interactions. These are explicitly prepared teaching illustrations, not a faithful full-paper edition, verified Dijkstra/Powersort engines, an automatic import or generated Meta analysis. The interface works without a provider key and `/api/health` reports only public configuration presence/model.

## PP-003 — contracts

Complete: [shared/README.md](../shared/README.md) documents version 1 source/anchor, figure, engine-capability, computed-trace and experiment-snapshot contracts. Validation includes source provenance, bounds, duplicate IDs, unknown fields/versions, engine compatibility, comparison groups/units and playback invariants. Graph and array examples share the same envelope; illustrative walkthroughs are separate from computation. Evidence records do not self-certify scientific fidelity.

Generic inputs permit negative weights and empty arrays; an actual engine must enforce its own mathematical preconditions. No execution engine or scientific proof is claimed by the structural fixtures.

## PP-004 — official Meta capabilities

Complete with live provider evidence: [meta-capabilities.json](meta-capabilities.json), [setup and probe guide](meta-setup.md).

The project key successfully exercised `muse-spark-1.3` at `https://api.meta.ai/v1`: strict JSON output, queued background creation, successful final retrieval, and cancellation confirmed by retrieval. Three creation requests were bounded to 512 output tokens each, with automatic retries disabled. The two completed responses reported 244 and 273 total tokens; cancellation reported no usage. Credit balance and whether charges use the hackathon grant are not exposed by this probe and were not asserted.

The key is in ignored local configuration, not committed source. The browser-facing health response contains no key, and the production client assets were scanned for the configured credential with no match. The probe omits credentials and response IDs from saved evidence.

## PP-005 — checks and CI

Complete locally: clean `npm ci`, strict type checking, 16 provider-free tests and a successful production build. CI configuration in [.github/workflows/checks.yml](../.github/workflows/checks.yml) runs installation and the same check command without credentials. Tests include malformed provenance/engine boundaries and a deliberately nonmonotonic trace that must be rejected.

No remote GitHub Actions execution is claimed: the workflow has been prepared locally, without a commit or push requested in this task. CI does not run the paid Meta probe.

## Browser verification

The production server was exercised through the collaborative browser:

- Both prepared notes open and retain explicit source/illustration labels.
- Changing the graph control to 9 changes the computed upper route cost to 11 while the lower route remains 7; reset restores the default.
- Merging the first adjacent pair changes runs from `3,7,2,9` to `10,2,9`, accumulated toy cost to 10, and remaining runs to 3; reset restores the initial values.
- The shadcn dialog opens with a named focused close control and closes with Escape.
- The 390 px viewport has no horizontal document overflow; essential note/figure controls remain reachable. Desktop was checked at 1280 px.
- A separate production process with an explicitly absent key rendered the prepared note and returned `configured: false`; no horizontal overflow was observed there either.
- Browser diagnostics showed no application console errors. API health returned only `status`, `stage` and the public Meta projection.

The mobile about button received an explicit accessible name after inspection. A full accessibility audit is still PP-033, not claimed here.

## Remaining work

All M1–M5 issues remain open. In particular: faithful normalized paper fixtures and full reading, generic engine implementations, automatic PDF/arXiv import, Meta-selected figure generation, end-user job resume, persistence, questions and sharing. Successful provider primitives do not establish those application features.
