# M1 completion report

Completed locally on 27 October 2026: PP-006 through PP-017. M1 is a prepared, source-linked reading experience with real computations; automatic document import and Meta-selected figure generation remain M2.

## Sources and reading — PP-006, PP-007, PP-008

Two complete publisher PDFs are bundled with CC BY 3.0 attribution, pinned edition identifiers and SHA-256 checksums. The reformatted reading editions contain about 2,000 words of selected original passages, important equations and page-linked original figure/pseudocode placeholders. They are **not complete normalized versions** of the papers. Coverage notes disclose omissions and typography/TeX transcription changes; full originals remain accessible locally.

Source blocks preserve original order and physical PDF pages. KaTeX renders the equation blocks with untrusted HTML disabled. Source paragraphs, original figures and Paperplay additions have distinct presentation. The contents navigation, passage-to-figure links and return links use validated block/anchor IDs; a missing anchor cannot attach a figure to a different passage.

Evidence: [prepared-sources.md](prepared-sources.md), [source provenance](../data/papers.provenance.json), [attribution](../public/papers/ATTRIBUTION.md), `tests/papers.test.ts` and `tests/reading-experience.test.ts`.

## Deterministic computations — PP-009, PP-010, PP-014

Four versioned engines share the same registry, input envelope, bounded trace interface and numeric parameter contract:

- `dijkstra-heap`: nonnegative shortest distances using a binary heap with stale-entry removal.
- `dijkstra-scan`: a compatible linear-scan baseline.
- `powersort`: natural-run discovery, strictly descending-run reversal, node powers, pending-run stack scheduling and stable buffered merging.
- `natural-mergesort`: the same run discovery/merge semantics with simple left-to-right scheduling.

Synthetic inputs are deterministic for a fixed seed. Inputs are not mutated. Operation budgets, mathematical preconditions, trace bounds and cancellation/partial statuses are enforced. Synchronous browser computation remains limited to small teaching examples; asynchronous worker execution for larger workloads is still PP-042.

Dijkstra results are checked against an independent Bellman–Ford oracle across changing topology/weights and degenerate cases. Powersort scheduling is checked against exact node powers, a nontrivial merge-order reference and an independent recursive min-power Cartesian tree; sortedness alone is not used to establish scheduling correctness. Decorated original indices check stability and permutation preservation separately.

Evidence: [engines.md](engines.md), `lib/engines/index.ts`, `tests/engines.test.ts` and backward-compatible optional trace fields in `shared/schema.ts`.

## Figures, playback and comparisons — PP-011, PP-012, PP-013, PP-015

Graph and array state renderers consume generic trace data rather than branching on algorithm names. The same playback controls provide play/pause, previous/next step, seek, speed and restart. Parameter/input changes recompute the trace and return playback to its initial state. Full experiment reset restores the prepared method, input, seed and operation limit.

The graph figure permits bounded edge-weight edits and displays tentative distances, active/frontier/settled nodes, highlighted edges and a textual state table. The array figure exposes input values, positions, original identities, active ranges and known runs. A separate source-grounded step figure is explicitly conceptual and has no execution claim.

Compatible methods receive identical inputs and seeds. Comparison playback aligns trace indexes, explicitly not equal work or time. Tables show actual deterministic metrics with units; no hardware runtime, universal speedup or paper benchmark is inferred. Incomplete runs cannot be presented as completed comparisons.

## Fidelity policy — PP-016

`lib/fidelity.ts` contains application-controlled, version-specific evidence policy. Model-supplied fidelity fields, unknown versions and incompatible bindings cannot elevate a figure. Reference-case and synthetic-data limitations are visible in each figure.

The graph algorithms remain simplified relative to the first paper: neither its functional priority search tree nor its Isabelle proof is implemented. The checked Powersort label refers to its scheduling mechanism and stable output, not the original Java runtime study or omitted optimizations. No M1 figure receives an original-experiment-reproduction label. Conceptual steps are not computed traces, and partial run totals are labeled as partial.

Evidence: `tests/fidelity.test.ts` and the two-source integration tests.

## Integrated experience — PP-017

Both prepared papers use the same source/figure composition and engine registry. Source-specific choices live in prepared composition; generic renderers do not contain algorithm-name conditionals. Opening either paper requires no login or live model request. The introductory disclosure and workspace dialog identify the locally prepared editions and figure placements.

## Verification

- `npm run check`: strict TypeScript, **38 provider-free tests** and production build.
- Browser checks at desktop 1280 px and mobile width 390 px; no horizontal document overflow or application console errors observed.
- All in-page source and figure links resolved for both papers. Equations had no KaTeX error elements.
- Both local PDF routes returned HTTP 200 and `application/pdf` with the expected content lengths.
- Graph playback: default final distances included A=3, B=1, C=4, T=4. Editing S→B to weight 8 reset playback and yielded A=4, B=8, C=11, T=5. Reset restored the prepared input.
- Play from the end restarted and advanced; pause, seek and single-step controls worked.
- A one-operation run was labeled `limit-reached` with partial totals and an unavailable comparison rather than fabricated results.
- Sorting input `30,31,32,20,21,10,11,12,13,14,0,1` produced Powersort merge cost 24 and the left-to-right baseline cost 27. Their comparison counts were 22 and 20 respectively: a smaller merge cost is not presented as fewer key comparisons or universally better performance.
- The final sorting state preserved original identities. An invalid `3,,2` input was rejected. Complete experiment reset cleared the error and restored the default.

Reduced-motion playback handling and CSS are implemented; the browser tool did not provide an OS preference override, so no independent preference-emulation result is claimed. The full accessibility audit remains PP-033.

No paid Meta requests were needed for M1. No remote GitHub Actions run, hosted deployment or original experiment replication is claimed by this report.

## Remaining limitations

Automatic ingestion, Meta-selected enrichment, end-user analysis resume, local persistence, contextual questions and sharing are still open. The original papers’ full text is accessible as PDF; only disclosed source selections are reformatted. Original figures and pseudocode use page-linked placeholders, not lossless extraction. The three held-out papers remain reserved for PP-034.

## Readability follow-up

Following the user's visual review, supporting UI text now uses a 14 px minimum, inputs use 16 px, and source prose uses 18 px on desktop / 17 px on mobile. Secondary text was darkened, controls/table spacing increased and array identity/index annotations enlarged. The graph preserves legible SVG labels with its own keyboard-accessible horizontal viewport instead of shrinking labels on narrow screens.

Browser checks covered 1280, 390 and 320 px widths, both example families and representative computed typography/contrast. No page-wide horizontal overflow or application console errors were observed. Sample annotation contrasts were approximately 6.2–6.9:1; solid playback button text was 5.7:1. These observations are scoped checks, not a full accessibility certification. Production build passed; no algorithm changes or additional paid Meta requests were needed.
