# Paperplay — acceptance and release evidence

Release evidence checked 27 October 2026. The final local check passed strict TypeScript, 134 tests and a production build. The Sites application is actually deployed with D1 and verified real Meta inference, under private authentication. The user explicitly chose to retain private access. Judge invitations/access checks and authenticated portal/media acceptance remain external handoff gates. See [M4 evidence](m4-report.md). No participant study occurred.

## Agreed product acceptance criteria

The numbered criteria come from [the product specification](product-spec.md#acceptance-criteria).

| # | Criterion | Concrete evidence | Current disposition |
| --- | --- | --- | --- |
| 1 | Open an example and manipulate an inline figure without setup | Prepared attributed sources in `data/papers.ts` and `data/numeric-paper.ts`; generic reader/renderers; [M1 evidence](m1-report.md), provider-free reader/worker tests | Verified in local production and prepared browser checks; hosted frontend/worker HTTP 200 recorded |
| 2 | A parameter change produces a deterministic computational change; reset restores it | Independent graph/sorting/numeric tests; [M3 actual weight/seed restoration](m3-report.md); [numeric recurrence checks](engine-extension.md#verification-evidence) | Deterministic engine/reference checks pass; current production numeric browser check and graph/reset evidence retained |
| 3 | Different families reuse contracts; unsupported methods receive honest fallbacks | Graph, sorting and SPD optimization share source/figure/engine contracts; [held-out results and limitations](evaluation-report.md), numeric and contract tests | Three families implemented. Held-out conceptual results verified; no unseen computed Dijkstra success claimed |
| 4 | Every addition has a usable source anchor and remains distinct from original text | `validateDocument`, `validateFigure`, `validateAnalysisResult`; exact quote/page checks; [held-out wrong-block rejection](evaluation-report.md#recorded-findings-and-disposition) | Anchoring guards verified; hosted live import preserves source blocks and accepts three cited conceptual figures. General prompt/control-promise guards, cached-result validation and an available-interaction disclosure address the finding; baseline scores remain unchanged and prose correctness is still bounded |
| 5 | Scientific labels are backed by defined checks; synthetic/illustrative states are explicit | Registry-owned fidelity policy; [engine scope](engines.md), [restricted original Java replay](reproduction-audit.md), numeric metadata | Browser labels remain bounded. Original hardware runtime study and universal automatic reproduction are not claimed |
| 6 | Real PDF/arXiv import passes extraction, Meta analysis and validation with recoverable failures | [M2 real PDF and arXiv checks](m2-report.md); bounded import/controller tests; [new layout evidence](pdf-reconstruction.md) | Verified: [hosted live smoke](hosted-live-smoke.json), 18-page `source-v2` PDF, 229 blocks, three conceptual figures, one paid creation |
| 7 | Reload resumes the accepted model response rather than creating another paid job | [M2 live reload](m2-report.md), durable checkpoint/controller tests; signed capability and persistent reservation tests | Verified local lifecycle behavior; hosted resume/cancel still requires deployment smoke |
| 8 | A small shared snapshot restores compatible input/seed/parameters/engine in another browser | [M3 separate-profile URL and file checks](m3-report.md); snapshot tests, strict prepared source/family checks | Local URL/file restoration verified; [hosted short-link create/resolve/delete](hosted-quota-smoke.json) verified. Numeric narrow-screen controls verified; snapshot compatibility covered by tests |
| 9 | A contextual question uses selected source/current state with traceable references | [Two real Meta questions](m3-report.md), server recomputation/citation tests, stale-context checks | Historical local proof and current unit evidence. Hosted provider question smoke pending |
| 10 | Core demo works locally and hosted, with prepared fallback and English narrative | [English script](demo-script.md), [submission draft](submission-draft.md), local build/start, disabled-inference tests | Local and private hosted production verified. Actual captioned English video and five screenshots exist; access remains private by explicit user choice. Judge invitations and portal acceptance remain handoff items |

## Earlier milestone coverage

| Milestone / issue IDs | Delivered boundary | Evidence retained for release review |
| --- | --- | --- |
| M0, PP-001–005 | Source/rights corpus, Next/shadcn setup, versioned contracts, official Meta capability checks and CI | [M0 report](m0-report.md), corpus/contract/configuration tests, workflow and licensed source attribution |
| M1, PP-006–008 | Prepared original passages, equations and source-linked inline reading | [M1 report](m1-report.md), prepared source/reading tests and complete licensed originals |
| M1, PP-009–017 | Shared engine API, graph/sorting calculations and renderers, playback/comparison/fidelity policy | [Engine scope](engines.md), independent engine/fidelity tests, M1 browser observations; [current browser worker measurement](browser-worker-profile.json) |
| M2, PP-018–021 | PDF/arXiv source adapters, stable normalization, IndexedDB originals and checkpoints | [M2 report](m2-report.md), import/storage tests; normalization-version change is separately documented in M5 |
| M2, PP-022–026 | Official Meta schema/figure planning, exact grounding validation, accepted-job recovery, import UI | M2 real provider and reload observations; analysis/controller tests; expanded schema passes hosted live smoke |
| M3, PP-027–030 | Contextual questions, reading state, public URLs, explicit file transfer | [M3 report](m3-report.md), question/snapshot tests and actual separate-profile transfer; new numeric forms require release compatibility check |
| M3, PP-031–032 | Anonymous ownership, shared durable usage and operator reporting | M3 multi-process/local production denial checks, usage/handler tests and aggregate CLI; [actual D1 denial and link lifecycle](hosted-quota-smoke.json) verified |

## Remaining milestone gates

| Issue | Deliverable / evidence | Disposition to verify before closing release |
| --- | --- | --- |
| PP-033 | Keyboard, focus, responsive layouts, reduced motion, textual trace equivalents | [Actual accessibility checks](accessibility-report.md): skip link/focus, numeric Enter/Tab, dialog Escape; 320 px numeric matrix/plot without overflow. API-simulated reduced motion disables Play while preserving stepping. Axe steady UI/modal: zero violations (34/23 passing checks); not a full certification. |
| PP-034 | Frozen held-out source/model evaluation | [Baseline report](evaluation-m4-baseline.json) and [self-review](evaluation-report.md) complete. Preserve rejected/partial cases and record disposition of absent-control claims. No student study occurred. |
| PP-035 | Open-source documentation and rights | `LICENSE` agrees with ISC manifest; paper attribution and [dependency notices](dependency-notices.md); [contributor guide](../CONTRIBUTING.md), [extension guide](engine-extension.md), [security notes](../SECURITY.md). [Frozen clean-install proof](clean-install-report.md): 133 tests, production build and credential-free numeric run. Final current-root check: 134 tests and build. |
| PP-036 | Hosted and local production demonstration | Actually deployed at the private [Sites URL](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site). [Quota/API/assets/link smoke](hosted-quota-smoke.json) and [one real Meta import](hosted-live-smoke.json) pass. Private access is the explicit user choice. Any judge must receive and verify an authorized invitation; public access is not a release requirement. |
| PP-037 | English script, screenshots and video | Implemented, awaiting external acceptance: [actual 70-second captioned video](../artifacts/paperplay-demo.mp4), [English SRT](../artifacts/paperplay-demo.srt), five screenshots and script exist. Silent localhost-production capture reuses genuine saved Meta output without a new request. Authenticated portal/media constraints remain unverified; no submission occurred. |
| PP-038 | Complete agreed-MVP acceptance and release compatibility | Release candidate implemented, awaiting external acceptance: product/build/local/private-hosted evidence is recorded. PP-037 portal acceptance and authorized judge invitations remain external gates. Do not label this full submission acceptance. |
| PP-039 | Original-experiment reproduction audit | [Restricted merge-cost replay](reproduction-audit.md) completed with actual author-code measurements; complete original hardware timings not reproduced. Keep browser evidence labels unchanged. |
| PP-040 | Matrix and convergence plot renderers | [Extension/real source](engine-extension.md), matrix/numeric contracts, exact-value alternatives and numeric tests. Current numeric matrix/plot production and 320 px browser checks pass; compatibility/reference tests pass. Keyboard stepping and exact-value alternatives verified in [accessibility QA](accessibility-report.md). |
| PP-041 | Third execution family through extension interface | SPD quadratic gradient descent and heavy-ball momentum, independent reference cases, real Distill source fixture, registry/preset seam. [Contributor walkthrough](../CONTRIBUTING.md) and current numeric production browser smoke complete; no independent external contributor trial claimed. |
| PP-042 | Worker execution with interruption and stale-result guards | [Measured benchmark and limits](performance-worker.md), actual worker/direct equivalence tests. [Actual browser measurement](browser-worker-profile.json): median timer delay 18.9 ms direct versus 1.0 ms worker; semantics equal. Cancellation/staleness race tests pass. No 60fps guarantee. |
| PP-043 | Improved difficult-PDF reconstruction | [Fixed-corpus before/after observations](pdf-reconstruction.md), [numeric results](pdf-layout-results.json). `source-v2` changes identity; no stale `source-v1` analysis silently reused. OCR remains excluded. |
| PP-044 | Optional durable short links | Public-only snapshot canonicalization, seven-day expiry, deletion capability and quota store implementation. [Design](short-links.md), expiry/deletion tests and [real D1 create/resolve/delete](hosted-quota-smoke.json) complete; deletion returned 410 afterward. No automatic private-paper upload allowed. |
| PP-045 | Operation after credits | `META_ANALYSIS_ENABLED` and explicit configured cutoff, prepared/saved fallback, shared quota policy. [Operational runbook](operations.md), strict configuration and handler tests verify disabled/expired creation while accepted-job recovery remains available; credential-free prepared production run verified. No claim to know provider credit balance. |

## Compatibility record

Record the final package/release identifier in the release report. Current source/figure contracts use version1 with additive variants; old applications must reject unknown variants instead of changing their meaning. Engine versions are checked through the trusted registry. PDF/HTML normalization now uses `source-v2`; the held-out baseline deliberately records its earlier `source-v1` source identities. Model plans and stored validated analysis results are different contracts; an old generated-plan fixture is not automatically valid under an expanded model schema.

Portable snapshots validate source identity, source version, engine version, bounded data and the registered prepared family. Imported bundles are data, not author signatures or proof of redistribution permission. Job/session/deletion credentials must not be transferred in experiment bundles.

## Evidence that must remain explicitly limited

- No observed student/engineer participant study or measured learning benefit.
- No full-paper Theta* enrichment success in the frozen baseline; the full 47-page PDF exceeded context and its three-page diagnostic is separate.
- No automatic computed Dijkstra example succeeded in that held-out run; one relevant conceptual figure did.
- No original Java hardware runtime reproduction or general convergence/acceleration proof.
- Hosted shared-store and one real provider run are verified; this is not a concurrent load test, a hosted contextual-question run or hosted cancel/resume proof.
- No verified authenticated submission-form media limits and no submitted project.

Final release checks should rerun only affected checks after a fix, retain the frozen evaluation outcomes, and link actual evidence rather than turn this checklist into an invented pass report.
