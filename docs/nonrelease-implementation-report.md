# Nonrelease implementation — M6–M10

27 October 2026. Thirty feature issues are implemented. #24 has a prepared protocol but remains open because the owner has no available testers. Release issues #31, #33 and #34 remain deferred; no Railway provisioning, Sites deployment, access change or release tag was performed.

## What is usable

The reader defaults to 20 px with configurable measure, spacing, light/sepia/high contrast and focus reading. Source text remains separate from authored explanations and interactive additions. Nine new widget forms run bounded computations or clearly labeled conceptual views; they are inserted next to exact source blocks. Readers can preview and author figures, explore parameter grids, pin hypotheses, keep private notes, search locally and export printable packs.

Default import prepares a readable local source without inference. Meta planning is an explicit section action. Plans, targeted repair and constrained edits receive only bounded selected/neighbor context; the server receives the normalized source for grounding validation. Acceptance, removal, deferral and undo are explicit. Shared quotas and a durable per-paper/session ledger bound creations. A request is not created when its recovery reference cannot be saved locally.

## Verification and scientific scope

- `npm run check`: strict TypeScript, **184 passing provider-free tests**, and optimized Next build. Generated trusted worker assets are built from pinned source; no new runtime dependency was added.
- All nine reference widgets were exercised at 320 CSS px in native Chromium. Document width remained 320, fields were focusable and targeted axe WCAG 2/2.1 A/AA checks reported zero violations after fixes. A later settled-theme review passed all nine forms and the whole document under light, sepia and high contrast; fixed colors and primary-button text were corrected. This is not assistive-technology certification. [Recorded checks](rich-widget-accessibility.json), [three-theme follow-up](rich-widget-theme-accessibility.json), [signal cell editing](widget-mobile-qa.json).
- The production reader at localhost:3000 initially showed 20 px prose, 28 axe passes / zero violations and zero paid requests. Additional integration observations are recorded below. All nine forms also fit 200% CSS magnification with WCAG spacing overrides after fixing intrinsic header wrapping; [recorded checks](rich-reader-magnification.json) distinguish this from browser UI zoom and OS preference emulation.
- Actual 2D sweep: six worker trials; four measured results with explicitly unmet tolerance and two stability failures with no invented metrics. A downloaded 4,097-byte measured report retained full input, seed 42, engine version, both axes, six trials and a 60,000-operation allowance. Pinning step size 0.2 and seed 42, then computing step size 0.1 and seed 43, displayed both changes and independent metric differences.
- Four actual PDF fixtures retained all raw non-whitespace extracted characters. Heuristic headings increased from zero to 30/23/19/25; witnessed line-end repairs and joined-paragraph counts are recorded. Equation-like text remains uncertain, with original-page/raw-fragment inspection; no OCR, invented TeX, original image or table reconstruction. [Corpus report](pdf-reconstruction-v3.json).
- One 16-page / 175-block imported PDF kept all source blocks present, mounted zero widget views until expansion and one afterward. A warm development scroll/open sample observed a 32.6 ms maximum timer interval, 16.6 ms p95, no long tasks in that window, 0.0879 observed layout-shift sum and zero source-anchor delta. These are one declared run, not field CLS or a universal 60fps claim. [Browser profile](rich-reader-performance.json).
- Seven batches of 24 envelope validations compare repeated full document validation with one deeply frozen privately marked source. [Measured seam comparison](widget-validation-performance.json) includes preparation cost, hardware, timings and actual preset transfer sizes. Mutable foreign sources cannot bypass full validation; this is tested. These timings do not establish whole-UI speedup.
- An injected full-storage failure allowed session bootstrap but made **zero** enrichment-start requests and displayed the failed request-reference warning. Local save errors remain visible independently of success messages.

## Actual Meta work, counted separately from fixture tests

Five frozen cases used official `muse-spark-1.3`: graph, sorting, optimization, attention and Bayesian updating, **5 creations / 28,135 reported tokens**. The first three are attributed prepared selections; the last two are independently authored teaching notes linked to original research. They are not five full-paper imports. Accepted kinds included graph, diagram, table, function, attention and probability. [Retained proposals/rejections and scope](enrichment-live-evaluation.json).

