<img src="assets/icon.svg" width="64" height="64" alt="">

# Paperplay

Read research papers with interactive figures beside the passages they explain. Change an input, replay a trusted algorithm, inspect its actual measurements, and return to the cited source.

**Current development builds on 1.1.0** with Meta choosing the paper’s illustrations. Open a paper from arXiv discovery or a PDF: Meta reads the complete imported paper in one planning request, chooses a few complementary illustrations, then implements only that plan. Each figure explains why it belongs at its cited passage, what to try and what to notice. Meta can configure the existing bank, create a new isolated interaction, and curate previously saved figures to avoid repetition. There is no keyword-based insertion, four-section cutoff or manual creation panel. Hackathon mode records actual usage without application spending quotas; accepted work and cached Meta results are reused. [Automatic reading flow](docs/automatic-papers.md).

[Hosted demonstration](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site) — owner-private, as explicitly requested. [70-second English demo](artifacts/paperplay-demo.mp4) — actual UI footage with English subtitles and no audio. Neither artifact establishes anonymous judge access or a submitted hackathon entry.

## Product roadmap beyond the first release

The [M6–M11 roadmap](docs/next-roadmap.md) tracks 34 GitHub issues. Thirty feature issues are implemented, technically checked and closed on GitHub. [#24](https://github.com/ManuelR-T/paperplay/issues/24) remains open: its protocol is prepared, but no real readers are available. The three Railway release issues are deferred. [Browse the interactive roadmap](docs/next-roadmap.html) or [GitHub](https://github.com/ManuelR-T/paperplay/issues).

**Release hosting:** Railway is the selected target, with provisioning and hosted checks deferred until the final release. [Railway release plan](docs/railway-release.md). The existing private Sites demonstration is a retained experiment; no Railway service is configured yet.

## Scientific representation architecture

The [M12–M16 architecture](docs/scientific-architecture.md) implements35of36 child issues across composed views, linked selections, scientific data and bounded execution adapters, independent reference checks, isolated generated artifacts, replay/export and compatibility recovery. The remaining human study has no participants yet. The [twelve-paper scientific intake](docs/scientific-corpus.md) and [frozen evaluation](docs/frozen-evaluation-results.md) report actual source-access, grounding and layout failures; they do not establish universal scientific coverage. Generated code remains isolated and subject to local checks and the [operator policy](docs/architecture-adoption.md).

## Original figures and new widget designs

Original figures now appear in the reading flow. The four prepared PDF figures/algorithm regions use reviewed crops, with a complete-page toggle. Imported PDFs display the original page at detected captions when no reviewed crop exists. New structured arXiv imports retain same-article image assets; older saved HTML sources need reimport to gain missing asset locations.

Meta can now propose a **custom declarative teaching program** when the standard catalog cannot express a concept: editable parameters, bounded simultaneous state updates, numerical metrics, an interactive scene and an optional plot. Its catalog gap, source quote and assumptions are inspectable before acceptance. The runtime supports arithmetic expressions and palette-controlled primitives; it does not run generated JavaScript or load packages. [Architecture, hooks and verification](docs/custom-widget-design.md). [Original-figure behavior](docs/original-figures.md).

## Run locally

Use Node 24.14 or later in the Node 24 line (`.nvmrc`) and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Prepared papers and local computations work without an API key. Installation rebuilds the pinned PDF.js resources and trusted engine-worker asset; runtime parsing does not depend on a worker CDN.

For production:

```sh
npm run check
npm run start
```

`check` runs strict TypeScript, provider-free tests and the optimized Next build. CI runs those checks without private credentials. [Clean-install evidence](docs/clean-install-report.md) records an isolated source installation and prepared numeric-browser run without credentials. Optional container packaging is provided by [Dockerfile](Dockerfile) and [compose.yml](compose.yml); use the [deployment guide](docs/deployment.md) for persistent storage and environment handling.

## Enable Meta and control usage

Copy `.env.example` to `.env.local`, set server-only `MODEL_API_KEY`, and restart the server. Never use a `NEXT_PUBLIC_` key variable. The official Meta endpoint and configured `muse-spark-1.3` model are documented in [Meta setup](docs/meta-setup.md).

```sh
npm run meta:check           # configuration only; no inference
npm run meta:check -- --live # explicit bounded provider probe
npm run usage:summary        # local Node operator aggregate; no inference
```

The default import prepares a local source without inference. Only an explicitly selected immediate guide, analysis, question, plan, repair or settings proposal creates inference. Reading, changing parameters, playback, worker execution, reopening saved analyses and sharing experiments do not. Source text is sent to Meta for those explicit inference actions; this flow does not upload the original local PDF to Meta. `/api/health` reports configuration/creation availability, not remaining credit or proven provider connectivity.

For LAN/hosted API access, set the exact `ANALYSIS_APP_ORIGIN`. Preserve signing configuration to keep accepted job capabilities valid. Request/token limits are enforced before paid work through one shared durable store:

| Runtime | Quotas | Optional short links |
| --- | --- | --- |
| Local or one persistent Node host | SQLite on the shared persistent volume | SQLite |
| Distributed Next/Node replicas | Configured shared Redis REST | Unavailable until a shared link adapter is supplied |
| Hosted Sites artifact | Injected shared D1 database | Same D1 database, separate tables |

Missing shared infrastructure fails closed rather than falling back to process memory. Defaults are 20 requests/hour globally, 5/session/ten minutes, 100/UTC day and 2,000,000 accounted tokens/day. Pending or unknown work retains a conservative reservation. These are application allowances, not a dollar cap or credit balance; Meta billing remains authoritative.

Set `META_ANALYSIS_ENABLED=false` or an operator-selected `META_CREDITS_EXPIRE_AT` timestamp to stop **new** paid work after the event. Keep the provider/signing configuration while accepted jobs still need retrieval or cancellation. Prepared sources, local simulations and saved results remain usable. See [operations](docs/operations.md) and [usage controls](docs/usage-controls.md).

## Read, interact and transfer an experiment

**Import paper** first opens a readable source and its section planner; it does not automatically create a model response. It accepts a text PDF up to 10 MiB/50 pages or a supported versioned arXiv link. Structured arXiv HTML is preferred; PDF fallback retains physical page references. HTML references are logical locations, not invented PDF page numbers. Original PDFs, extracted sources and validated analyses stay in this browser's IndexedDB. Source hashes prevent silent reuse after parser/version changes.

Prepared examples cover graph shortest distances, adaptive stable sorting, and SPD-quadratic optimization. The engine registry declares input domains, parameter bounds, metric units and compatible comparisons. New renderers consume generic input/trace state rather than choosing algorithms by name in the reader. [The extension guide](docs/engine-extension.md) documents the third-family implementation and independent references.

**Ask about this passage/figure** provides a bounded, cited interpretation. The server recomputes supported current inputs and parameters; it does not trust submitted metrics. Changing context clears unrelated answers. Matching a quote proves its location, not the scientific truth of an explanation.

Reading position, selected figure, input, method, seed, parameters and playback/step selection restore locally. There are no accounts or cross-device synchronization. **Share snapshot** transfers a small compatible public example through a URL. **Export experiment** and **Open bundle** move larger/private experiments, with explicit source-text and original-PDF inclusion. Source authorship/permission is retained, not inferred from importing a file. A URL never transfers a PDF stored only on the sender's device.

**Create 7-day link** optionally stores only a bounded public prepared snapshot after its disclosure. Anyone with access to this site and that link can read it until expiry. Its separate deletion capability stays private in this browser. Private paper text/PDFs are not accepted by that endpoint. [Short-link design](docs/short-links.md) explains retention, deletion, quotas and cost bounds.

## Limits and scientific evidence

- The legacy full-source guide is capped at 70,000 characters. Section planning keeps the full source readable while sending bounded selected passages and limited neighbors, with visible analyzed/unanalyzed coverage. It does not claim complete-paper analysis.
- PDF extraction is heuristic. `source-v3` adds conservative paragraph joining, witnessed dehyphenation and heuristic headings with retained raw fragments/coordinates. It does not invent missing images, tables, equations or scanned text. Older saved versions stay unchanged. There is no OCR. Check the original source.
- Unknown mechanisms receive conceptual explanations or an explicit failure. The held-out baseline produced useful cited conceptual figures and rejected an invalid computed one; it did **not** establish reliable automatic executable-figure selection or learning effectiveness.
- Numeric inputs are small SPD matrices (up to 8×8), at most 200 iterations, with explicit stable-setting restrictions. A finite completed trajectory need not have reached convergence tolerance. Matrix/plot values are labeled computed or illustrative, never invented paper measurements.
- Worker requests/results are bounded; cancellation terminates the old worker, and stale results cannot overwrite newer settings. There is no blocking UI-thread fallback when workers are unavailable.
- Legacy URL snapshots allow 8,000 decoded bytes/12,000 encoded characters; separately validated version-2 widget URLs allow 64 KiB of decoded data. Bundles allow 20 MiB, with a PDF up to 10 MiB. Engine/source/schema incompatibility produces an error rather than silently changing the experiment.

Browser labels distinguish conceptual illustrations and checked mechanisms. The graph example does not implement the paper's functional priority search tree or Isabelle proof. Powersort and numeric recurrences have bounded independent reference checks. [A restricted original-author Java merge-cost replay](docs/reproduction-audit.md) measured a result consistent with one qualitative paper finding; the complete hardware runtime study was not reproduced, and this evidence does not promote the browser engines to original-experiment reproduction.

## Architecture and evidence

The authored app uses Next.js App Router, React, TypeScript, Tailwind and shadcn/ui. The normal Node target and hosted static-frontend/Cloudflare-Worker packaging share UI, source/figure contracts and inference handlers. The hosted adapter does not replace the frontend framework.

- `app/`, `components/`: reading, import, contextual questions, accessible figures and controls.
- `data/`, `public/papers/`: attributed prepared selections and two unchanged licensed publisher PDFs.
- `shared/`: strict versioned source/figure/trace/snapshot contracts.
- `lib/engines/`, `lib/execution/`: trusted deterministic computations and worker protocol.
- `lib/import/`: bounded source extraction, normalization and provenance.
- `lib/reading/`, `lib/reading-state.ts`, `lib/snapshots.ts`: preferences, local notes/search, study packs and portable experiments.
- `shared/widgets.ts`, `lib/widgets/`, `lib/experiments/`: bounded catalog, trusted worker computations, source-linked authoring and experiments.
- `server/analysis/`, `server/questions/`, `server/enrichment/`: bounded official Meta integration, inspectable section plans, repairs/settings proposals and validation.
- `server/usage/`, `server/short-links/`: durable accounting and optional public snapshots.
- `deploy/`: hosted API adapter and D1 migrations; `scripts/`: build, evaluation and operator tools.

Start with the [release notes](docs/release-v1.1.0.md), [acceptance matrix](docs/acceptance-matrix.md), [M5 report](docs/m5-report.md), [deployment guide](docs/deployment.md), [evaluation](docs/evaluation-report.md), [worker measurements](docs/performance-worker.md) and [PDF reconstruction evidence](docs/pdf-reconstruction.md). Earlier [M0](docs/m0-report.md), [M1](docs/m1-report.md), [M2](docs/m2-report.md) and [M3](docs/m3-report.md) reports preserve their original verification scope. [The backlog](docs/backlog.md) and [roadmap](docs/roadmap.html) track completion and external handoff limits.

Project source is [ISC-licensed](LICENSE). Research sources retain their separate [attribution and CC licenses](public/papers/ATTRIBUTION.md). [Dependency notices](docs/dependency-notices.md) inventory the locked installed tree; upstream license files remain authoritative. See [SECURITY.md](SECURITY.md) for trust and disclosure boundaries.

Created in [T3 Code](https://t3.codes).

## Explore arXiv

Open `/explore` to search arXiv, preview abstracts, save a local reading list and open exact paper versions in the reader. Discovery and source import use no Meta inference; interactive figure generation remains an explicit choice. See [the exploration flow and server limits](docs/explore.md) and [local validation evidence](docs/explore-qa.json).
