# Version-2 source-linked widget catalog

This adds nine visual/interaction forms through a separate `paperplay-widget` envelope with `schemaVersion: 2`. The existing version-1 source, graph/sorting/numerical figure, trace and snapshot contracts remain in place. Unknown future widget types are rejected; source reading and recovery/export remain available. No destructive in-place migration or automatic model request is performed.

## Interface

- `shared/widgets.ts`: `WidgetSpec`, `WidgetKind`, `WidgetEnvelope`, `widgetSpecSchema`, `widgetEnvelopeSchema`, `validateWidgetSpec` and `validateWidgetEnvelope(value, source)`.
- `lib/widgets/catalog.ts`: the catalog version, descriptors and actual controls. Legacy descriptor kinds are derived from the old figure schema; new kinds derive from the widget schema. The planner consumes this catalog rather than maintaining another widget-name enumeration. Fixed source-concept hint patterns support coarse relevance checks; they are not evidence that a paper implements a particular method.
- `lib/widgets/presets.ts`: authored examples and exact source anchors. `createWidgetPreset(kind)` returns only teaching data; `createWidgetForSource(kind, source, blockId?)` binds it to an existing source passage without claiming that arbitrary source supports the model.
- `lib/widgets/compute.ts`: pure `computeWidget(spec, seed)` and typed numerical/illustrative results. The browser uses `executeWidget` from `worker-client.ts`; there is no UI-thread computation fallback.
- `components/widgets/widget-view.tsx`: `WidgetView({ envelope, source, onChange?, compact? })`. The owning reading workspace persists changes; standalone gallery state can be exported explicitly. Selection/step updates use the same callback and emit a source/version/widget/revision event.

An envelope records source document/version, block, page, exact quote, optional canonical citation, widget authorship, declared configuration, seed and view state. Citation metadata, when supplied, must match the document. The quote must occur in the referenced block. A matching citation establishes location, not the scientific truth of every explanation. Authorship metadata is not a cryptographic signature.

## Forms and actual controls

| Kind | Interaction | Computed or conceptual scope |
| --- | --- | --- |
| `equation` | Defined variable edits, substitution table, exact result and units | Bounded arithmetic AST; no expression JavaScript |
| `function` | Parameter edits, pointer/keyboard probe, optional numerical derivative, full sample table | Computed samples; connecting lines interpolate; conservative interval checks split invalid-domain segments |
| `diagram` | Concept selection, conceptual steps/seek and zoom | Authored relationships, never algorithm execution |
| `table` | Stable row selection, filtering, numeric/text sorting, CSV export | Explicitly declared source/computed/illustrative origin; declaration alone is not independent verification |
| `linear` | 2×2 matrix/vector edits, pointer-selected vector, transformed basis/region and exact values | Real 2D map; singular/unsupported eigencases are explicit |
| `probability` | Distribution/parameter/observation edits, sample count and seed | Analytic mass/density, reproducible samples, disclosed approximate posterior interval |
| `attention` | Q/K/V edits, per-cell masks, temperature, query/step selection | Small scaled dot-product mechanism, not a trained Transformer |
| `graph` | Add/remove/move nodes, edit edge endpoints/weights, start/target, obstacle grid, actual search steps | Nonnegative Dijkstra distances; graph layout is presentation |
| `signal` | Editable 1D/2D input/kernel, boundary/stride/normalization, local products and output values | Centered reversed-kernel convolution; optional unnormalized DFT magnitude of a 1D output |

All forms expose validated state export/import and reset. Widget URLs carry settings, data and a source quotation, never a full local PDF. Their UI discloses that content before sharing. The recipient must have the exact source version. The main workspace handles source restoration and local persistence; this module does not create accounts or automatically upload documents.

## Numerical limits and meaning

The expression tree accepts at most 128 structural terms and depth 12, with bounded arithmetic evaluation. Variable definitions, domains and units are explicit. Addition requires matching dimensions; elementary transcendental functions require dimensionless arguments; undefined/nonfinite/overlarge results fail. Dot products have matched dimensions. Interval arithmetic is conservative and can omit a connecting segment even when a particular point is finite. The finite sample table remains available; this is not symbolic proof of a complete function domain.

Plots use 16–257 samples. Matrices for attention have at most eight rows/features. Graphs have at most 36 nodes/100 edges; grids are at most 6×6. Signals are at most 16×16 and kernels at most 5×5. Inputs above 128 KiB, worker results above 2 MiB or runs beyond the bounded wall time fail explicitly. Cancellation terminates the worker. Request identity and current configuration identity prevent an obsolete result from replacing changed settings.

