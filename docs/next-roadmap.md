# Paperplay after the MVP — M6–M10

Status: **planned**, 27 October 2026. These are new follow-up issues, not implemented features or a claim that the first evening produced the finished product. Release 1.1.0 is the functional foundation; the earlier [M0–M5 backlog](backlog.md), evidence and PP-037/038 external acceptance gates remain unchanged.

The product direction is an article that is pleasant to read and useful to think with: change a symbol, inspect a transformation, challenge an assumption, and see every related view respond beside the source. An unsupported algorithm can still have a meaningful conceptual diagram. A computed result always needs a declared model, valid data and a checked implementation.

## Problems visible in the current implementation

The equation view is static KaTeX. Paragraph-level Ask actions and full control/evidence stacks interrupt the reading flow. The graph layout is fixed and imported figures have fewer data-editing controls than prepared examples. Numeric figures cover small SPD matrices and residual curves; there is no probability, attention-tensor, geometric-transformation or signal widget. Comparisons align trace indices, not necessarily comparable semantic events. The held-out Meta baseline mostly produced conceptual step cards and rejected unsupported computed proposals.

These observations come from the code and recorded evaluation. They are not a participant study or evidence that a particular new UI will improve learning. M6 designs and M8 reader sessions must test that assumption.

## Deliver in vertical slices

Do not finish the whole catalog before a reader sees a better experience. The first slice changes the reading surface; the second makes one source equation and its explanation explorable; the third connects useful automatic placement to those capabilities. New families can then be added incrementally.

### A — Comfortable reading

A quiet, configurable reader with reliable source navigation.

