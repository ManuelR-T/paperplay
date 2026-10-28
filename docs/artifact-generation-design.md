# Bounded Muse artifact generation (PP-097)

The reader keeps the inexpensive catalog planner first. **Add with Meta → Generate a new interaction** opens a separate authoring path when a mechanism needs a new SDK program. The user selects a source section, brief and one to three total paid attempts before **Create with Meta**. That action authorizes local engineering checks and up to two repairs within the chosen ceiling; it does not accept the result. Existing figures and reading remain available.

## Small interfaces and ownership

`shared/artifact-generation.ts` defines strict requests, candidates, plans, finite diagnostics, run references and replies. `server/artifact-generation` owns frozen scope, provider communication and accounting. The browser owns local compilation/execution through the already admitted [compiler](artifact-compiler.md) and [runtime](figure-runtime.md). `generation-check.ts` supplies application-owned smoke scenarios. `generation-state.ts` retains bounded local attempts and accepted figures; the generation panel orchestrates them from explicit actions.

The separate provider requests a short mechanism/interaction plan, exact passage quote, synchronous `update(input,previous,event)` source, top-level interfaces and descriptive checks. It receives the SDK and frame grammar. The catalog provider's prohibition on generated JavaScript is unchanged. The server constructs source identity, SDK/source digests, dependency lock, rights notice, resource ceilings, authorship `meta` and evidence `unverified`; the model cannot grant host privileges or scientific verification. External assets are not supported in this first generation path. Conceptual/synthetic content is distinguished from observed measurements.

Generated source is never executed, imported or built by the server. The server returns inert manifests. Model-declared `tests` remain descriptive expectations, not passing scientific assertions.

## Creation, recovery and cancellation

All routes are same-origin POST with bounded JSON (2.5 MB transport). `prepare` establishes the existing HttpOnly anonymous session without inference and creates/reconciles a durable run. `start` claims exactly the requested attempt and may create one background Meta response. `status` only retrieves that attempt. `cancel` closes the run to new attempts and requests best-effort cancellation of a known accepted response. A signed run capability binds owner, model, context and dates; every operation also checks durable ownership.

The complete source, selected section and brief are supplied again to start/status and checked against the frozen context hash. Source anchors added by the reader are excluded from the shared paper identity. Repairs require the exact preceding candidate hash and bounded actionable diagnostics. Raw guest exceptions, data tables, stack traces and host paths are not repair feedback. Infrastructure failure, integrity failure, resource contention and cancellation do not authorize a paid repair.

The browser saves the prepared run and exact pending attempt **before** a paid start. Storage failure stops creation. Ambiguous transport retains that reference and its conservative charge; neither reopening the panel nor polling submits a replacement. Restored state is paused. Retrieval can check an accepted candidate locally but cannot automatically repair it; the user must explicitly resume any remaining authorized attempts. A lost/unsubmitted request can be cancelled without inventing a fresh paid retry.

Stop aborts local work and closes the server run. Closing the browser does not guarantee cancellation or zero provider charges. Accepted work can still be retrieved after the five-minute creation deadline or inference cutoff. Deadline/session expiry does not silently create a replacement.

## Durable limits and shared allowances

- One to three paid calls total per run, chosen before creation; five minutes from preparation to claim/submit new work.
- At most 50,000 serialized input characters, including instructions, SDK/frame grammar, response schema and repair context; 6,000 output tokens per call. Oversized prompts stop rather than silently shrinking source scope.
- At most 222,000 conservatively reserved tokens per maximal call and 666,000 per run, using the existing accounting formula. The UI scales the advertised ceiling to the selected attempt count. Reserved tokens are conservative allowance accounting, not a currency quote or measured model usage.
- The existing **eight requests / 1,000,000 tokens per paper** is shared with catalog enrichment, together with global/session/hourly/daily limits. Each attempt has a deterministic usage ID and payload fingerprint.
- Run/attempt claims and paper reservations share a SQLite `BEGIN IMMEDIATE` transaction. Duplicate accepted requests reconcile the same provider job across handler instances/connections. A previous reserved/accepted/uncertain attempt prevents advancement.
- Metadata only is stored server-side: owner, hashes, model, dates, counters, statuses, response references and candidate digests. Source text, code, brief, feedback and signed capabilities are not persisted in that ledger. Browser-local recovery state does contain the user's candidates and signed run reference; ordinary figure downloads contain only the artifact.
- Separate global/provider systems cannot share an atomic transaction. Ambiguous submissions retain reservations; terminal measured charges are not reduced by stale queued/cancelled reports. Distributed hosting remains refused without a shared per-paper/run ledger.

The provider uses the configured Meta endpoint/model, zero SDK retries, bounded output and background response retrieval. Its HTTP timeout is not a guarantee on accepted job duration or billing.

## Local engineering scenarios

The candidate's canonical plan/artifact digest and exact source/SDK bindings are checked first. A fresh capped compiler must admit the script. The runtime then checks initialization, the first slider at both endpoints, the first enabled button and the first selectable entity when present. Each interaction branches from the initial validated frame; at most five runtime scenarios run. Frames, state, controls and source links undergo the existing strict SDK validation. No model-authored assertion or test command executes.

The UI displays which scenarios passed, failed or were skipped. No-interaction frames explicitly skip interaction checks. Unknown platform failures are nonrepairable infrastructure outcomes. A genuine syntax/policy or typed output/execution failure may request another attempt while the original Create authorization, time and quota remain. Build/preview success does not verify equations, measurements, scientific accuracy or layout quality; PP-098 adds a separate quality gate.

Failure candidates and sanitized diagnostics remain inspectable (three attempts). Previews require an explicit local action; successful generation/checks never save automatically. Explicitly accepted figures enter a source-bound local library (12 maximum), can reopen without inference and download their inert artifact. The original paper, existing v2 figures and notes are not rewritten. Versioned replay/build/report portability remains subsequent work.

## Verification and limits

`npm run check` passes TypeScript, 341 tests and the production build. Automated tests use fake providers and temporary/in-memory ledgers. They cover ownership/source/context changes, duplicate/concurrent submissions, attempt/time limits, uncertain starts, quotas shared with catalog requests, global rejection, stale terminal reports, metadata privacy, frozen candidate feedback, invalid anchors/output, source-bound cache recovery and infrastructure classification. A fake-provider polymer-binding candidate passes the real isolated compiler and restricted interpreter through initialization, slider endpoints, button and entity scenarios without manual source edits.

[Native Chromium154 workflow evidence](../data/artifact-generation-browser.json) records a simulated invalid first response, syntax feedback, automatic second attempt, actual local compiler/runtime success and explicit save/preview. The 320px page has no measured overflow. Reload restores paused history/accepted figures with zero generation API requests. A simulated storage quota failure reaches only inference-free prepare and sends no paid start.

These fixtures establish engineering behavior, not actual Meta generation success or model quality. Routine verification made zero paid model calls. The Meta integration still needs an explicitly initiated live generation to measure its quality; human scientific review remains unavailable. Browser layout review, deterministic scientific references, coverage and adoption have their own backlog gates.
