# M5 — Extensions delivered in version 1.1.0

Implemented and checked on 27 October 2026: PP-040–PP-045. The requested optional extensions were selected explicitly by the instruction to continue through M5. Existing local reading, source provenance and scientific-fidelity boundaries remain in force.

| Issue | Delivered result | Evidence |
| --- | --- | --- |
| PP-040 | Source-linked matrix heatmap and computed residual-convergence plot, with exact numeric alternatives, snapshots and bounded controls | `components/figures/numeric-view.tsx`, `shared/schema.ts`, [extension guide](engine-extension.md), `tests/numeric.test.ts` |
| PP-041 | Third family: gradient descent and heavy-ball momentum on small SPD quadratics, exposed through the registry and shared reader contracts | `lib/engines/numeric.ts`, `data/numeric-paper.ts`, independent numerical references |
| PP-042 | Versioned browser-worker execution, cancellation, stale-result protection, direct/worker equivalence and actual responsiveness measurements | [worker report](performance-worker.md), [browser timings](browser-worker-profile.json), worker tests |
| PP-043 | Conservative two-column PDF repair, caption references and an explicit normalization identity change | [reconstruction report](pdf-reconstruction.md), [fixed-corpus results](pdf-layout-results.json) |
| PP-044 | Opt-in seven-day public prepared-snapshot links, deletion capabilities and atomic creation quotas; SQLite/D1 implementations | [short-link design](short-links.md), `tests/short-links.test.ts`, [actual hosted lifecycle](hosted-quota-smoke.json) |
| PP-045 | Operator disable/cutoff for new inference, retained local/saved experience and existing-job recovery, with hosting/storage runbooks | [operations](operations.md), [deployment](deployment.md), provider-free mode tests |

## Numeric source and computational evidence

The third source is Gabriel Goh's [Why Momentum Really Works](https://distill.pub/2017/momentum/), Distill (2017), DOI 10.23915/distill.00006. The publisher licenses original text/diagrams CC BY 2.0, with separately reused figures excluded. The prepared fixture contains selected original equations/headings and a short original sentence. Its source reference is a logical HTML location; no PDF or original visualization is copied.

The `gradient-descent@1.0.0` and `heavy-ball@1.0.0` engines implement the stated quadratic recurrences. They accept matrices up to 8×8, matching vectors, at most 200 iterations and declared stable-setting restrictions. Cholesky checks reject nonsymmetric, indefinite, singular or numerically near-singular inputs. Independent tests compare every gradient-descent iterate with a diagonal closed form, both methods with an exact non-diagonal linear-system solution, heavy-ball with its recurrence, and beta zero with gradient descent. These are mechanism checks, not the paper's full experiments or a new convergence proof.

The heatmap exposes exact signed cell values by keyboard and pointer. The plot contains actual observed residual samples and a numeric table; zero is shown at a declared logarithmic display floor. Labels distinguish the displayed iterate from complete finite-run totals. Completing the configured iteration count does not necessarily mean the residual tolerance was reached. Prepared and restored figures use the same input/parameter/version checks and worker execution as the older families.

The reader dispatches by generic input/figure kinds; algorithm implementations and declared capabilities live in the trusted registry. Graph/sorting sources remain available. An unsupported or invalid Meta numerical proposal becomes a conceptual explanation or explicit error rather than fabricated convergence data. Source-reported experiments are not synthesized from missing PDF content.

## Worker and extraction measurements

The actual collaborative Chromium browser compared a deterministic 256-value natural-mergesort task directly and in the compiled worker. The median delay of a pending timer was 18.9 ms directly and 1.0 ms with worker execution; semantic results matched. A full React-view run also completed, while rendering/transfer still caused a 58.6 ms maximum heartbeat gap in that check. The worker is not claimed to guarantee 60fps or improve total elapsed time on every task. The [worker report](performance-worker.md) separates browser observations from the Node benchmark's worker-startup costs.

The fixed synthetic two-column fixture improved from 66 reading-order inversions to zero while retaining all non-whitespace source characters. On the pinned ResNet PDF, 12 of 12 pages received confident repair and retained all such characters. Attention and the bundled priority-search-tree paper retained their previous extraction text; captions became explicit original-figure references. These are geometry/character-retention observations, not a semantic equation/figure-completeness score. No OCR or general reconstruction guarantee was added.

`source-v2` participates in source hashes. Newly imported sources do not silently reuse analyses generated under the old normalizer. Already saved old sources remain readable in their own version.

## Durable sharing and operation

A seven-day link stores only a canonical public prepared snapshot after an explicit user action. It does not accept private source text, PDFs or provider jobs. Public access uses a random identifier; deletion needs a separate 256-bit capability, stored hashed server-side and privately in this browser. Deletion clears active content while retaining a small quota tombstone until expiry. Full URL snapshots and source-inclusive local bundles remain independent alternatives.

Both local SQLite and hosted D1 creation checks are atomic. Tests cover concurrent quota exhaustion, incorrect capabilities, expiry, incompatible sources, and the create/delete quota-reset attack. The actual hosted D1 smoke returned create 201, resolve 302, delete 200 and after-delete 410. Quota-exhausted analysis and question routes returned 429 before any new paid work. This is deployed endpoint evidence, not merely disabled UI buttons.

`META_ANALYSIS_ENABLED=false` or an explicit operator cutoff prevents new paid creation. Accepted jobs can still be retrieved/cancelled while their provider/signing configuration remains available. Prepared papers, browser simulations, source reading and previously saved results do not need new inference credit. The flags do not discover the account's true credit balance or enforce a financial billing cap. No alternative inference provider was silently substituted for Meta.

## Release and remaining limits

The integrated check passed strict TypeScript, **134 provider-free tests** and the optimized Next production build. An isolated clean-source proof recorded its earlier 133-test snapshot and a no-key prepared numeric-browser run; the differing counts reflect a later regression fix, not a rewritten historical report. The standalone Docker artifact was also built and run locally on port 3007 without Meta configuration; HTML, health, PDF-worker and engine-worker requests returned HTTP 200. The container was stopped after verification.

The hosted Site, kept owner-private by the owner’s explicit choice, at [paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site) uses the shared D1 adapter, not the Node Redis path. Its real Meta import preserved the 18-page source and produced three cited conceptual figures using 22,042 reported tokens. A separate local browser import used 21,849 tokens and produced two figures. These remain conceptual successes where computed proposals failed; they do not establish reliable automatic executable-figure selection.

The frozen held-out baseline and later local/hosted smoke checks used five actual paid creations in this M4/M5 work, totaling **79,494 reported tokens**. This is not lifetime project consumption or a dollar estimate. Hosted publication does not establish anonymous judge access, portal acceptance or sufficient account limits for arbitrary traffic. The 70.052-second [English subtitled UI demo](../artifacts/paperplay-demo.mp4) is packaged, but portal-authenticated submission constraints remain a manual handoff, no human learning study occurred, and the complete original hardware runtime experiment was not reproduced. See [release notes](release-v1.1.0.md), [evaluation](evaluation-report.md) and [reproduction audit](reproduction-audit.md).