Probability sampling uses recorded `xorshift32-boxmuller-gamma-v1`, with a 32-bit seed. Bernoulli/binomial mass, normal density and beta posterior density are distinct. The beta–Bernoulli posterior adds observed successes/failures to the prior parameters. A separate relative likelihood uses the ordered Bernoulli observation likelihood divided by its maximum, computed in log space; it is not a unit-area density. Prior, posterior and relative likelihood have an accessible analytic-value table. The displayed 95% interval is an approximate seeded posterior-sample quantile range, not an exact quantile or a confidence interval for an unrelated estimator. Samples are capped at 512; the gamma rejection loop is bounded.

Linear geometry reports determinant, singular values and conditioning. A singular map has no displayed finite inverse/condition number. Eigenvalues are shown only for symmetric 2×2 matrices. Attention subtracts the row maximum before softmax, rejects all-masked rows, and computes actual weighted values. Convolution states expose local products, boundary convention and stride. Its optional DFT uses unit sample spacing, no normalization and bin indices; physical frequencies are not inferred.

## Verification retained

`tests/widgets.test.ts` contains 16 focused checks, including:

- Independent scalar arithmetic/dimensions and hand-computed vector dot products; executable-shape, undefined-symbol, invalid-domain and deep-AST rejection.
- Function probes and a shifted denominator pole between samples.
- Known rotation/projection/singular maps and their exact basis/vector values.
- Binomial normalization/moments, beta uniform and `6x(1−x)` closed forms, concentrated posterior counts and deterministic endpoint/sampling cases.
- Independently computed two-key softmax weights, exact masking and all-masked rejection.
- Bellman–Ford reference distances, obstacle-grid distances and explicit unreachable states.
- Reversed-kernel convolution values under zero/wrap/reflect boundaries, identity 2D kernels and hand-checkable DFT DC/zero-frequency-bin cases.
- Exact version-2 state round trips, source/citation/version rejection, frozen version-1 graph/sorting/numeric fixtures and original-record retention.
- Actual bundled worker equivalence for all nine forms, plus actual client cancellation/timeout and replacement input handling using a worker-thread browser adapter.

Native Chromium checks on the integrated local development reader changed query Q[1,1] from 1 to 2 and observed attention weight 0.6697615 become 0.8044297. Changing beta–Bernoulli successes from 6 to 12 produced Beta(14,4) and analytic mean 0.7777778. Switching to a 5×5 grid and blocking cell 1 produced an actual eight-edge route and 24 settled nodes. No model call was made for these edits. Additional final production/keyboard/narrow-layout checks belong to the integrated release evidence, not a claim made by these development observations.

The browser checks found and fixed a prop-identity reset that could undo uncontrolled gallery edits; incoming synchronization now depends on serialized incoming state. Workspace persistence remains owned by the parent. Standalone references do not silently overwrite saved source records.

## Source and mathematical references

Prepared quadratic examples refer to [Gabriel Goh, Why Momentum Really Works](https://distill.pub/2017/momentum/), whose separately licensed source selection already exists in the project. The added equation is explicitly a one-dimensional teaching restriction of the original quadratic, not a replacement for its general-vector argument or experiments.

Attention follows the scaled dot-product equation in [Vaswani et al., Section 3.2.1](https://arxiv.org/html/1706.03762v7). The probability note links to [Russo et al., A Tutorial on Thompson Sampling](https://arxiv.org/abs/1707.02038); the beta normalization uses the mathematical definition documented by [NIST DLMF §8.17](https://dlmf.nist.gov/8.17). The convolution note links to [Dumoulin and Visin, A guide to convolution arithmetic for deep learning](https://arxiv.org/abs/1603.07285), while explicitly stating its kernel/origin convention rather than assuming every deep-learning library uses mathematical convolution.

`data/widget-sources.ts` contains independently authored short teaching notes, mathematical formulas and bibliographic links. It does not bundle original prose, paper figures or full PDFs, and does not infer a redistribution license from an arXiv URL. Synthetic data and app explanations are marked as additions. None of these checks promotes a figure to reproduction of an original paper experiment.

## Narrow-screen follow-up

An actual 320 px Chromium review found that native `fieldset` min-content sizing expanded the signal input editor to 692 px and the document to 761 px. The fix gives matrix fieldsets a zero minimum inline size and bounded flex width, retaining local horizontal scrolling for the raw cells. Numeric result regions also keep local scrolling and keyboard focus. No global overflow clipping was added.

Afterward all nine widget kinds measured exactly 320 px document width at a 320 px viewport, with no widget errors. The eighth input cell remained focusable/editable (changed to 3); its fieldset scrolled locally while document scroll-left stayed zero. A 2D signal output likewise remained in its own keyboard-focusable numeric region. See [widget-mobile-qa.json](widget-mobile-qa.json). This is a targeted browser observation, not full mobile/accessibility certification.
