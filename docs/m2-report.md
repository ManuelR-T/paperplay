# M2 — Automatic import and Meta enrichment

Completed locally on 27 October 2026: PP-018–PP-026. This is a bounded import-and-enrichment MVP, not a claim that arbitrary PDFs can be faithfully reconstructed or arbitrary algorithms executed.

## Delivered

| Issues | Result | Evidence |
| --- | --- | --- |
| PP-018–020 | Browser PDF.js extraction with physical pages, cancellation, original Blob, stable source hashes; version-pinned arXiv HTML with PDF fallback; bounded context without silent truncation | `lib/import/`, `app/api/arxiv/`, `tests/import.test.ts`, [pipeline guide](import-pipeline.md) |
| PP-021 | Versioned IndexedDB sources, original files, validated analyses and job checkpoints; visible quota/version/storage errors | `lib/import-storage.ts`, `tests/import-storage.test.ts` |
| PP-022–024 | Official Meta structured output, bounded English figure planning, source quotation/page checks, trusted engine registry and conceptual fallback | `server/analysis/`, `lib/analysis.ts`, `tests/analysis*.test.ts` |
| PP-025 | Start/status/cancel API, signed browser-scoped jobs, durable checkpoints, status-only reload recovery, finite polling, explicit uncertain outcomes | `lib/import-controller.ts`, `tests/import-controller.test.ts`, [recovery guide](import-recovery.md) |
| PP-026 | shadcn import dialog, observable progress, local paper list, readable extracted source, inline generated figures and source navigation | `components/import-tools.tsx`, `components/imported-paper.tsx`, `components/figures/generated-figure.tsx` |

Prepared M1 papers, real deterministic engines and their reading editions remain available without an inference request. Generated figures render their actual validated data and bindings; they do not reuse prepared figures under different names.

## Actual integration checks

The collaborative browser imported the complete bundled publisher PDF `priority-search-trees.pdf`: 18 physical pages, 229 source blocks. Its complete bounded source was submitted to the official configured Meta API, model `muse-spark-1.3`. The provider accepted the strict JSON schema. Usage reported for this completed analysis: 18,893 input tokens, 2,535 output tokens, 21,428 total tokens. Dollar cost was not reported by the API and is not estimated here.

The browser was reloaded while the job was accepted but incomplete. Recovery called `/api/analysis/status`, without a second `/start`, and produced two validated step figures beside the original passages: “Priority search tree augmentation” (physical page 2) and “Abstract Prim loop with light edges” (physical page 8). These are explicitly conceptual explanations, not executions of those unsupported mechanisms. A third proposed Dijkstra figure failed validation and was discarded with a visible analysis note. Its output was not repaired by inventing a quotation or replacing a passage. Source blocks remained unchanged.

Step interaction changed the displayed explanation. Figure links referenced their original block IDs and pages. Completed analyses reopened from IndexedDB; selecting a saved analysis did not create a new model response.

A separate browser import of `1805.04154v1` resolved the real arXiv structured article (151 blocks). Its Meta job was accepted, then cancelled successfully through `/api/analysis/cancel`; the UI reached the confirmed cancelled state while retaining the source. This was the second accepted live analysis during M2 verification. Reimporting that same cancelled source reused its local record rather than submitting replacement work. HTML references were explicitly labeled logical locations, not physical PDF pages.

Malformed PDF import failed visibly without starting another inference request. Existing saved source content remained available. Mobile checks at 320 and 390 pixels and desktop at 1280 pixels found no document-wide horizontal overflow. Reading text remains 17px on mobile and 18px on desktop; auxiliary explanatory text remains at least 14px.

## Repeatable verification

- `npm ci`: succeeds, copies local worker/CMaps/fonts/WASM using postinstall, audit reports zero vulnerabilities.
- `npm run check`: strict TypeScript, 71 provider-free tests and optimized production build pass.
- PDF tests parse the real 18-page PDF. Encrypted/scanned/51-page cases simulate the PDF.js boundary, as disclosed in the pipeline guide.
- Meaningful lifecycle tests cover persisted blobs, corrupt/newer database records, checkpoints before submission, ambiguous sends, status-only reload, finite polling, network pause, cancellation races, deletion and validated result caching.
- API/contract tests cover origin checks, browser ownership, token tampering, changed source, expiry, renewed sessions, missing configuration, oversized input, source rewriting, wrong quotes/pages, markup and incompatible engines. Confirmed provider rejections stay explicitly retryable; unknown gateway outcomes remain uncertain.
- No routine test, figure parameter edit or saved-analysis navigation starts inference.

## Operational bounds and remaining scope

Local PDFs are limited to 10 MiB / 50 pages; normalized sources to 200,000 source characters / 1,000 blocks. Analysis context is limited to 70,000 characters; an oversized source remains readable but is rejected for analysis, never silently shortened. Structured arXiv HTML is capped at 2 MB; its server PDF fallback at 3 MB. See the pipeline guide for exact network and extraction behavior.

PDF math, figures and reading order can be lossy. There is no OCR or general equation/figure reconstruction in M2. arXiv structured math is retained when its source representation supports it. Unknown methods receive explanatory steps or a conceptual graph/array; computation is limited to the declared Dijkstra and sorting engines. Quote matching establishes provenance, not scientific validity. Held-out quality evaluation remains PP-034.

Analysis creation allows 6,000 output tokens, a 25-second SDK request timeout and no automatic SDK retry. Background execution may continue beyond that HTTP request. Polling is bounded to 120 attempts at two-second intervals. A saved accepted reference resumes existing work; an interrupted submission without a reference becomes uncertain and is never automatically resubmitted. Removing such a record cannot cancel an unidentifiable provider job. A server restart loses in-process request deduplication, but accepted signed references remain usable with unchanged server signing configuration.

Job capabilities and HttpOnly SameSite session cookies expire after 24 hours; new submissions renew the same session identity. Completed local analyses remain readable afterward without provider access. Start requests enforce matching browser Origin/Host and local hosts by default. Configure the exact `ANALYSIS_APP_ORIGIN` for LAN/hosted use; the server does not trust arbitrary forwarded hosts. Optional `ANALYSIS_SIGNING_SECRET` stabilizes capabilities independently of API-key rotation.

The server applies local, process-scoped creation limits (10/hour globally, 3/session/10 minutes). These are development safeguards, not durable distributed quotas or a billing cap. Production rate limits, budget enforcement, contextual questions, parameter-state persistence, sharing and deployment remain their M3/M4 issues. No GitHub issues, commits, pushes or deployments were created by this milestone.