A separate actual 16-page sorting PDF import was read first with zero model creations. Explicit planning of its Powersort section produced a diagram and illustrative table (**6,643 tokens**). Both were accepted beside the original page-8 passage and restored after reload. A label-only settings request returned the requested columns diff (**5,926 tokens**); accepting changed “Scan step” to “Illustrative scan step”, and local undo restored it. No source values, mapping or units changed. The saved source predates the last heading-heuristic refinement and is deliberately not rewritten. [UI evidence](rich-workflows-browser.json).

One earlier development import used a stale HMR-retained controller and created the legacy guide (**22,625 tokens**). It is counted, not described as a free import. Full reload verified the new read-first behavior. Total additional real work in this implementation session: **8 creations / 63,329 reported tokens**. This is usage, not a dollar estimate or remaining credit balance. No further inference is needed for routine checks.

## Per-issue implementation evidence

Each numbered entry identifies the delivered interaction and the relevant code/checks. Computed toy mechanisms are not original-paper experiments; source matching proves location, not scientific correctness. Authored definitions/explanation layers cover curated prepared passages; unknown terms remain unresolved. Coarse planner concept guards reduce obvious mismatches and do not prove universal automatic scientific understanding.

<a id="issue-1"></a>

### [#1](https://github.com/ManuelR-T/paperplay/issues/1)

Shared 18/20/22 px preferences, measure/spacing/themes; 20 px default and stable source position.

Code: `components/reading/reader-tools.tsx`, `app/globals.css`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`, `rich-widget-accessibility.json`.

<a id="issue-2"></a>

### [#2](https://github.com/ManuelR-T/paperplay/issues/2)

Contextual passage tools, compact lazy figures, explicit assumptions, Escape and focus return.

Code: `components/reading/reader-tools.tsx`, `components/inline-source-widget.tsx`.

Checks: `reader-upgrade-report.md`, `rich-reader-performance.json`.

<a id="issue-3"></a>

### [#3](https://github.com/ManuelR-T/paperplay/issues/3)

Source contents, current section, focus reading, physical/logical locations and anchor restoration.

Code: `components/reading-session.tsx`, `components/reading/reader-tools.tsx`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`.

<a id="issue-4"></a>

### [#4](https://github.com/ManuelR-T/paperplay/issues/4)

Source-scoped authored glossary, selectable equation symbols and explicit unresolved definitions.

Code: `lib/reading/personal.ts`, `components/reading/reader-tools.tsx`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`.

<a id="issue-5"></a>

### [#5](https://github.com/ManuelR-T/paperplay/issues/5)

Optional authored intuition, worked example, technical and assumption layers beside original passages.

Code: `lib/reading/personal.ts`, `components/reading/reader-tools.tsx`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`.

<a id="issue-6"></a>

### [#6](https://github.com/ManuelR-T/paperplay/issues/6)

Bounded expression AST, defined variables/units, substitutions, quadratic result and linked curve.

Code: `shared/widgets.ts`, `lib/widgets/expression.ts`, `components/widgets/widget-view.tsx`.

Checks: `widgets.test.ts`, `widget-contracts.md`.

<a id="issue-7"></a>

### [#7](https://github.com/ManuelR-T/paperplay/issues/7)

Lazy original PDF.js page canvas; retained coordinates only when complete, otherwise page/quote fallback.

Code: `components/reading/original-pdf-page.tsx`, `shared/schema.ts`.

Checks: `reader-upgrade-report.md`, `reconstruction.test.ts`.

<a id="issue-8"></a>

### [#8](https://github.com/ManuelR-T/paperplay/issues/8)

Versioned capability catalog, actual controls/limits, prepared examples and separate legacy descriptors.

Code: `lib/widgets/catalog.ts`, `lib/widgets/presets.ts`, `shared/widgets.ts`.

Checks: `widgets.test.ts`, `widget-contracts.md`.

<a id="issue-9"></a>

### [#9](https://github.com/ManuelR-T/paperplay/issues/9)

Conceptual diagrams, labeled relationships, node selection, conceptual steps and zoom with no execution claim.

Code: `components/widgets/widget-view.tsx`, `lib/widgets/compute.ts`.

Checks: `widgets.test.ts`, `rich-widget-accessibility.json`.

<a id="issue-10"></a>

### [#10](https://github.com/ManuelR-T/paperplay/issues/10)

Origin/unit declarations, stable row filtering/sorting/selection and full-precision CSV/JSON exports.

Code: `components/widgets/widget-view.tsx`, `shared/widgets.ts`.

Checks: `widgets.test.ts`, `rich-workflows-browser.json`.

<a id="issue-11"></a>

### [#11](https://github.com/ManuelR-T/paperplay/issues/11)