[PP-046 · #1](https://github.com/ManuelR-T/paperplay/issues/1) → [PP-047 · #2](https://github.com/ManuelR-T/paperplay/issues/2) → [PP-048 · #3](https://github.com/ManuelR-T/paperplay/issues/3)

Estimated work: 11–20 focused hours, excluding external waiting. Respect the dependency graph; migrations and hosted gates are integrated into the slice that needs them.

### B — One idea becomes explorable

Symbols, one manipulable equation, concept diagrams and function plots on real source passages, with compatible snapshots.

[PP-049 · #4](https://github.com/ManuelR-T/paperplay/issues/4) → [PP-051 · #6](https://github.com/ManuelR-T/paperplay/issues/6) → [PP-053 · #8](https://github.com/ManuelR-T/paperplay/issues/8) → [PP-054 · #9](https://github.com/ManuelR-T/paperplay/issues/9) → [PP-056 · #11](https://github.com/ManuelR-T/paperplay/issues/11) → [PP-075 · #30](https://github.com/ManuelR-T/paperplay/issues/30)

Estimated work: 36–63 focused hours, excluding external waiting. Respect the dependency graph; migrations and hosted gates are integrated into the slice that needs them.

### C — Useful automatic enrichment

Linked views and budgeted per-section plans, targeted repair, actual reader observations and hosted evidence.

[PP-062 · #17](https://github.com/ManuelR-T/paperplay/issues/17) → [PP-065 · #20](https://github.com/ManuelR-T/paperplay/issues/20) → [PP-066 · #21](https://github.com/ManuelR-T/paperplay/issues/21) → [PP-068 · #23](https://github.com/ManuelR-T/paperplay/issues/23) → [PP-069 · #24](https://github.com/ManuelR-T/paperplay/issues/24) → [PP-076 · #31](https://github.com/ManuelR-T/paperplay/issues/31)

Estimated work: 43–74 focused hours, excluding external waiting. Respect the dependency graph; migrations and hosted gates are integrated into the slice that needs them.

### D — Breadth and personal workflow

Add remaining families and authoring/library tools incrementally after demonstrated usefulness.

[PP-050 · #5](https://github.com/ManuelR-T/paperplay/issues/5) → [PP-052 · #7](https://github.com/ManuelR-T/paperplay/issues/7) → [PP-055 · #10](https://github.com/ManuelR-T/paperplay/issues/10) → [PP-057 · #12](https://github.com/ManuelR-T/paperplay/issues/12) → [PP-058 · #13](https://github.com/ManuelR-T/paperplay/issues/13) → [PP-059 · #14](https://github.com/ManuelR-T/paperplay/issues/14) → [PP-060 · #15](https://github.com/ManuelR-T/paperplay/issues/15) → [PP-061 · #16](https://github.com/ManuelR-T/paperplay/issues/16) → [PP-063 · #18](https://github.com/ManuelR-T/paperplay/issues/18) → [PP-064 · #19](https://github.com/ManuelR-T/paperplay/issues/19) → [PP-067 · #22](https://github.com/ManuelR-T/paperplay/issues/22) → [PP-070 · #25](https://github.com/ManuelR-T/paperplay/issues/25) → [PP-071 · #26](https://github.com/ManuelR-T/paperplay/issues/26) → [PP-072 · #27](https://github.com/ManuelR-T/paperplay/issues/27) → [PP-073 · #28](https://github.com/ManuelR-T/paperplay/issues/28) → [PP-074 · #29](https://github.com/ManuelR-T/paperplay/issues/29) → [PP-077 · #32](https://github.com/ManuelR-T/paperplay/issues/32)

Estimated work: 112–194 focused hours, excluding external waiting. Respect the dependency graph; migrations and hosted gates are integrated into the slice that needs them.

## Scope, budget and architecture

Keep Next.js, TypeScript, shadcn/ui, trusted browser workers and the official Meta integration. These issues identify new domain/UI seams; they do not justify a framework rewrite or commit to an unverified dependency.

Use a capability catalog and a bounded expression evaluator to separate visual forms, controls, data and execution. Meta proposes placement, explanations and configuration; trusted validators and engines decide what can execute. Natural-language editing, source comparison and authoring are explicit post-MVP additions. Arbitrary generated code, model training, automatic private-paper uploads, cloud accounts and real-time collaboration remain excluded.

Interaction, playback, preference changes, search and manual authoring stay provider-free. Import, section enrichment and repairs need explicit bounded actions, source-versioned caches, deduplication and shared quotas. A larger catalog must not multiply paid calls by default. Do not infer a dollar cap or remaining credit balance from token accounting. Preserve the intentionally private hosted audience.

For every new source/teaching fixture, establish attribution and redistribution permissions before bundling it. Do not infer a license from an arXiv URL or successful import. New parameter controls, assumptions and pedagogical simplifications must stay visible near the figure without overwhelming the source.

The 32 issue estimates sum to **202–351 focused hours** before contingency. A provisional 25% margin gives roughly 252–439 hours. These are solo planning estimates, not measured historical effort or a promised hackathon delivery date. Actual reader/participant availability and uncertain extraction work can change them. Re-estimate after each vertical slice.

## Shared completion criteria

- A visible, source-linked user interaction works end to end in a real browser.
- A computation has independent references and explicit bounds; a concept illustration does not invent execution.
- Keyboard, reduced motion, readable values, narrow layout and source return work.
- Portable state has validated compatibility and provenance; no private paper is silently uploaded.
- Meta calls are explicit, cached and quota-accounted; local interaction is provider-free.
- The issue closes only with actual evidence and known limits, not a screenshot or a model assertion alone.

## Issues and dependencies

### M6 — A reader worth spending time in

A source paragraph, equation and experiment can be followed comfortably by keyboard and at narrow widths.

#### PP-046 — Make long-form reading comfortable and configurable

[GitHub #1](https://github.com/ManuelR-T/paperplay/issues/1) · P0 · planned · 4–7 focused hours

Read a dense section for ten minutes without tiny labels, overlong lines or a dashboard dominating the paper.

Establish an editorial reading system: 18/20/22 px body presets, 55–75 ch measure, line-height 1.55–1.85, paragraph rhythm, clear heading hierarchy and light/sepia/high-contrast themes. Store preferences locally; preserve source text.

**Acceptance:**

- [ ] One reading-settings control applies and restores font size, measure, spacing and theme across prepared and imported papers.
- [ ] The default desktop body is 20 px; essential controls are at least 16 px and auxiliary text at least 14 px, with documented contrast checks.
- [ ] Text-spacing overrides, 200% zoom, 320 px width, long equations and dark/high-contrast preferences retain readable text and reachable controls.
- [ ] Changing preferences preserves the current source anchor and does not modify source content or trigger inference.

**Verification:** Inspect paragraph/equation/figure fixtures at desktop and 320 px, zoom and spacing overrides; keyboard-test settings and restoration.

**Evidence policy:** presentation.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-033](backlog.md#pp-033).

**Start in:** `app/globals.css`, `components/paper-workspace.tsx`, `components/imported-paper.tsx`.

#### PP-047 — Reduce visual noise with compact figures and progressive controls

[GitHub #2](https://github.com/ManuelR-T/paperplay/issues/2) · P0 · planned · 4–7 focused hours

Follow the argument continuously while opening the relevant experiment only when needed.

Separate the source, added intuition and experiment controls visually. Use compact inline figures with an optional inspection panel, contextual Ask actions and expandable assumptions/evidence; retain a short visible truth label.

**Acceptance:**

- [ ] Original paragraphs no longer each require a permanently visible Ask button; the action is available through keyboard/focus as well as selection.
- [ ] Inputs, playback, source return and an essential evidence label remain discoverable while advanced settings and long diagnostics are collapsed.
- [ ] Expanding a widget or opening the inspection panel preserves reading position and supports Escape/focus return.
- [ ] Desktop and narrow-screen layouts avoid nested scroll traps and preserve accessible reading order.

**Verification:** Compare source-heavy and figure-heavy sections in actual browser use; exercise keyboard-only expansion and screen-width changes.

**Evidence policy:** presentation.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-046](https://github.com/ManuelR-T/paperplay/issues/1).

**Start in:** `components/paper-workspace.tsx`, `components/figures/experiment.tsx`, `components/figures/generated-figure.tsx`.

#### PP-048 — Add focus reading and source-aware navigation

[GitHub #3](https://github.com/ManuelR-T/paperplay/issues/3) · P0 · planned · 3–6 focused hours

Move between a concept, its explanation and its experiment without losing the place in the paper.

Provide a focus reading mode, collapsible contents, current-section indication, anchor breadcrumbs and a return-to-reading control. Keep PDF physical pages distinct from HTML logical positions.

**Acceptance:**

- [ ] Contents track the visible source section and support keyboard navigation without stealing focus during ordinary scrolling.
- [ ] Entering and leaving focus mode restores the selected source block, figure and scroll position.
- [ ] Source citations and figure return links reveal the correct passage even when surrounding sections or panels are collapsed.
- [ ] Progress is based on disclosed source positions; no invented page number or precise reading-time estimate is shown.

**Verification:** Navigate between distant sections and figures, reload mid-paper, and exercise HTML and PDF sources with stable anchors.

**Evidence policy:** presentation.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-046](https://github.com/ManuelR-T/paperplay/issues/1), [PP-047](https://github.com/ManuelR-T/paperplay/issues/2).

**Start in:** `components/reading-session.tsx`, `lib/reading-state.ts`, `components/paper-workspace.tsx`.

#### PP-049 — Explain mathematical symbols and terminology in context

[GitHub #4](https://github.com/ManuelR-T/paperplay/issues/4) · P1 · planned · 5–9 focused hours

Understand a symbol or technical term without opening a separate chat and losing the current paragraph.

Add a source-linked symbol glossary and term popovers, including scope-specific meanings, definitions and prerequisites. Start from authored fixtures; opt-in Meta suggestions remain interpretations.

**Acceptance:**

- [ ] Selecting a symbol or term shows its definition, scope, source reference and whether the definition is authored, quoted or generated.
- [ ] A symbol reused with two meanings in different sections retains both scoped definitions instead of a single global guess.
- [ ] Popover access works on focus/keyboard and touch; dismissal returns focus and does not obscure the whole equation.
- [ ] Missing definitions remain explicitly unresolved; a generated definition cannot replace original source text.

**Verification:** Use repeated symbols, absent definitions, ambiguous terms and citation-jump fixtures; review generated examples against their sources.

**Evidence policy:** source-linked interpretation.

**Inference policy:** Authored/cached definitions are free; requesting missing Meta definitions is explicit, bounded, quota-accounted and cached per source version.

**Dependencies:** [PP-046](https://github.com/ManuelR-T/paperplay/issues/1).

**Start in:** `shared/schema.ts`, `components/paper-workspace.tsx`, `lib/analysis.ts`.

#### PP-050 — Offer intuition, worked examples and technical explanation layers

[GitHub #5](https://github.com/ManuelR-T/paperplay/issues/5) · P1 · planned · 5–9 focused hours

Let a student find an entry point while an experienced reader can stay close to the original argument.

Add optional layers per anchored concept: intuition, a small worked example, assumptions and technical detail. Use the same source and a consistent example across layers; do not rewrite the source into simplified prose.

**Acceptance:**

- [ ] The original passage remains available and visually distinct in every layer.
- [ ] A reader can reveal a prerequisite or worked example locally without changing the whole document or issuing another model call.
- [ ] Worked examples explicitly identify synthetic inputs, assumptions and any actual engine result; unexecuted steps are labeled conceptual.
- [ ] All layers retain citations, avoid unsupported widget controls and reopen from a source-versioned cache.

**Verification:** Review matched student/technical explanations for two source families; test missing evidence and conflicting explanation fixtures.

**Evidence policy:** source-linked interpretation.

**Inference policy:** Generate only on explicit request or as part of one bounded import; selecting an already available layer never invokes Meta.

**Dependencies:** [PP-049](https://github.com/ManuelR-T/paperplay/issues/4), [PP-047](https://github.com/ManuelR-T/paperplay/issues/2).

**Start in:** `lib/analysis.ts`, `shared/import-types.ts`, `components/figures/generated-figure.tsx`.

#### PP-051 — Turn supported source equations into manipulable experiments

[GitHub #6](https://github.com/ManuelR-T/paperplay/issues/6) · P0 · planned · 8–14 focused hours

Change a symbol and see the numerical result and linked visual change beside the unchanged source equation.

Introduce a bounded expression tree for supported arithmetic, vectors and elementary functions, with explicit domains and optional units. Bind an original equation to authored parameter definitions before extending Meta mapping.

**Acceptance:**

- [ ] A quadratic example exposes editable coefficients/variables, substitution values and the resulting value and curve.
- [ ] Every interactive symbol is associated with a definition and a verified mapping to the original equation; ambiguous formulas remain static.
- [ ] The evaluator rejects arbitrary JavaScript, unsupported operators, invalid units/domains and excessive expression depth.
- [ ] Keyboard edits, reset, save/share and accessible numerical equivalents preserve the exact expression and parameter values.

**Verification:** Compare supported expressions with independent numerical references; test division by zero, nonfinite values, unit mismatches and malicious input.

**Evidence policy:** bounded deterministic computation.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-049](https://github.com/ManuelR-T/paperplay/issues/4), [PP-040](backlog.md#pp-040).

**Start in:** `shared/schema.ts`, `lib/engines`, `components/figures/numeric-view.tsx`.

#### PP-052 — Compare the reformatted reader with the original PDF passage

[GitHub #7](https://github.com/ManuelR-T/paperplay/issues/7) · P1 · planned · 6–10 focused hours

Check an equation, omitted figure or doubtful extraction directly in the original without abandoning the reading flow.

Add a source comparison pane using original local PDF bytes and extraction coordinates where available. Keep the existing separate original link as a fallback and distinguish exact bounding boxes from page/quote references.

**Acceptance:**

- [ ] Opening a source citation displays the correct original PDF page and preserves the reformatted reader position.
- [ ] Highlight geometry is shown only when extraction provides a reliable coordinate mapping; otherwise the UI says page/quote only.
- [ ] Original figures can be inspected as source page regions without presenting generated reconstruction as the original.
- [ ] The pane is keyboard/touch usable, lazy-loaded, closable and respects local-PDF/bundle permissions.

**Verification:** Check single/two-column pages, equations, missing coordinate maps and local bundles against original PDFs.

**Evidence policy:** source rendering.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-048](https://github.com/ManuelR-T/paperplay/issues/3), [PP-043](backlog.md#pp-043).

**Start in:** `lib/import/pdf-core.ts`, `lib/import/normalize.ts`, `components/imported-paper.tsx`.

### M7 — A richer widget language

New catalog types have real controls, accessible values and explicit evidence policies.

#### PP-053 — Declare widget capabilities and controls in one extensible catalog

[GitHub #8](https://github.com/ManuelR-T/paperplay/issues/8) · P0 · planned · 6–10 focused hours

Add a widget once and make its real interactions discoverable to the renderer, author and Meta planner.

Replace duplicated widget/engine enums and scattered control assumptions with versioned catalog descriptors: data shapes, visual variants, interactions, limits, required evidence, empty states and compatible engines. Deliver usable examples for every descriptor.

**Acceptance:**

- [ ] A new widget can be registered without adding its algorithm name to the reader or prompt branches.
- [ ] Each catalog entry lists actual controls, input bounds, provenance rules, accessible equivalent and a prepared example.
- [ ] The planner receives only capabilities supported by the active app version; unsupported catalog/version combinations fail explicitly.
- [ ] Existing graph, array, steps, comparison, matrix and plot snapshots still open under a documented compatibility policy.

**Verification:** Exercise all existing renderers through catalog fixtures and reject unavailable controls, missing fields and stale descriptors.

**Evidence policy:** application-owned capabilities.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-003](backlog.md#pp-003), [PP-041](backlog.md#pp-041).

**Start in:** `shared/schema.ts`, `lib/analysis.ts`, `lib/engines/index.ts`, `components/figures/generated-figure.tsx`.

#### PP-054 — Add interactive concept diagrams and state-machine walkthroughs

[GitHub #9](https://github.com/ManuelR-T/paperplay/issues/9) · P0 · planned · 5–9 focused hours

Inspect dependencies, data flow and state changes even when a paper has no executable engine.

Provide bounded node/link diagrams with step-linked highlights, local pan/zoom, selection, optional grouping and textual relationships. Preserve source labels and distinguish authored illustrative transitions from executed traces.

**Acceptance:**

- [ ] A source-linked pipeline and a state-machine example each support node selection and step-linked highlighting.
- [ ] Each edge has a readable meaning and each state has a text description; the diagram remains usable without color or dragging.
- [ ] An illustrative diagram never displays execution metrics or claims that selected nodes ran an algorithm.
- [ ] Layout and selected step restore from a validated snapshot with bounded node/link counts.

**Verification:** Review source mappings for two unrelated papers; inspect keyboard navigation, cyclic diagrams, long labels and reduced motion.

**Evidence policy:** illustrative unless bound to an existing verified trace.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8).

**Start in:** `shared/schema.ts`, `components/figures/generated-figure.tsx`, `lib/fidelity.ts`.

#### PP-055 — Make source and computed tables explorable

[GitHub #10](https://github.com/ManuelR-T/paperplay/issues/10) · P1 · planned · 4–7 focused hours

Inspect rows, variables and tradeoffs instead of reading a static wall of metrics.

Add table selection, bounded filtering/sorting, column definitions and an optional linked bar/dot view. Keep source-reported measurements separate from locally computed results and synthetic teaching data.

**Acceptance:**

- [ ] Every dataset declares its origin, units and source reference; source values are never filled in by Meta guesses.
- [ ] Sorting/filtering changes the view, preserves row identity and does not alter the underlying run or source table.
- [ ] A selected row or metric can reveal its definition and linked source passage.
- [ ] An accessible table and CSV/JSON export retain full precision, provenance and visible filtering state.

**Verification:** Compare values with original and engine fixtures; test missing values, mixed units and keyboard-only filtering.

**Evidence policy:** explicitly source-reported, computed or illustrative.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8).

**Start in:** `shared/schema.ts`, `components/figures/experiment.tsx`, `lib/snapshots.ts`.

#### PP-056 — Add function plots with draggable probes and linked values

[GitHub #11](https://github.com/ManuelR-T/paperplay/issues/11) · P0 · planned · 7–12 focused hours

Explore how a mathematical relationship behaves across its domain rather than only watching a residual curve.

Build bounded 1D function/parametric plots from the trusted expression evaluator, with parameter sliders, probes, annotations, optional derivative overlays and explicit discontinuity handling.

**Acceptance:**

- [ ] Moving a probe by pointer or keyboard updates the shown x/value and linked equation substitution.
- [ ] Poles and invalid domains break the plotted curve instead of connecting invalid samples; sampled/interpolated segments are disclosed.
- [ ] All plotted values derive from an authored expression and recorded parameters, with a numerical table alternative.
- [ ] Sampling, cancellation, reset and portable snapshots respect fixed budgets and supported evaluator operations.

**Verification:** Check polynomials, sinusoids, discontinuities and boundary values against analytic references; review screen-reader text and narrow layouts.

**Evidence policy:** bounded deterministic computation.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-051](https://github.com/ManuelR-T/paperplay/issues/6).

**Start in:** `components/figures/numeric-view.tsx`, `lib/execution`, `shared/schema.ts`.

#### PP-057 — Make linear algebra visible as geometric transformations

[GitHub #12](https://github.com/ManuelR-T/paperplay/issues/12) · P1 · planned · 7–12 focused hours

See what matrix entries do to basis vectors, a point and a region.

Start with bounded 2D matrix/vector transformations, bases, projections and conditioning examples. Provide exact numerical values and explicit singular/non-symmetric cases before considering 3D.

**Acceptance:**

- [ ] Editing matrix entries or a vector synchronizes the matrix, transformed basis, point and region.
- [ ] The example distinguishes a singular map, rotation, projection and anisotropic scaling using reference-checked outputs.
- [ ] Unsupported eigen-decompositions and numerical instabilities have explicit states instead of guessed geometry.
- [ ] Pointer interactions have keyboard/value alternatives and the full experiment can be reset and restored.

**Verification:** Verify known matrices, determinant/area relationships and transformation composition using independent references and tolerances.

**Evidence policy:** bounded deterministic computation; no claim to reproduce all linear algebra in a paper.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-041](backlog.md#pp-041).

**Start in:** `lib/engines/numeric.ts`, `components/figures/numeric-view.tsx`, `shared/schema.ts`.

#### PP-058 — Add probability, seeded sampling and Bayesian-update widgets

[GitHub #13](https://github.com/ManuelR-T/paperplay/issues/13) · P1 · planned · 8–14 focused hours

Build intuition for probability and uncertainty by changing assumptions and observing real samples and updates.

Support a small declared set first: Bernoulli/binomial/normal sampling and a beta-Bernoulli update. Show distribution parameters, observed counts, normalization and exact versus sampled quantities.

**Acceptance:**

- [ ] A reader can alter parameters, draw a reproducible seeded sample and compare empirical and analytic quantities.
- [ ] A beta-Bernoulli example recomputes prior, likelihood and posterior from explicit observation counts.
- [ ] Density, probability mass, samples and credible intervals are named distinctly with assumptions and units.
- [ ] Bounds, invalid parameters, RNG version, seeds and observation data are validated and preserved in snapshots.

**Verification:** Check analytic moments, normalization and conjugate updates; use seeded deterministic cases and statistical tests with justified tolerances.

**Evidence policy:** analytic deterministic results plus explicitly seeded stochastic samples.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8).

**Start in:** `lib/engines`, `shared/schema.ts`, `components/figures`.

#### PP-059 — Explain attention through small editable tensor computations

[GitHub #14](https://github.com/ManuelR-T/paperplay/issues/14) · P1 · planned · 8–14 focused hours

Inspect how query/key scores turn into weights and weighted values for a toy sequence.

Implement only bounded scaled dot-product attention on explicit small Q/K/V matrices. Link score, softmax and output views; introduce toy labels, masks and temperature without pretending to run a trained Transformer.

**Acceptance:**

- [ ] Editing an admissible Q/K/V value recomputes dot products, scaled logits, softmax weights and weighted output.
- [ ] Selecting one query highlights corresponding tensor cells, arithmetic and source equation.
- [ ] Dimensions, masks, stable softmax, finite values and row normalization are reference-checked; invalid masked rows fail explicitly.
- [ ] The figure says toy attention computation, shows its synthetic inputs and never claims Transformer training or original paper reproduction.

**Verification:** Compare with an independent small matrix implementation; check extreme logits, all-masked rows, shape errors and source equation mapping.

**Evidence policy:** reference-checked small attention mechanism only.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-040](backlog.md#pp-040).

**Start in:** `lib/engines`, `shared/schema.ts`, `components/figures/numeric-view.tsx`.

#### PP-060 — Provide an editable graph and grid algorithm canvas

[GitHub #15](https://github.com/ManuelR-T/paperplay/issues/15) · P1 · planned · 7–12 focused hours

Construct a counterexample or scenario directly instead of only changing one pre-existing edge weight.

Add node/edge editing, graph layout movement, start/target selection and a bounded grid/obstacle view. Engine capability descriptors decide which operations and semantics each input supports.

**Acceptance:**

- [ ] Users can add, delete, connect and move elements with keyboard/value controls as well as pointer interaction.
- [ ] Invalid graph/grid structure or weights show actionable validation and do not activate an incompatible engine.
- [ ] Input edits cancel stale execution and reset playback; complete input, layout and selection restore in a snapshot.
- [ ] At least one graph scenario and one grid scenario expose all assumptions; an unsupported method remains an illustration.

**Verification:** Check constructed graphs against independent distances, unreachable targets, obstacle boundaries and cancellation during editing.

**Evidence policy:** computed only through a declared compatible engine; layouts are presentation.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-042](backlog.md#pp-042).

**Start in:** `components/figures/trace-view.tsx`, `lib/engines/index.ts`, `lib/execution`, `shared/schema.ts`.

#### PP-061 — Add signal and image-operator playgrounds

[GitHub #16](https://github.com/ManuelR-T/paperplay/issues/16) · P2 · planned · 9–15 focused hours

Understand convolution and sampling through a small signal or synthetic image that can be inspected numerically.

Introduce bounded 1D convolution and a small 2D kernel, stepwise products and boundary modes. Add a small frequency representation only with an explicitly verified transform and adequate transfer budgets.

**Acceptance:**

- [ ] Editing a kernel or signal updates computed output and highlights the currently multiplied input region.
- [ ] Boundary handling, stride and normalization are explicit, with hand-checkable impulse/constant examples.
- [ ] Input/output values have accessible numeric equivalents; any frequency-domain panel reports its sampling convention.
- [ ] Image inputs are synthetic or explicitly selected local files; changing a kernel uploads nothing and cannot execute generated code.

**Verification:** Compare independent convolution references, impulse responses and border cases; test bounded execution and accessible alternatives.

**Evidence policy:** bounded deterministic teaching operators; no inferred private image uploads.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8).

**Start in:** `lib/engines`, `components/figures`, `lib/execution`.

### M8 — Exploration and useful automatic enrichment

A reader can inspect and refine a grounded, diverse widget plan; real readers evaluate its usefulness.

#### PP-062 — Link source, formula, pseudocode and visual states through semantic events

[GitHub #17](https://github.com/ManuelR-T/paperplay/issues/17) · P0 · planned · 8–13 focused hours

Selecting a data element or operation explains the same event in every related view.

Introduce typed selection/event channels with stable data identities and revisions. Support linked highlights and source/formula references; replace comparison index alignment only when an engine declares an equivalent semantic event.

**Acceptance:**

- [ ] Selecting a graph node, matrix cell or trace operation updates the relevant visual, formula/pseudocode and source highlights.
- [ ] Views share one canonical input revision; edits cannot leave a plot showing an older run.
- [ ] Comparisons use declared semantic checkpoints where meaningful and explicitly independent playback otherwise.
- [ ] Selections and layout restore without feedback loops, stale highlights or model calls.

**Verification:** Exercise two unrelated families, reordered data, async worker results and incompatible comparison semantics.

**Evidence policy:** semantic events must come from source mappings or actual engine traces.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-054](https://github.com/ManuelR-T/paperplay/issues/9), [PP-051](https://github.com/ManuelR-T/paperplay/issues/6).

**Start in:** `shared/schema.ts`, `lib/execution/protocol.ts`, `components/figures/experiment.tsx`, `components/reading-session.tsx`.

#### PP-063 — Explore parameter sweeps and stability regions

[GitHub #18](https://github.com/ManuelR-T/paperplay/issues/18) · P1 · planned · 8–14 focused hours

Compare a range of hypotheses and discover where an algorithm changes behavior.

Add bounded one/two-parameter experiment grids, curve families and small phase diagrams using existing compatible engines. Present the planned run budget and common input/seed policy before execution.

**Acceptance:**

- [ ] Every plotted point links to its exact engine version, input, seed, parameter values, status and measured metric.
- [ ] Sweep cancellation stops queued work; failed/nonconverged cases remain visible rather than becoming interpolated successes.
- [ ] Comparisons preserve the declared common input/seed policy and units; hardware speedup is not inferred from operation counts.
- [ ] A selected point reopens its single experiment, and exported results retain provenance and budget settings.

**Verification:** Validate a small grid against independent individual runs; test cancellation, invalid domains, point caps and nonconvergence.

**Evidence policy:** actual bounded engine measurements; interpolation is separately labeled.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-062](https://github.com/ManuelR-T/paperplay/issues/17), [PP-056](https://github.com/ManuelR-T/paperplay/issues/11), [PP-042](backlog.md#pp-042).

**Start in:** `lib/execution`, `lib/engines/index.ts`, `components/figures/numeric-view.tsx`, `lib/snapshots.ts`.

#### PP-064 — Compare before-and-after hypotheses with pinned experiment branches

[GitHub #19](https://github.com/ManuelR-T/paperplay/issues/19) · P1 · planned · 5–9 focused hours

Ask what changes when one assumption or input changes and keep the original result for comparison.

Let the reader pin a baseline, duplicate the experiment, change an admissible assumption and inspect input/output differences. Keep within-source branches local and distinguish causal intervention in a teaching model from a paper claim.

**Acceptance:**

- [ ] Pinning records the full source/engine versions, data, seed and parameters of an actual run.
- [ ] The UI highlights exactly which inputs changed and recomputes each branch independently.
- [ ] Metric differences require compatible units and completed/partial status labels; changing multiple assumptions remains explicit.
- [ ] Branches can be reset, exported and reopened without model inference or overwriting the pinned baseline.

**Verification:** Compare known graph and numeric interventions, incomplete runs and incompatible metrics; verify branch restoration.

**Evidence policy:** measured differences in declared models, not general causal claims.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-062](https://github.com/ManuelR-T/paperplay/issues/17), [PP-029](backlog.md#pp-029).

**Start in:** `lib/reading-state.ts`, `lib/snapshots.ts`, `components/figures/experiment.tsx`.

#### PP-065 — Plan diverse widgets from concepts, data and actual capabilities

[GitHub #20](https://github.com/ManuelR-T/paperplay/issues/20) · P0 · planned · 9–15 focused hours

An imported paper receives the most useful supported views instead of repeated generic step cards.

Separate concept/coverage planning from widget instantiation. Use catalog capabilities, available source data, section purpose and redundancy checks to select widgets and explain placements. Make the plan inspectable and editable.

**Acceptance:**

- [ ] Each proposed widget identifies a concept, exact anchor, interaction objective, needed data, provenance and why its type is suitable.
- [ ] The planner chooses only exposed catalog controls and does not invent data or force an inappropriate computed engine.
- [ ] A sufficiently supported mixed-concept fixture can receive multiple meaningful widget types; uniform repetition requires an explicit reason.
- [ ] The user can accept, remove, replace or defer proposals; validation failures are per-widget and preserve successful grounded additions.

**Verification:** Evaluate on a frozen corpus spanning at least five families and missing-data cases; record grounding, usefulness, diversity and unsupported-control failures separately.

**Evidence policy:** Meta proposes; application validation and trusted engines own activation and scientific labels.

**Inference policy:** Explicit import only, source-versioned plan cache, per-document request/token ceilings and actual usage reporting; no inference on widget interaction.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-054](https://github.com/ManuelR-T/paperplay/issues/9), [PP-056](https://github.com/ManuelR-T/paperplay/issues/11).

**Start in:** `lib/analysis.ts`, `server/analysis/provider.ts`, `shared/import-types.ts`, `components/figures/generated-figure.tsx`.

#### PP-066 — Repair or replace one widget without reanalyzing the whole paper

[GitHub #21](https://github.com/ManuelR-T/paperplay/issues/21) · P1 · planned · 6–10 focused hours

Fix a poor explanation or unsuitable visual at the point of use while retaining the rest of the paper.

Add targeted feedback, rejected-proposal diagnostics and explicit regenerate/replace actions for one anchored widget. Cache accepted revisions and preserve the last valid version until replacement passes validation.

**Acceptance:**

- [ ] A user can report an irrelevant explanation, wrong mapping or unsupported interaction against a particular widget.
- [ ] A repair submits only the bounded required source context, catalog capabilities and user feedback, with no hidden recursive retries.
- [ ] Source grounding and capability validation run again; rejection retains the previous valid figure and shows the reason.
- [ ] Accepted revisions have visible provenance/version history and allow a local undo.

**Verification:** Use malformed repairs, unchanged duplicates, citation drift and provider failures; verify one repair cannot replace other figures.

**Evidence policy:** new generated interpretation with the same independent execution/citation guards.

**Inference policy:** One explicit paid action per repair attempt, deduplicated and quota-accounted; no automatic paid retry loop.

**Dependencies:** [PP-065](https://github.com/ManuelR-T/paperplay/issues/20).

**Start in:** `server/analysis/handlers.ts`, `lib/analysis.ts`, `components/figures/generated-figure.tsx`, `lib/import-storage.ts`.

#### PP-067 — Edit widget settings with constrained natural-language proposals

[GitHub #22](https://github.com/ManuelR-T/paperplay/issues/22) · P2 · planned · 7–12 focused hours

Say show a simpler input or compare this setting and review a concrete safe change.

Allow Meta to propose a typed catalog patch for the selected widget and current context. Preview changed data, controls and assumptions before applying; arbitrary code/SVG/HTML execution remains excluded.

**Acceptance:**

- [ ] A supported request produces a reviewable structured diff describing every changed field and whether recomputation is required.
- [ ] Only catalog-allowed, bounded settings can change; source text, evidence labels and engine implementations cannot be patched by the model.
- [ ] Unsupported requests explain the missing capability without executing a substitute or silently granting higher fidelity.
- [ ] Applying, rejecting and undoing the proposal are explicit, and the last valid snapshot remains recoverable.

**Verification:** Test malicious code-like requests, field injection, incompatible engine changes, ambiguous requests and rejected diffs.

**Evidence policy:** validated data/configuration proposals only; no generated executable code.

**Inference policy:** Explicit bounded request only; preview/apply/reject do not call Meta again.

**Dependencies:** [PP-066](https://github.com/ManuelR-T/paperplay/issues/21).

**Start in:** `shared/schema.ts`, `server/analysis`, `components/figures/generated-figure.tsx`.

#### PP-068 — Enrich long papers through visible, budgeted section coverage

[GitHub #23](https://github.com/ManuelR-T/paperplay/issues/23) · P1 · planned · 9–15 focused hours

Read and selectively enrich a paper that exceeds one model context instead of being stopped by the current 70,000-character limit.

Keep the full source intact, build a structural map and request enrichment for selected sections with needed neighboring context. Display coverage and costs; reuse a document-wide concept map only when within the declared budget.

**Acceptance:**

- [ ] A source larger than the current limit remains intact and can receive grounded widgets for selected sections.
- [ ] The UI shows analyzed, unanalyzed, failed and unsupported sections; an excerpt is never called complete-paper analysis.
- [ ] Every request has bounded context, explicit section identities and provenance, and shares a per-document request/token reservation budget.
- [ ] Cancellation/reload resumes accepted jobs and coverage state without submitting duplicate paid section requests.

**Verification:** Use the existing 47-page held-out failure, duplicated section labels, cross-section definitions and interrupted multi-section work; preserve original baseline scores.

**Evidence policy:** grounded partial coverage with explicit incompleteness; no silent truncation.

**Inference policy:** Plan and disclose bounded section requests, require explicit selected enrichment, reserve shared quotas and per-document budgets before new work; cache by section/source/catalog version.

**Dependencies:** [PP-065](https://github.com/ManuelR-T/paperplay/issues/20), [PP-066](https://github.com/ManuelR-T/paperplay/issues/21).

**Start in:** `lib/analysis.ts`, `lib/import-controller.ts`, `server/usage`, `shared/import-types.ts`.

#### PP-069 — Evaluate understanding and widget usefulness with real readers

[GitHub #24](https://github.com/ManuelR-T/paperplay/issues/24) · P0 · planned · 6–12 focused hours

Find whether the richer reader helps people explain a mechanism and answer a concrete question.

Run a small consented formative evaluation with 3–5 students/engineers, defined source-only versus augmented tasks, observed confusion and a frozen varied-paper corpus. Treat recruitment and participant time as external uncertainty.

**Acceptance:**

- [ ] Tasks, expected answers, counterbalancing/order limits and success criteria are written before sessions.
- [ ] Reported participant counts and observations correspond to real sessions; self-review is identified separately if recruitment fails.
- [ ] Track wrong interpretations, time to find evidence, interaction usefulness and source-return failures without claiming causal learning gains from a tiny study.
- [ ] Turn observed severe defects into linked issues and retain unsuccessful automatic widget proposals in the scorecard.

**Verification:** Review de-identified task notes and before/after defect dispositions; no fake participant data or automatically sent recruitment messages.

**Evidence policy:** observed formative evidence, not a statistical effectiveness claim.

**Inference policy:** Reuse cached analyses during sessions where possible; any additional paid test run is explicit and measured.

**Dependencies:** [PP-046](https://github.com/ManuelR-T/paperplay/issues/1), [PP-047](https://github.com/ManuelR-T/paperplay/issues/2), [PP-065](https://github.com/ManuelR-T/paperplay/issues/20).

**Start in:** `docs/evaluation-report.md`, `docs/accessibility-report.md`, `docs/demo-corpus.md`.

### M9 — A personal paper workbench

A reader can author, annotate, find and transfer source-linked work without an account or automatic upload.

#### PP-070 — Keep anchored highlights, questions and personal notes

[GitHub #25](https://github.com/ManuelR-T/paperplay/issues/25) · P1 · planned · 5–9 focused hours

Record a doubt or insight and return to its exact source/experiment later.

Add local highlights and notes anchored to source version, selected quote and optional experiment snapshot. Include user-created tags and explicit export/import with permissions distinct from paper content.

**Acceptance:**

- [ ] Create, edit, find and delete notes by keyboard or pointer without changing the original source.
- [ ] Notes keep stable quote/context anchors and an unresolved state when the source version no longer matches.
- [ ] An experiment-linked note restores the compatible input and selection or explains missing/incompatible state.
- [ ] Exports disclose whether source text/PDF is included; no note or local paper is automatically sent to a server.

**Verification:** Test repeated quotes, source-version changes, deletion, bundle round trips and cleared browser storage.

**Evidence policy:** personal annotation, never source-author text.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-048](https://github.com/ManuelR-T/paperplay/issues/3), [PP-030](backlog.md#pp-030).

**Start in:** `lib/import-storage.ts`, `lib/reading-state.ts`, `components/paper-workspace.tsx`.

#### PP-071 — Export a readable paper-and-experiments study pack

[GitHub #26](https://github.com/ManuelR-T/paperplay/issues/26) · P1 · planned · 6–10 focused hours

Share or print a coherent explanation with actual figure states and all relevant source attribution.

Add a clean print/export view and self-contained bounded study pack containing permitted selected source passages, static figure captures, exact input/parameters, evidence labels and links to reopen experiments.

**Acceptance:**

- [ ] The export preview makes source inclusion, notes, original PDF inclusion and author rights explicit.
- [ ] Static captures retain visible values, assumptions, current step versus final totals, source references and scientific labels.
- [ ] Print output avoids clipped equations/figures and tiny control labels, and provides a text equivalent of visual-only states.
- [ ] No signing/session/deletion/provider capability or runtime secret appears in the pack; interactive reopening validates compatibility.

**Verification:** Inspect a real multi-family export in print and another clean browser; scan the exported payload for private capabilities and compare numerical values.

**Evidence policy:** captured actual or explicitly illustrative states, not fresh invented results.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-047](https://github.com/ManuelR-T/paperplay/issues/2), [PP-070](https://github.com/ManuelR-T/paperplay/issues/25), [PP-030](backlog.md#pp-030).

**Start in:** `components/experiment-actions.tsx`, `lib/snapshots.ts`, `app/globals.css`.

#### PP-072 — Search the local library by passage, concept and annotation

[GitHub #27](https://github.com/ManuelR-T/paperplay/issues/27) · P1 · planned · 5–9 focused hours

Find a definition or remembered experiment across imported papers without uploading the library.

Create a bounded worker-backed full-text index over locally stored source, user tags and notes, with source-aware results and graceful missing/deleted-source handling. Start without embeddings or cloud discovery.

**Acceptance:**

- [ ] Search returns matching source passages, paper titles, definitions and notes with readable snippets and source-version IDs.
- [ ] Opening a result restores the exact anchor and does not start inference.
- [ ] Import/removal/version changes update the local index and deletion removes corresponding indexed text.
- [ ] Indexing is cancellable and resource-bounded; large or unavailable storage produces an actionable state without blocking reading.

**Verification:** Test repeated terms across sources, Unicode/math text, deletion, storage failures and a large saved library.

**Evidence policy:** local indexed source/user text, not generated external search results.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-049](https://github.com/ManuelR-T/paperplay/issues/4), [PP-070](https://github.com/ManuelR-T/paperplay/issues/25).

**Start in:** `lib/import-storage.ts`, `lib/execution`, `components/paper-workspace.tsx`.

#### PP-073 — Let readers author source-linked widgets without writing code

[GitHub #28](https://github.com/ManuelR-T/paperplay/issues/28) · P1 · planned · 8–14 focused hours

Turn a useful static passage into a configured interactive figure even when automatic enrichment chooses badly.

Build a catalog-driven composer: select a source anchor, choose an admissible widget, supply explicit teaching data/controls and preview validated output. Keep authored additions and source claims distinct.

**Acceptance:**

- [ ] A reader can create and edit a diagram and a computed widget from the catalog without editing source code.
- [ ] The preview exposes missing inputs, invalid domains, unsupported engines and exact available interactions before saving.
- [ ] Authorship, source anchor, data origin and evidence class stay visible and portable.
- [ ] The same validators protect authored, generated and imported figures; the composer cannot grant verification labels or execute arbitrary code.

**Verification:** Follow the workflow in a clean browser, round-trip the authored additions and reject malformed source/data/binding cases.

**Evidence policy:** user-authored figures; computed status only through trusted bindings.

**Inference policy:** Manual authoring is provider-free; a separate optional Meta suggestion action is explicit and budgeted.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-066](https://github.com/ManuelR-T/paperplay/issues/21).

**Start in:** `shared/schema.ts`, `components/figures/generated-figure.tsx`, `lib/snapshots.ts`, `lib/import-storage.ts`.

#### PP-074 — Reconstruct paragraphs, headings and equations with inspectable provenance

[GitHub #29](https://github.com/ManuelR-T/paperplay/issues/29) · P1 · planned · 8–14 focused hours

Make an imported scientific paper pleasant to read while retaining a route to every uncertain original fragment.

Extend source-v2 beyond column order: conservative paragraph joining, line-break/dehyphenation rules, heading detection and equation/caption regions. Preserve raw fragments, confidence and mappings; mathematical transcription requires review.

**Acceptance:**

- [ ] A fixed diverse PDF corpus shows measured improvements in paragraph continuity and section navigation against reviewed references.
- [ ] Raw extracted text and original coordinates remain available; uncertain joins/structure are disclosed instead of silently overwritten.
- [ ] Equation images/regions remain accessible when semantic math cannot be recovered; generated TeX is not treated as original text without review.
- [ ] Normalizer version changes invalidate incompatible caches explicitly and do not alter saved older source records in place.

**Verification:** Compare physical pages with normalized output for multi-column layouts, ligatures, hyphenated words, equation-heavy pages and captions; retain regressions and unsupported scans.

**Evidence policy:** source reconstruction with provenance and disclosed uncertainty; OCR stays outside this tranche.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-052](https://github.com/ManuelR-T/paperplay/issues/7), [PP-043](backlog.md#pp-043).

**Start in:** `lib/import/normalize.ts`, `lib/import/pdf-core.ts`, `shared/schema.ts`, `docs/pdf-reconstruction.md`.

### M10 — Compatibility and release quality

Old experiments survive supported upgrades and actual hosted behavior has release evidence.

#### PP-075 — Version the richer widget catalog and preserve existing experiments

[GitHub #30](https://github.com/ManuelR-T/paperplay/issues/30) · P0 · planned · 5–9 focused hours

Upgrade without losing saved papers, old graphs or the work produced by the first release.

Define additive versus breaking catalog/source/snapshot changes, explicit migration boundaries, compatibility diagnostics and local rollback/backup for schema upgrades. Use versioned prepared fixtures rather than silent assumptions.

**Acceptance:**

- [ ] All release-1.1.0 prepared graph/array/steps/matrix snapshots have explicit open/reject/migrate outcomes.
- [ ] Unknown widgets and future versions leave source reading and export recovery available.
- [ ] Migrations preserve source identity, provenance, scientific labels and actual numerical results or disclose why recomputation is needed.
- [ ] Failed migrations retain the original stored record and do not trigger model analysis.

**Verification:** Run a frozen cross-version fixture suite, interrupted migration/reload and corrupt/unsupported bundle cases.

**Evidence policy:** compatibility preservation, never automatic fidelity promotion.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-053](https://github.com/ManuelR-T/paperplay/issues/8), [PP-030](backlog.md#pp-030).

**Start in:** `shared/schema.ts`, `lib/snapshots.ts`, `lib/import-storage.ts`, `lib/reading-state.ts`.

#### PP-076 — Verify the complete hosted workflow and release handoff

[GitHub #31](https://github.com/ManuelR-T/paperplay/issues/31) · P0 · planned · 5–9 focused hours

Trust that the richer reader, background jobs and sharing behave on the actual private hosted runtime.

Extend hosted release checks to source/worker assets, questions, accepted-job resume/cancel, disabled inference, shared quotas, snapshot deletion and authorized access. Use deterministic provider stubs for routine CI and bounded real checks separately.

**Acceptance:**

- [ ] A documented hosted smoke covers start/retrieve/cancel/question ownership and one reload recovery without duplicated creation.
- [ ] Routine CI uses provider stubs and no secrets; an explicit authorized real-provider check reports actual requests/tokens separately.
- [ ] Private audience checks, D1 failure behavior, expiry and deletion are tested on the intended origin without weakening access controls.
- [ ] Release notes identify exact source commit, artifact, environment revision and remaining manual submission constraints.

**Verification:** Run the hosted suite on a staging/test context and the minimal authorized production checks; retain redacted evidence and fail the release gate on unresolved regressions.

**Evidence policy:** actual runtime evidence, distinct from local fixtures and provider stubs.

**Inference policy:** No paid calls in CI; real smoke requires explicit operator action, bounded request counts and shared quota enforcement.

**Dependencies:** [PP-075](https://github.com/ManuelR-T/paperplay/issues/30), [PP-036](backlog.md#pp-036).

**Start in:** `scripts/verify-hosted.ts`, `tests/hosted-worker.test.ts`, `.github/workflows/checks.yml`, `docs/acceptance-matrix.md`.

#### PP-077 — Keep rich papers responsive and accessible as widgets grow

[GitHub #32](https://github.com/ManuelR-T/paperplay/issues/32) · P1 · planned · 6–10 focused hours

Scroll, select text and open a figure smoothly in a long augmented paper.

Measure cold reading, deferred figure mounting, worker transfer and rendering costs on declared fixtures/devices. Lazy-mount heavy visuals with stable placeholders, preserve anchors/search and add focused visual/a11y regression coverage.

**Acceptance:**

- [ ] A frozen long-paper fixture reports main-thread responsiveness, worker transfer size and layout shifts before/after optimization.
- [ ] Offscreen heavy widgets defer expensive work without losing source text, keyboard reachability or find-in-page behavior.
- [ ] Opening a deferred figure and restoring its snapshot does not jump the reading position or reuse stale data.
- [ ] Reduced motion, 320 px layouts, 200% zoom and core keyboard paths pass for each new widget family; no universal 60fps claim is made.

**Verification:** Profile actual browser runs with recorded hardware/viewport conditions and a declared regression budget; review representative screenshots and accessible equivalents.

**Evidence policy:** measured app responsiveness; no comparison to paper hardware timings.

**Inference policy:** No inference for reading, interaction, parameter edits or playback.

**Dependencies:** [PP-047](https://github.com/ManuelR-T/paperplay/issues/2), [PP-062](https://github.com/ManuelR-T/paperplay/issues/17), [PP-075](https://github.com/ManuelR-T/paperplay/issues/30).

**Start in:** `components/figures`, `components/reading-session.tsx`, `lib/execution`, `docs/performance-worker.md`.

## Design references and limits

- [W3C WCAG 2.2 — Text Spacing (AA)](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html): Check that reader content survives user spacing overrides; this does not prescribe the application default.
- [W3C — Visual Presentation (AAA)](https://www.w3.org/WAI/WCAG21/Understanding/visual-presentation.html): Use adjustable measure and presentation as design guidance; do not label the current app AAA conformant.
- [Bret Victor — Explorable Explanations](https://worrydream.com/ExplorableExplanations/): Prefer interventions in explicit models and low-friction context beside the text; this is a design direction, not a measured learning result.
- [Olah and Carter — Research Debt](https://distill.pub/2017/research-debt/): Treat explanation quality and notation as substantive product work, with real-reader validation.

The W3C AA spacing criterion concerns preserving content/function when users override spacing; it does not require the proposed default typography. Visual Presentation is AAA guidance, not a certification of this app. Explorable explanations and research distillation motivate the product direction; they do not establish learning benefits for Paperplay. No source text from these references is bundled or quoted in this roadmap.

Machine-readable source: [next-backlog.json](next-backlog.json). Interactive view: [next-roadmap.html](next-roadmap.html). GitHub issue numbers and local PP planning IDs are distinct and mapped explicitly.
