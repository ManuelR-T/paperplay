# Paperplay 1.1.0 — release handoff

27 October 2026. This source version includes the implemented reading/import features and selected M5 extensions. The handoff records implemented behavior, verification and remaining external limits; it is not a claim that a GitHub release or hackathon submission was published.

## What a reader can do

Read three attributed prepared research sources and run trusted graph, sorting and quadratic-optimization mechanisms. Inspect actual synthetic-state traces, compatible operation/residual comparisons, matrix cells and convergence samples. Change inputs/parameters, pause or step playback, and return from an added figure to its cited passage.

Import text PDFs or supported arXiv sources, keep the original locally, and explicitly ask the official Meta API for source-linked figures or contextual explanations. Reopen a completed analysis without inference; recover an accepted background job after reload. Invalid source quotations, incompatible engines and unsafe/oversized results activate no computed addition.

Restore reading position and compatible experiment state locally. Share a small prepared mechanism through a full URL, or export/import a bundle with explicit text/PDF inclusion. Optionally create a seven-day public prepared-snapshot link with private deletion control. URLs never transfer a locally stored PDF and public-link storage never becomes a private-paper upload service.

Computations run in the versioned browser worker; new work cancels obsolete execution rather than accepting stale results. PDF `source-v2` adds conservative two-column order repair and original-caption references while retaining original-source warnings and provenance.

## Runtime and compatibility

| Boundary | Release value |
| --- | --- |
| Application | `1.1.0` |
| Source/figure/trace/snapshot envelope | `schemaVersion: 1`, additive matrix/plot variants |
| Import analysis pipeline | `m2-v1` |
| PDF normalizer for new imports | `source-v2` |
| Execution worker protocol | `1` |
| Trusted engines | `dijkstra-heap`, `dijkstra-scan`, `powersort`, `natural-mergesort`, `gradient-descent`, `heavy-ball`, each version `1.0.0` |
| Verified Meta model | `muse-spark-1.3`, official `https://api.meta.ai/v1` |
| Local target | Next.js Node runtime; Node 24.14 or later in the Node 24 line |
| Hosted target | Same authored static Next frontend plus Cloudflare Worker API and shared D1 |

Older valid graph/array/step snapshots remain structurally supported. Older application versions do not understand the new matrix/plot variants and must reject them. New `source-v2` imports get a new identity; saved older sources are not silently rewritten. Engine versions and source identities are checked before restoration. The worker asset is rebuilt from trusted source at install/dev/build time and is not model-generated code.

Local/single-host Node instances may share a persistent SQLite volume. Independent Node replicas require the configured shared Redis adapter. The hosted Sites target injects its D1 adapter directly; it does not depend on Redis or silently fall back to per-instance SQLite. Missing reliable quota storage disables new paid work. Accepted signed job recovery remains available when only usage reporting fails.

## Evidence checked

- Strict TypeScript, **134 provider-free tests** and optimized production build passed for the integrated release check. The exact earlier isolated source installation and 133-test snapshot remain in [clean-install evidence](clean-install-report.md).
- Local and hosted real Meta imports preserved their source blocks and produced cited additions. [Hosted live smoke](hosted-live-smoke.json) reports 22,042 tokens and three conceptual figures; local integration reports 21,849 tokens and two figures.
- [Actual hosted quota/short-link smoke](hosted-quota-smoke.json) records frontend/worker HTTP 200, shared D1 health, analysis/question HTTP 429 with zero new paid work, and the create/resolve/delete/expiry lifecycle.
- A built standalone Docker image ran locally without Meta configuration; health, frontend and both worker assets returned HTTP 200 before the container was stopped.
- Browser worker/direct semantic results matched. [Browser measurements](browser-worker-profile.json) distinguish responsiveness benefits from startup, transfer and rendering costs.
- The numerical mechanism matches independent equations/exact solutions; extraction changes retain characters and disclose uncertainty. See [M5 evidence](m5-report.md), [engine extension](engine-extension.md) and [PDF reconstruction](pdf-reconstruction.md).
- The frozen [held-out enrichment evaluation](evaluation-report.md) records failures as well as cited conceptual successes. It was developer self-review, not a participant study.
- The [restricted original-author Java replay](reproduction-audit.md) measured TimsortTrot merge-cost overhead of 30.1299% against top-down on the documented inputs, consistent with one qualitative paper statement. No hardware runtime replication or browser evidence upgrade follows from that result.
- [Dependency notices](dependency-notices.md) inventory 163 installed package license declarations and 154 collected license files. Project source is [ISC](../LICENSE); research-source CC notices remain separate.

The five actual paid creations during this M4/M5 work reported 79,494 tokens in total, including the 35,603-token frozen baseline. This is not an account-balance statement or lifetime project total. Routine tests, parameter changes, reading, sharing, bundle restoration and local simulation do not call inference.

## Hosting and delivery

The deployed [owner-private Site](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site) was exercised with authorized access. Its URL is not evidence that anonymous judges can access it. The owner explicitly chose to retain private access. Preserve that audience and source identity unless the owner chooses another audience. Follow [deployment](deployment.md) and [operations](operations.md) for reproducible packaging, durable-store selection, secrets and post-credit modes.

[The recorded English demo](../artifacts/paperplay-demo.mp4) contains 70.052 seconds of actual UI footage at 2560×1600, encoded as H.264, with burned-in English subtitles and no audio. It is review material, not a portal-accepted submission.

[The English demo script](demo-script.md), [submission draft](submission-draft.md) and [current portal research](hackathon-requirements.md) are handoff material. Authenticated portal fields and definitive video/submission constraints still require manual verification. No submission, participant recruitment, message to judges or user-study result is claimed. The recorded demo describes these actual capabilities and limits rather than implying that every paper becomes executable. The backlog records 43 completed issues; PP-037 and PP-038 have implemented material/software but await external portal/delivery acceptance. No claim of 45 accepted completions is made.

## Known limits that must stay visible

Imported source text is sent to Meta only through explicit inference actions. Original PDFs remain in browser storage in this flow, unless the user explicitly includes one in a downloaded bundle. Browser storage can be cleared; there is no account, cloud synchronization or automatic private-paper upload. Public short-link deletion does not revoke already downloaded copies.

Local PDFs are capped at 10 MiB/50 pages; normalization and model context have separate bounds. Papers above the 70,000-character analysis context remain readable but are not silently truncated for inference. Equations, figures, tables, reading order and PDF metadata may be incomplete. There is no OCR. Logical HTML references are not physical PDF pages.

The held-out run did not prove reliable automatic executable-figure selection, scientific correctness of every generated sentence, learning effectiveness, arbitrary algorithm support or a full-paper reconstruction guarantee. Some valid-looking figure prose described unavailable controls; the release displays actual available interactions explicitly rather than pretending those controls exist. Scientific labels remain conceptual/simplified/checked-mechanism as supported by their own evidence.

Quotas and creation-disable/expiry flags bound application behavior, not financial billing or true account-credit expiry. Meta billing and the hosting dashboard remain authoritative. Worker memory/CPU/request/storage limits still apply; successful smoke tests are not load certification. The private hosted demo, current portal handoff, lack of participants and incomplete original hardware study must not be relabeled as completed public judging or experimental/user-study evidence.

Final private publication identifiers and the zero-new-request status check are recorded in [deployment-report.json](deployment-report.json) and [hosted-release-smoke.json](hosted-release-smoke.json). Actual browser restoration of a matrix snapshot retained step size 0.12 and produced a new 101-state trace without errors. [Cold/failure rehearsal](failure-rehearsal.json) retained source reading after real operator-disabled and simulated provider-unavailable responses.