Trusted function samples, pointer/keyboard probes, numerical derivative, discontinuity breaks and numeric values.

Code: `lib/widgets/expression.ts`, `lib/widgets/compute.ts`, `components/widgets/widget-view.tsx`.

Checks: `widgets.test.ts`, `widget-contracts.md`.

<a id="issue-12"></a>

### [#12](https://github.com/ManuelR-T/paperplay/issues/12)

Editable 2D matrix/vector, transformed basis/region, determinant, conditioning and explicit singular/eigen limits.

Code: `lib/widgets/compute.ts`, `components/widgets/widget-view.tsx`.

Checks: `widgets.test.ts`, `widget-contracts.md`.

<a id="issue-13"></a>

### [#13](https://github.com/ManuelR-T/paperplay/issues/13)

Seeded mass/density samples, beta prior/posterior and distinct relative likelihood, numeric values and approximate intervals.

Code: `lib/widgets/compute.ts`, `components/widgets/widget-view.tsx`.

Checks: `widgets.test.ts`, `widget-contracts.md`.

<a id="issue-14"></a>

### [#14](https://github.com/ManuelR-T/paperplay/issues/14)

Editable Q/K/V, stable scaled softmax, per-cell masks, selected query and exact toy outputs.

Code: `lib/widgets/compute.ts`, `components/widgets/widget-view.tsx`.

Checks: `widgets.test.ts`, `widget-contracts.md`.

<a id="issue-15"></a>

### [#15](https://github.com/ManuelR-T/paperplay/issues/15)

Editable bounded graph/grid, keyboard/value alternatives to dragging, weights/obstacles and actual Dijkstra steps.

Code: `components/widgets/widget-view.tsx`, `lib/widgets/compute.ts`.

Checks: `widgets.test.ts`, `widget-mobile-qa.json`.

<a id="issue-16"></a>

### [#16](https://github.com/ManuelR-T/paperplay/issues/16)

Synthetic 1D/2D signal and kernel, explicit stride/boundary/normalization, local products and optional DFT.

Code: `lib/widgets/compute.ts`, `components/widgets/widget-view.tsx`.

Checks: `widgets.test.ts`, `widget-mobile-qa.json`.

<a id="issue-17"></a>

### [#17](https://github.com/ManuelR-T/paperplay/issues/17)

One canonical spec/seed revision links source, model and selected operation; comparisons default to independent playback.

Code: `lib/experiments/selection.ts`, `components/inline-source-widget.tsx`, `components/figures/experiment.tsx`, `components/figures/generated-figure.tsx`.

Checks: `widget-workspace.test.ts`, `rich-workflows-browser.json`.

<a id="issue-18"></a>

### [#18](https://github.com/ManuelR-T/paperplay/issues/18)

One/two-axis actual worker sweeps, fixed input/seed, bounded operations, explicit failed/nonconverged points and measured-report export.

Code: `lib/experiments/explore.ts`, `components/experiment-explorer.tsx`.

Checks: `exploration.test.ts`, `rich-workflows-browser.json`.

<a id="issue-19"></a>

### [#19](https://github.com/ManuelR-T/paperplay/issues/19)

Pinned full input/seed/version/parameters, independent recomputation, explicit assumption/unit/status changes and portable settings.

Code: `lib/experiments/explore.ts`, `components/experiment-explorer.tsx`.

Checks: `exploration.test.ts`, `rich-workflows-browser.json`.

<a id="issue-20"></a>

### [#20](https://github.com/ManuelR-T/paperplay/issues/20)

Catalog-aware concept plans with exact source grounding, real controls, per-proposal rejection and explicit decisions.

Code: `lib/enrichment/contracts.ts`, `server/enrichment/provider.ts`, `components/enrichment-workbench.tsx`.

Checks: `enrichment.test.ts`, `enrichment-live-evaluation.json`, `rich-workflows-browser.json`.

<a id="issue-21"></a>

### [#21](https://github.com/ManuelR-T/paperplay/issues/21)

Explicit targeted repair of one widget with bounded source context, provenance/history and local undo.

Code: `server/enrichment/provider.ts`, `components/enrichment-workbench.tsx`, `lib/enrichment/state.ts`.

Checks: `enrichment.test.ts`, `enrichment.md`.

<a id="issue-22"></a>

### [#22](https://github.com/ManuelR-T/paperplay/issues/22)

Constrained settings requests produce a reviewable typed diff; protected source/evidence/engine fields and explicit accept/reject/undo.

Code: `server/enrichment/provider.ts`, `components/enrichment-workbench.tsx`.

Checks: `enrichment.test.ts`, `rich-workflows-browser.json`.

<a id="issue-23"></a>

### [#23](https://github.com/ManuelR-T/paperplay/issues/23)

Read-first import and visible bounded section coverage, durable per-paper reservations, idempotent accepted-job recovery/cancel.

Code: `lib/import-controller.ts`, `lib/enrichment/sections.ts`, `server/enrichment/handlers.ts`, `server/enrichment/store.ts`.

Checks: `import-controller.test.ts`, `enrichment.test.ts`, `enrichment.md`.

<a id="issue-25"></a>

### [#25](https://github.com/ManuelR-T/paperplay/issues/25)

Local anchored notes/highlights/questions/definitions; source-version resolution and linked compatible experiments.

Code: `lib/reading/personal.ts`, `components/reading/notes-state.ts`, `components/reading/reader-tools.tsx`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`.

<a id="issue-26"></a>

### [#26](https://github.com/ManuelR-T/paperplay/issues/26)

Printable standalone study pack with explicit source/notes/PDF inclusion, captured values and compatible reopen links.

Code: `lib/reading/study-pack.ts`, `components/reading/reader-tools.tsx`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`.

<a id="issue-27"></a>

### [#27](https://github.com/ManuelR-T/paperplay/issues/27)

Worker-based local passage/title/definition/note search, bounded indexing and exact source navigation.

Code: `lib/reading/search-worker.ts`, `lib/reading/personal.ts`, `components/reading/reader-tools.tsx`.

Checks: `reader-tools.test.ts`, `reader-upgrade-report.md`.

<a id="issue-28"></a>

### [#28](https://github.com/ManuelR-T/paperplay/issues/28)

Passage/type/title composer with unsaved real-widget preview, validated data editor and explicit save/discard.

Code: `components/research-workbench.tsx`, `lib/experiments/workspace.ts`, `components/widgets/widget-view.tsx`.

Checks: `widget-workspace.test.ts`, `widgets.test.ts`, `rich-workflows-browser.json`.

<a id="issue-29"></a>

### [#29](https://github.com/ManuelR-T/paperplay/issues/29)

Source-v3 conservative paragraphs/headings/dehyphenation with raw text, coordinate provenance and immutable older records.

Code: `lib/import/reconstruct.ts`, `lib/import/pdf-core.ts`, `shared/schema.ts`.

Checks: `reconstruction.test.ts`, `pdf-layout.test.ts`, `pdf-reconstruction-v3.json`.

<a id="issue-30"></a>

### [#30](https://github.com/ManuelR-T/paperplay/issues/30)

Separate v2 widget format; frozen legacy snapshots; explicit unknown-version rejection/recovery and backup before overwrite.

Code: `lib/widgets/compatibility.ts`, `lib/experiments/workspace.ts`.

Checks: `widgets.test.ts`, `widget-workspace.test.ts`, `tests/fixtures/release-1.1.0-snapshots.json`.

<a id="issue-32"></a>

### [#32](https://github.com/ManuelR-T/paperplay/issues/32)

Deferred heavy figures, worker bounds and immutable validated-source reuse; measured validation batches, scrolling and layout shifts.

Code: `shared/widgets.ts`, `lib/widgets/worker-client.ts`, `components/reading/reader-tools.tsx`.

Checks: `widget-validation-performance.json`, `rich-reader-performance.json`, `rich-widget-accessibility.json`.

## Explicitly unfinished

- **#24 / PP-069:** 0 participants, 0 sessions. [Protocol](reader-study-protocol.md) and [empty observation ledger](reader-study-observations.json) are prepared before recruitment. Run 3–5 consented real sessions and report actual confusion/usefulness; do not substitute developer checks for learning evidence.
- **#31 / #33 / #34:** final Railway hosting, access/persistence drills and hosted smoke remain for release. The existing private Sites demonstration stays unchanged and represents the earlier implementation.
- No accounts, cross-device note synchronization, arbitrary generated code execution, full research reproduction or unlimited-document support is claimed. Browser storage remains finite. Local-PDF URLs require the recipient's exact source version; packs disclose content inclusion and rights.
- Catalog planning's durable per-paper ledger supports one persistent Node host. Distributed new enrichment fails closed until a shared adapter is supplied; this feature is not automatically added to the older Sites Worker.
