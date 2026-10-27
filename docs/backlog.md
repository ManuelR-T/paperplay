# Paperplay — implementation issues

All 45 issues have implemented deliverables. Acceptance is complete for 43; PP-037 and PP-038 retain explicit external gates for authenticated submission/media requirements and judge invitations to the intentionally private Site. See [M4](m4-report.md), [M5](m5-report.md) and the [acceptance matrix](acceptance-matrix.md). PP identifiers are local planning IDs, not GitHub issue numbers. No tracker issues were created or remotely closed.

Planning guide: [project-plan.md](project-plan.md). Source of truth for scope: [product-spec.md](product-spec.md). Machine-readable version: [backlog.json](backlog.json).

Effort ranges describe focused implementation and verification, not guaranteed delivery dates. External waiting and release contingency are separate. P0 is the proposed hackathon candidate; the complete agreed MVP requires P0 and P1. P2 items are optional extensions.

## M0 — Foundations and integration risks

<a id="pp-001"></a>

### PP-001 — Select two demo papers and a held-out evaluation corpus

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** None

**Outcome:** Ground the product in real papers from different algorithm families before implementing example-specific behavior.

**Scope:** Choose two redistributable demo sources, a small unseen-paper corpus and at least one deliberately unsupported method. Record paper versions, available data, licenses and candidate reference cases.

**Acceptance criteria:**

- [x] Demo sources cover two genuinely different algorithm families; pathfinding is an option, not the product boundary.
- [x] Each source has a stable reference, permitted redistribution strategy and a list of target concepts.
- [x] A held-out paper is reserved for assessing automatic placement; examples do not need to support every algorithm.

**Verification:** Manually review source quality, rights, math/figure extraction and available experiment protocols. Record remaining unknowns instead of inventing results.

**Completion evidence:** [M0 report](m0-report.md). Remote CI execution is not claimed.

<a id="pp-002"></a>

### PP-002 — Replace the abandoned scaffold with a working Next.js application

Priority: **P0** · Status: completed · Effort: **2–3 focused hours**

**Depends on:** None

**Outcome:** Provide one runnable application with server routes and client interactions.

**Scope:** Set up Next App Router, TypeScript, server-only boundaries, environment validation and an English root page. Remove obsolete Vite, Express, Groq and attention-demo assumptions. Repair install scripts and asset paths.

**Acceptance criteria:**

- [x] A clean npm ci succeeds; dev, production build and start commands work.
- [x] No stale Express/Vite imports or Groq configuration remain in active code.
- [x] The prepared example can render without an API key; private environment values stay server-side.

**Verification:** Run installation, type checking and a production smoke test from a clean checkout.

**Completion evidence:** [M0 report](m0-report.md). Remote CI execution is not claimed.

<a id="pp-003"></a>

### PP-003 — Define versioned source, figure, engine and snapshot contracts

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-002](#pp-002)

**Outcome:** Keep generic rendering independent from particular algorithm implementations.

**Scope:** Define Zod contracts for source blocks, equations, figures, source anchors, figure specifications, engine capabilities, traces and versioned snapshots. Distinguish computed traces from illustrative walkthroughs.

**Acceptance criteria:**

- [x] At least two family examples can be represented without family-specific fields in the source/figure envelope.
- [x] Every added figure references a valid source anchor and declares its content and controls.
- [x] Unknown types, invalid references, incompatible versions and out-of-bounds control values have explicit rejection paths.

**Verification:** Validate representative graph, array and illustrative fixtures plus malformed and incompatible inputs.

**Completion evidence:** [M0 report](m0-report.md). Remote CI execution is not claimed.

<a id="pp-004"></a>

### PP-004 — Verify the official Meta API, credits and asynchronous capabilities

Priority: **P0** · Status: completed · Effort: **1–3 focused hours**

**Depends on:** [PP-002](#pp-002)

**Outcome:** Resolve the external integration risk before building the analysis workflow.

**Scope:** With locally configured credentials, verify the official Meta endpoint, an available model, credit activation, JSON schema output, background creation, retrieval and cancellation. Start with a tiny bounded request; never put keys in the issue or logs.

**Acceptance criteria:**

- [x] A provider/model capability record identifies what was actually tested and when.
- [x] Structured output and the complete background lifecycle work with the project account, or a precise external blocker is recorded.
- [x] Actual token usage is captured; absent credentials leave the demo working with an explicit unconfigured state.

**Verification:** Use the smallest practical live request and saved redacted request/response shapes. This issue stays externally blocked until credentials exist; independent work continues.

**Completion evidence:** [M0 report](m0-report.md). Remote CI execution is not claimed.

<a id="pp-005"></a>

### PP-005 — Establish focused automated checks for the application

Priority: **P0** · Status: completed · Effort: **1–2 focused hours**

**Depends on:** [PP-002](#pp-002)

**Outcome:** Catch broken contracts and algorithms during solo development.

**Scope:** Configure type checking, production build and a lightweight test runner in CI. Provide a place for engine invariants and provider contract fixtures; avoid live paid calls in routine CI.

**Acceptance criteria:**

- [x] CI can reproduce the documented checks with no private credentials.
- [x] A deliberately invalid engine fixture fails a meaningful invariant check.
- [x] Checks do not require configuring optional services merely to run the prepared example.

**Verification:** Run the same checks locally and inspect a CI execution when remote workflows are available.

## M1 — Complete prepared reading experience

**Completion evidence:** [M0 report](m0-report.md). Remote CI execution is not claimed.

<a id="pp-006"></a>

### PP-006 — Prepare faithful normalized versions of the demo papers

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-003](#pp-003)

**Outcome:** Make the first reader depend on actual source material rather than generated substitute prose.

**Scope:** Create normalized source fixtures preserving section order, important equations, original figure references and stable source IDs. Include permission/attribution metadata and separate Paperplay additions.

**Acceptance criteria:**

- [x] The demo reader content matches the selected source rather than an AI summary.
- [x] Equations, original illustrations or permitted placeholders and their captions retain source references.
- [x] Missing elements are recorded explicitly; fixtures identify prepared versus automatically extracted content.

**Verification:** Compare both fixtures with their originals and document extraction corrections.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-007"></a>

### PP-007 — Build the reformatted paper reader

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-006](#pp-006)

**Outcome:** Deliver comfortable English reading while preserving scientific content.

**Scope:** Implement semantic sections, equations, figures/captions, citations, contents navigation and an original-source link. Use editorial typography and responsive reading widths.

**Acceptance criteria:**

- [x] The opening screen is a ready-to-read example with no login or setup.
- [x] Original paper text and added explanations have distinct presentation.
- [x] Long equations, figures and source references remain readable without breaking the layout.

**Verification:** Inspect both demo papers on desktop and a narrow viewport, including equations and original-source navigation.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-008"></a>

### PP-008 — Anchor interactive figures inside the article

Priority: **P0** · Status: completed · Effort: **2–3 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-007](#pp-007)

**Outcome:** Make interactive content feel like added figures in the paper.

**Scope:** Render figure slots between source blocks, let selected passages focus their figure, and provide return-to-source links and captions.

**Acceptance criteria:**

- [x] Figures appear beside the relevant passage in reading order.
- [x] Passage selection, figure focus and return-to-source navigation work with a keyboard.
- [x] A broken anchor does not attach content to an arbitrary passage.

**Verification:** Exercise insertion and navigation using multiple figures in both demo documents.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-009"></a>

### PP-009 — Implement deterministic execution and trace infrastructure

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003)

**Outcome:** Ensure figures can replay actual calculations consistently.

**Scope:** Define the engine registry, seeded input generation, bounded controls, trace events, cancellation/operation limits and metric units. Keep computation separate from presentation.

**Acceptance criteria:**

- [x] Identical engine version, input, seed and parameters produce identical semantic outputs.
- [x] Invalid or excessive input fails without locking the browser.
- [x] Illustrative walkthroughs cannot masquerade as engine execution traces.

**Verification:** Test determinism, boundary cases, operation limits and trace consistency.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-010"></a>

### PP-010 — Implement the first algorithm family with a reference baseline

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-009](#pp-009)

**Outcome:** Provide a trustworthy first simulation and comparison.

**Scope:** Implement the selected method and a compatible baseline for one demo paper. A graph-search pair is a candidate; choose according to the corpus. Record assumptions, inputs, metrics and reference cases.

**Acceptance criteria:**

- [x] Reference cases establish correct output and relevant intermediate behavior.
- [x] Edge cases such as an empty input or unreachable target terminate explicitly.
- [x] Both methods use compatible inputs and metrics, with no invented speedup claims.

**Verification:** Compare against a small independent reference/oracle or hand-verified cases; test paper-specific assumptions.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-011"></a>

### PP-011 — Build the reusable trace player and parameter controls

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-009](#pp-009)

**Outcome:** Let readers inspect algorithm behavior step by step.

**Scope:** Implement play/pause, step, seek, speed, reset and validated parameter controls. A parameter change invalidates the old run visibly.

**Acceptance criteria:**

- [x] The same player operates on graph and array traces.
- [x] Reset restores the recorded input, seed and parameter state.
- [x] Playback has deterministic step semantics and respects reduced-motion settings.

**Verification:** Exercise seeking, parameter edits while paused/playing, cancellation and reset across two trace shapes.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-012"></a>

### PP-012 — Build the generic interactive graph figure

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-011](#pp-011)

**Outcome:** Visualize nodes, edges and algorithm states independently of a specific method.

**Scope:** Render graph states with labels, weights, highlighted nodes/edges and optional bounded input editing. Provide an accessible textual state summary.

**Acceptance criteria:**

- [x] Different compatible graph engines can reuse the renderer without algorithm-name conditionals.
- [x] Editing an allowed edge/node property recomputes the run and validates graph constraints.
- [x] Colors are supplemented by labels or shapes for current/frontier/visited/result states.

**Verification:** Inspect sparse, disconnected and weighted fixtures; verify editing, keyboard access and state summaries.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-013"></a>

### PP-013 — Build reusable array, table and illustrative step figures

Priority: **P0** · Status: completed · Effort: **2–3 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-011](#pp-011)

**Outcome:** Support non-graph papers and a useful unsupported-method fallback.

**Scope:** Render indexed values, markers, comparisons/swaps and structured step explanations. Distinguish a computed array trace from a source-grounded illustrative walkthrough.

**Acceptance criteria:**

- [x] An array algorithm can reuse the same player as a graph algorithm.
- [x] Unsupported methods can show a cited schematic or walkthrough without claiming execution.
- [x] Long labels and moderate input sizes remain readable.

**Verification:** Render an actual array trace and a non-executable illustrative example; confirm that their fidelity labels differ.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-014"></a>

### PP-014 — Implement a second algorithm family

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-009](#pp-009)

**Outcome:** Prove that the architecture extends beyond a pathfinding demonstration.

**Scope:** Implement a method and compatible baseline from a different family, such as sorting or dynamic programming, selected from the second paper. Reuse the existing engine and trace contracts.

**Acceptance criteria:**

- [x] A second family runs without changing the source/figure envelope or hardcoding its name into generic rendering.
- [x] Its assumptions and metrics are documented and independently checked.
- [x] Reference cases and degenerate inputs pass.

**Verification:** Use hand-verified or independent expected outputs and inspect the trace through the existing player.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-015"></a>

### PP-015 — Compare compatible methods using real measurements

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-010](#pp-010), [PP-012](#pp-012), [PP-013](#pp-013), [PP-014](#pp-014)

**Outcome:** Make method comparisons scientifically interpretable.

**Scope:** Build synchronized runs and comparison summaries using the same inputs, seeds and declared metrics. Separate deterministic counts from noisy browser timing.

**Acceptance criteria:**

- [x] Only methods in a compatible comparison group can be combined.
- [x] Displayed counts/results come from actual runs; incompatible methods get an explanatory fallback.
- [x] Runtime observations identify the local environment and do not claim replication of paper hardware.

**Verification:** Compare known small inputs, mismatched comparison groups and repeated runs; verify units and labels.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-016"></a>

### PP-016 — Enforce scientific fidelity and evidence labels

Priority: **P0** · Status: completed · Effort: **2–3 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-003](#pp-003), [PP-010](#pp-010), [PP-014](#pp-014)

**Outcome:** Prevent the model or UI from granting unsupported reproduction claims.

**Scope:** Define application-controlled evidence for illustrative walkthrough, simplified illustration, mechanism reproduction and experiment reproduction. Connect engine/version checks and source claims to labels.

**Acceptance criteria:**

- [x] A model-supplied verification claim is ignored unless application evidence supports it.
- [x] Synthetic data, changed assumptions and unavailable original protocols are visible.
- [x] Mechanism correctness alone cannot produce an experiment-reproduction label.

**Verification:** Test evidence-policy decisions for supported, unsupported, simplified and genuinely evaluated fixtures.

**Completion evidence:** [M1 report](m1-report.md). Source selections disclose omissions; no original experiment or automatic import is claimed.

<a id="pp-017"></a>

### PP-017 — Assemble the first complete generic reading experience

Priority: **P0** · Status: completed · Effort: **1–2 focused hours**

**Depends on:** [PP-008](#pp-008), [PP-010](#pp-010), [PP-012](#pp-012), [PP-013](#pp-013), [PP-014](#pp-014), [PP-015](#pp-015), [PP-016](#pp-016)

**Outcome:** Reach an independently demonstrable product before integrating automatic import.

**Scope:** Connect the two prepared sources, inline figures, parameter changes, trace playback, comparisons and evidence labels into a coherent English experience.

**Acceptance criteria:**

- [x] A new visitor can open each paper and manipulate a meaningful concept without configuration.
- [x] Both families use the same registry and source-anchor model.
- [x] This milestone is explicitly a prepared example, not proof of automatic generation.

**Verification:** Run a short end-to-end walkthrough and compare the observed behavior with both source papers.

## M2 — Automatic import and Meta enrichment

**Completion evidence:** [M2 report](m2-report.md), including real PDF/Meta/reload and arXiv/cancellation checks. Limits and simulated PDF boundary cases are disclosed.

<a id="pp-018"></a>

### PP-018 — Extract PDF source blocks with page provenance

Priority: **P0** · Status: completed · Effort: **3–6 focused hours**

**Depends on:** [PP-003](#pp-003)

**Outcome:** Accept user PDFs without pretending extraction is always lossless.

**Scope:** Use PDF.js with a browser worker to extract text and page metadata. Bound size/page count, identify extraction problems and retain the original document locally.

**Acceptance criteria:**

- [x] A text PDF yields page-linked blocks; extraction can be cancelled.
- [x] Scanned, encrypted, corrupt, oversized and poorly ordered multi-column documents report actionable limitations.
- [x] Missing equations or figures are not silently replaced by model guesses.

**Verification:** Use representative text, multi-column, mathematical, empty/scanned and malformed PDF fixtures.

<a id="pp-019"></a>

### PP-019 — Import arXiv papers using structured content when available

Priority: **P1** · Status: completed · Effort: **3–6 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-007](#pp-007), [PP-018](#pp-018)

**Outcome:** Improve article structure and equations for public research sources.

**Scope:** Validate arXiv identifiers/versions, resolve metadata and available HTML content, sanitize markup and fall back to the PDF path when needed. Constrain network destinations and redirects.

**Acceptance criteria:**

- [x] Supported arXiv links produce a stable versioned source reference.
- [x] Structured content preserves section order, equations and figure attribution where available.
- [x] Unavailable HTML and disallowed URLs have explicit fallback/error behavior; arbitrary URL fetching is not exposed.

**Verification:** Verify a structured article, a PDF-only article, malformed IDs and redirects to unapproved destinations.

<a id="pp-020"></a>

### PP-020 — Normalize imported sources and prepare bounded analysis context

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-018](#pp-018)

**Outcome:** Give Meta stable source anchors without losing the document identity.

**Scope:** Normalize imported blocks, compute document/version hashes, segment source context and track extraction warnings. Include relevant equations/captions and keep context within tested provider limits.

**Acceptance criteria:**

- [x] Every context passage maps back to an identifiable source block/page.
- [x] Reopening identical content preserves identity; a changed document or extraction version invalidates stale analyses.
- [x] An oversized paper is explicitly bounded or rejected rather than silently truncated.

**Verification:** Test identity stability, source mapping, context boundaries and retained extraction warnings.

<a id="pp-021"></a>

### PP-021 — Persist documents, analyses and checkpoints in IndexedDB

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003)

**Outcome:** Allow reload and recovery without requiring a user account.

**Scope:** Create versioned stores for source records, analyses, figure specs and pending provider job references. Handle migrations, quota limits and unavailable storage.

**Acceptance criteria:**

- [x] A pending analysis reference and its source checkpoint survive refresh.
- [x] Completed analyses can reopen without a model call.
- [x] Storage failure is visible and does not falsely promise that data was saved.

**Verification:** Check reopen, schema upgrade, quota/error handling and explicit deletion of a test record.

<a id="pp-022"></a>

### PP-022 — Integrate the official Meta provider with structured output

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-004](#pp-004)

**Outcome:** Call Meta directly with a bounded application contract.

**Scope:** Implement server-only provider configuration, a configurable verified model, schema adaptation, bounded output and provider error translation. Keep the provider interface separate from UI code.

**Acceptance criteria:**

- [x] Requests go to the official configured Meta endpoint with no browser-visible key.
- [x] Missing configuration, invalid credentials, rate limits, malformed output and timeouts map to useful product states.
- [x] No routine test or slider interaction triggers a paid request.

**Verification:** Use provider contract fixtures plus one bounded live integration check after PP-004 succeeds.

<a id="pp-023"></a>

### PP-023 — Plan source-grounded figures with Meta

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-016](#pp-016), [PP-020](#pp-020), [PP-022](#pp-022)

**Outcome:** Automatically choose useful figures and their place in an unfamiliar paper.

**Scope:** Provide catalog capabilities, supported engines and cited source blocks to the model. Request English explanations, insertion anchors, bounded controls, assumptions and suitable conceptual fallbacks.

**Acceptance criteria:**

- [x] Figure choices are based on the paper and declared engine capabilities, not keyword renaming of unrelated demos.
- [x] An unsupported algorithm receives a grounded schematic rather than fabricated executable behavior.
- [x] Document instructions cannot override system constraints or request arbitrary code execution.

**Verification:** Evaluate supported, unfamiliar and deliberately adversarial passages; inspect placement and scientific relevance manually.

<a id="pp-024"></a>

### PP-024 — Validate generated figures and source grounding

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-023](#pp-023)

**Outcome:** Activate only well-formed and source-linked additions.

**Scope:** Validate schema, anchor existence, quoted passage/page consistency, parameter bounds, engine compatibility, data sizes and evidence-policy eligibility. Preserve original source blocks independently.

**Acceptance criteria:**

- [x] Invalid results never execute or mutate the source paper.
- [x] Missing or contradictory anchors are rejected with a recoverable state.
- [x] A valid but non-executable explanation can degrade to a labeled schematic without invented metrics.

**Verification:** Test unsupported engine IDs, injected markup, excessive data, invalid quotes, wrong pages and incompatible parameters.

<a id="pp-025"></a>

### PP-025 — Implement resumable background analysis jobs

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-021](#pp-021), [PP-022](#pp-022), [PP-024](#pp-024)

**Outcome:** Keep long model work recoverable after refresh or a dropped connection.

**Scope:** Expose start/status/cancel routes using tested Meta background primitives. Persist job references before polling, validate final output on retrieval and handle expiry. Distinguish local pipeline checkpoints from provider execution.

**Acceptance criteria:**

- [x] Refresh or network loss resumes the existing job instead of automatically starting a second paid request.
- [x] Queued, running, completed, failed, incomplete, cancelled and expired states are handled.
- [x] An uncertain submission outcome is explicit: retry is not silently treated as duplicate-safe without provider support.

**Verification:** Use lifecycle fixtures and a bounded live test covering refresh, delayed status, cancellation and ambiguous submission.

<a id="pp-026"></a>

### PP-026 — Connect PDF import, analysis progress and inline figure assembly

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-008](#pp-008), [PP-017](#pp-017), [PP-018](#pp-018), [PP-020](#pp-020), [PP-025](#pp-025)

**Outcome:** Deliver the complete automatic reading-enrichment path.

**Scope:** Build import controls and real stage progression for extraction, context preparation, Meta analysis, validation and figure assembly. Attach validated additions to the original normalized source.

**Acceptance criteria:**

- [x] A new supported PDF reaches a usable augmented paper without manual fixture editing.
- [x] Progress reflects observable stages rather than invented percentages.
- [x] Cancel/retry behavior is clear; failures retain usable source content and prepared demos.

**Verification:** Exercise success, malformed input, provider failure, cancelled work, unsupported method and reload paths in the browser.

## M3 — Persistence, questions, sharing and budget

**Completion evidence:** [M3 report](m3-report.md). Local production endpoints and multi-process quotas verified; no remote Redis/public deployment is claimed.

<a id="pp-027"></a>

### PP-027 — Answer contextual questions about a passage or figure

Priority: **P1** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-022](#pp-022), [PP-024](#pp-024), [PP-026](#pp-026)

**Outcome:** Help a reader explain a specific observation without turning the product into general chat.

**Scope:** Add a contextual panel and bounded server route using the selected passage, figure assumptions and current measured state. Limit history and output; reuse source-reference validation and usage controls.

**Acceptance criteria:**

- [x] Answers cite the source or identify an interpretation based on the actual run.
- [x] Changing selection does not silently reuse unrelated figure context.
- [x] Unrun experiments, unsupported claims and provider errors are handled honestly.

**Verification:** Ask about a selected equation, an actual parameter change and an unexecuted result; verify context, provenance and bounded usage.

<a id="pp-028"></a>

### PP-028 — Restore reading and experiment state locally

Priority: **P1** · Status: completed · Effort: **1–3 focused hours**

**Depends on:** [PP-021](#pp-021), [PP-026](#pp-026)

**Outcome:** Make the local library useful across sessions.

**Scope:** Autosave reading position, selected figure, input, seed and parameter state. Add a small recent-papers view, reopen and delete actions without adding account features.

**Acceptance criteria:**

- [x] Reopening restores the same compatible experiment state and source position.
- [x] Old schema/engine versions are detected rather than silently changing outcomes.
- [x] Deleting a paper removes its associated local records or clearly states what remains.

**Verification:** Check refresh, application restart, missing source, migration and record deletion.

<a id="pp-029"></a>

### PP-029 — Share versioned experiment snapshots through URLs

Priority: **P1** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-009](#pp-009), [PP-028](#pp-028)

**Outcome:** Let another reader reopen the same compatible input and controls.

**Scope:** Serialize small snapshots with source reference, figure spec or stable reference, engine/schema version, compact data or data reference, seed and parameters. Validate and bound decoded payloads.

**Acceptance criteria:**

- [x] A clean browser reopens a public demo snapshot with the same deterministic outcome.
- [x] Unsupported versions, corrupt payloads and excessive decoded sizes fail gracefully.
- [x] A URL never claims to transfer a PDF stored only on the sender’s device.

**Verification:** Round-trip public snapshots between independent browser contexts and test malicious/oversized/version-mismatched payloads.

<a id="pp-030"></a>

### PP-030 — Export and import local experiment bundles

Priority: **P1** · Status: completed · Effort: **1–3 focused hours**

**Depends on:** [PP-021](#pp-021), [PP-029](#pp-029)

**Outcome:** Support snapshots too large for URLs and private local sources.

**Scope:** Provide a versioned downloadable bundle with documented contents. Require explicit source inclusion, distinguish metadata-only exports and validate imported data before use.

**Acceptance criteria:**

- [x] Large experiment state can be moved between browsers through a file.
- [x] The export makes inclusion of source text/PDF explicit and retains attribution.
- [x] Missing source, incompatible engines and damaged bundles produce usable errors.

**Verification:** Export/reimport metadata-only and source-inclusive bundles and inspect the contents and resulting state.

<a id="pp-031"></a>

### PP-031 — Bound hosted usage and isolate anonymous analysis access

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-022](#pp-022), [PP-025](#pp-025)

**Outcome:** Make a public demonstration practical with a shared provider credit budget.

**Scope:** Implement server-side input/output bounds, usage limits and ownership capabilities for anonymous job retrieval/cancellation. Configure provider/project limits or a reliable quota store where required; process memory alone is insufficient in a distributed deployment.

**Acceptance criteria:**

- [x] One browser cannot retrieve or cancel another browser’s job by guessing/changing a job ID.
- [x] Limits apply to creation and future contextual-question routes; excessive calls fail before new paid work.
- [x] Shared credentials and full paper contents do not appear in client bundles or routine logs.

**Verification:** Exercise two anonymous sessions, quota exhaustion and direct endpoint calls. Verify deployed quota behavior, not just UI button disabling.

<a id="pp-032"></a>

### PP-032 — Report real usage, job failures and analysis reuse

Priority: **P1** · Status: completed · Effort: **1–3 focused hours**

**Depends on:** [PP-022](#pp-022), [PP-025](#pp-025), [PP-031](#pp-031)

**Outcome:** Make spending and failures understandable during the hackathon.

**Scope:** Surface available token usage, analysis/model version, cache reuse and provider failures without logging private source bodies. Add an operator-friendly usage summary and document provider billing as the source of truth.

**Acceptance criteria:**

- [x] Repeated reopening reuses a saved compatible analysis.
- [x] Usage is labeled as measured, estimated or unavailable; no invented remaining-credit balance is displayed.
- [x] An operator can distinguish extraction, provider and validation failures.

**Verification:** Inspect a reused analysis, a new result with usage fields and failure fixtures with sensitive values absent.

## M4 — Validation, deployment and delivery

<a id="pp-033"></a>

### PP-033 — Verify keyboard, responsive and reduced-motion behavior

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-017](#pp-017), [PP-026](#pp-026)

**Outcome:** Keep the complete reading and figure flow accessible.

**Scope:** Review focus order, control labels, contrast, non-color state cues, reduced motion, narrow screens and error announcements. Fix observed issues rather than add redundant cosmetic tests.

**Acceptance criteria:**

- [x] Import, reading navigation and figure playback work by keyboard.
- [x] Meaningful figure state has a textual equivalent.
- [x] Mobile-width reading and large equations do not make essential controls unreachable.

**Verification:** Perform manual keyboard and reduced-motion walkthroughs plus browser checks at desktop and narrow widths.

**Completion evidence:** [accessibility-report.md](accessibility-report.md).

<a id="pp-034"></a>

### PP-034 — Evaluate unseen-paper quality and user understanding

Priority: **P0** · Status: completed · Effort: **3–5 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-026](#pp-026), [PP-033](#pp-033)

**Outcome:** Demonstrate that Paperplay helps beyond its prepared examples.

**Scope:** Run the held-out corpus through automatic enrichment and inspect extraction, relevance, source grounding, fallback behavior and scientific claims. Give a small number of engineers/students a concrete understanding task.

**Acceptance criteria:**

- [x] A scorecard distinguishes successes, known limits and unsupported cases.
- [x] At least one unseen supported paper produces a relevant cited figure without manual source-code editing.
- [x] Observed misunderstandings and failed scientific claims are recorded and triaged before the demonstration.

**Verification:** Record actual observations and task outcomes; never claim a user study occurred without participants. Use self-review as explicitly weaker interim evidence if unavailable.

**Completion evidence:** [evaluation-report.md](evaluation-report.md), [evaluation-m4-baseline.json](evaluation-m4-baseline.json).

<a id="pp-035"></a>

### PP-035 — Prepare open source documentation, licenses and attribution

Priority: **P0** · Status: completed · Effort: **2–3 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-017](#pp-017), [PP-026](#pp-026)

**Outcome:** Let another developer run and extend the project.

**Scope:** Write a truthful README, environment example, installation/demo commands, architecture map, current limitations and a small figure/engine extension guide. Choose a project license and retain demo-source/dependency attribution.

**Acceptance criteria:**

- [x] A clean checkout can run the prepared demo without API credentials.
- [x] Official Meta setup, sending source content for analysis and local-storage behavior are explained.
- [x] The manifest license and license file agree; bundled papers/figures have recorded permissions.

**Verification:** Follow the README from a clean environment and review the extension example and attribution inventory.

**Completion evidence:** [README.md](../README.md), [LICENSE](../LICENSE), [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt), [clean-install-report.md](clean-install-report.md).

<a id="pp-036"></a>

### PP-036 — Deploy and smoke-test the hosted and local demonstration

Priority: **P0** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-005](#pp-005), [PP-026](#pp-026), [PP-031](#pp-031), [PP-033](#pp-033), [PP-035](#pp-035)

**Outcome:** Make the judged experience reliably accessible.

**Scope:** Deploy the Next application to the selected host within available free allowances. Configure server secrets, request limits and provider access; verify worker assets, background retrieval and prepared-demo fallback.

**Acceptance criteria:**

- [x] The hosted URL opens the prepared paper and a genuine Meta-backed import succeeds when configured.
- [x] Local and hosted behavior agree on supported capabilities; production build/start is documented.
- [x] Provider/network failure leaves the prepared example usable and gives a useful live-import error.

**Verification:** Run a production browser smoke test, a real bounded provider request and a network/provider-failure rehearsal. Record deployment limits and URL.

**Completion evidence:** [deployment.md](deployment.md), [hosted-quota-smoke.json](hosted-quota-smoke.json), [hosted-live-smoke.json](hosted-live-smoke.json).

<a id="pp-037"></a>

### PP-037 — Rehearse and package the English hackathon demonstration

Priority: **P0** · Status: implemented-awaiting-external-acceptance · Effort: **2–3 focused hours**

**Depends on:** [PP-034](#pp-034), [PP-036](#pp-036)

**Outcome:** Show the product’s strongest behavior and its real Meta integration.

**Scope:** Prepare the English narrative, screenshots and required demo video/submission material. Demonstrate reading, a meaningful parameter change, a real comparison, source grounding and Meta-selected enrichment; include a fallback scenario.

**Acceptance criteria:**

- [x] The live script and video describe implemented capabilities accurately.
- [ ] The demo fits the current portal requirements, which are rechecked before submission.
- [x] Rehearsal covers a cold browser and a provider failure; remaining defects have explicit dispositions.

**Verification:** Rehearse end to end and compare materials against the current submission checklist. No submission or message is sent by this planning issue.

**External gate:** Verify the authenticated submission form/media constraints and invite judges to the private Site before submission. No entry has been submitted.

**Completion evidence:** [demo-script.md](demo-script.md), [paperplay-demo.mp4](../artifacts/paperplay-demo.mp4), [submission-draft.md](submission-draft.md).

<a id="pp-038"></a>

### PP-038 — Validate the complete agreed MVP and close release gaps

Priority: **P1** · Status: implemented-awaiting-external-acceptance · Effort: **2–3 focused hours**

**Depends on:** [PP-019](#pp-019), [PP-027](#pp-027), [PP-029](#pp-029), [PP-030](#pp-030), [PP-032](#pp-032), [PP-034](#pp-034), [PP-036](#pp-036), [PP-037](#pp-037), [PP-039](#pp-039)

**Outcome:** Distinguish a hackathon candidate from completion of all accepted product requirements.

**Scope:** Run the product-spec acceptance criteria including arXiv, contextual questions, local restoration, URL/file snapshots, scientific evidence and both algorithm families. Fix or explicitly defer gaps without silently relabeling the scope.

**Acceptance criteria:**

- [ ] Every agreed acceptance criterion has concrete verification evidence.
- [x] No P0/P1 omission is presented as completed; agreed deferrals are documented separately.
- [x] A versioned release records model, schema and engine compatibility and known limitations.

**Verification:** Use a fresh browser and clean production build; rerun only checks affected by fixes. Publishing a release is a separate authorized action when requested.

**External gate:** Verify the authenticated submission form/media constraints and invite judges to the private Site before submission. No entry has been submitted.

**Completion evidence:** [acceptance-matrix.md](acceptance-matrix.md), [release-v1.1.0.md](release-v1.1.0.md).

<a id="pp-039"></a>

### PP-039 — Reproduce one original experiment when evidence permits

Priority: **P1** · Status: completed · Effort: **3–6 focused hours**

**Depends on:** [PP-001](#pp-001), [PP-010](#pp-010), [PP-014](#pp-014), [PP-016](#pp-016), [PP-034](#pp-034)

**Outcome:** Pursue the requested scientific fidelity beyond mechanism illustration.

**Scope:** Audit one demo paper for a feasible original dataset/protocol. If available, implement a bounded experiment with reference metrics, tolerances and environment notes; otherwise document the missing evidence and retain the lower fidelity label.

**Acceptance criteria:**

- [x] A successful reproduction includes source protocol, data provenance, versions, parameters and measured comparison.
- [x] A failed or infeasible reproduction is reported as such, not converted into a success by model output.
- [x] The general product remains usable with an honestly simplified illustration when replication is impossible.

**Verification:** Compare measured output against the documented reference and tolerance; independently review the evidence report.

## M5 — Optional extensions after the agreed MVP

**Completion evidence:** [reproduction-audit.md](reproduction-audit.md), [reproduction-merge-cost.json](reproduction-merge-cost.json).

<a id="pp-040"></a>

### PP-040 — Extend the figure catalog with matrices and convergence plots

Priority: **P2** · Status: completed · Effort: **3–6 focused hours**

**Depends on:** [PP-003](#pp-003), [PP-011](#pp-011), [PP-024](#pp-024), [PP-038](#pp-038)

**Outcome:** Broaden visual coverage after the core product works.

**Scope:** Add matrix/heatmap and mathematical-plot renderers only against selected paper concepts. Update capability descriptions, source examples and accessible summaries.

**Acceptance criteria:**

- [x] New figure kinds use existing anchoring, controls, snapshots and validation.
- [x] Displayed values are identified as computed, source-reported or illustrative.
- [x] At least one real paper exercises each new renderer.

**Verification:** Validate numeric domains, missing values, labels, keyboard interaction and snapshot compatibility.

**Completion evidence:** [engine-extension.md](engine-extension.md), [numeric.test.ts](../tests/numeric.test.ts).

<a id="pp-041"></a>

### PP-041 — Add a third algorithm family through the public extension interface

Priority: **P2** · Status: completed · Effort: **3–6 focused hours**

**Depends on:** [PP-009](#pp-009), [PP-016](#pp-016), [PP-035](#pp-035), [PP-038](#pp-038)

**Outcome:** Verify that external contributors can extend engines without changing the reader.

**Scope:** Choose a third family from evaluation demand and implement its engine, reference checks, capability declaration and sample source through the documented interface.

**Acceptance criteria:**

- [x] The reader and generic renderers need no algorithm-name branches.
- [x] Reference cases and compatibility/evidence declarations are provided.
- [x] A contributor can reproduce the extension steps from the guide.

**Verification:** Run engine invariants and inspect a real augmented-paper example using the extension.

**Completion evidence:** [engine-extension.md](engine-extension.md), [numeric-paper.ts](../data/numeric-paper.ts).

<a id="pp-042"></a>

### PP-042 — Move expensive simulations off the UI thread

Priority: **P2** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-009](#pp-009), [PP-015](#pp-015), [PP-038](#pp-038)

**Outcome:** Scale supported computations when measured interaction latency justifies it.

**Scope:** Profile representative larger inputs; add a versioned Web Worker execution bridge with cancellation, progress and transfer limits for engines that need it.

**Acceptance criteria:**

- [x] A documented input that previously blocked interaction remains responsive.
- [x] Worker and direct execution return the same semantic result.
- [x] Cancellation and operation limits stop work without stale results replacing a newer run.

**Verification:** Measure main-thread responsiveness and check direct/worker equivalence and cancellation races.

**Completion evidence:** [performance-worker.md](performance-worker.md), [browser-worker-profile.json](browser-worker-profile.json).

<a id="pp-043"></a>

### PP-043 — Improve source reconstruction for difficult scientific PDFs

Priority: **P2** · Status: completed · Effort: **4–8 focused hours**

**Depends on:** [PP-018](#pp-018), [PP-019](#pp-019), [PP-020](#pp-020), [PP-034](#pp-034), [PP-038](#pp-038)

**Outcome:** Increase supported import quality based on observed corpus failures.

**Scope:** Address ranked problems in multi-column reading order, equations, captions and figure placement. Use additional parsing only with a clear quality gain; scanned-PDF OCR remains outside the accepted scope.

**Acceptance criteria:**

- [x] Before/after extraction quality is measured on a fixed difficult corpus.
- [x] Unsupported content remains visible rather than reconstructed without provenance.
- [x] Improved source mappings retain compatibility or explicitly invalidate stale analyses.

**Verification:** Compare document structure with originals and regression fixtures; record remaining classes of unsupported PDF.

**Completion evidence:** [pdf-reconstruction.md](pdf-reconstruction.md), [pdf-layout-results.json](pdf-layout-results.json).

<a id="pp-044"></a>

### PP-044 — Design optional durable short links for large snapshots

Priority: **P2** · Status: completed · Effort: **3–6 focused hours**

**Depends on:** [PP-029](#pp-029), [PP-030](#pp-030), [PP-031](#pp-031), [PP-038](#pp-038)

**Outcome:** Explore sharing beyond compact URLs and manual export files.

**Scope:** Evaluate opt-in server storage, retention, deletion, access capabilities, cost and source permissions before adding a central snapshot store. Keep existing local-first usage available.

**Acceptance criteria:**

- [x] A concrete storage/cost/privacy design exists before implementation.
- [x] Any stored snapshot has explicit inclusion rules, expiration and deletion behavior.
- [x] No account requirement or automatic upload of local papers is introduced without a product decision.

**Verification:** Review the design against existing snapshot behavior and available hosting allowances; prototype only after the extension is selected.

**Completion evidence:** [short-links.md](short-links.md), [hosted-quota-smoke.json](hosted-quota-smoke.json).

<a id="pp-045"></a>

### PP-045 — Plan operation after hackathon credits expire

Priority: **P2** · Status: completed · Effort: **2–4 focused hours**

**Depends on:** [PP-004](#pp-004), [PP-031](#pp-031), [PP-032](#pp-032), [PP-035](#pp-035), [PP-038](#pp-038)

**Outcome:** Keep the open source project useful after the event.

**Scope:** Document a maintainable hosting and inference approach: configured official Meta key, explicit disabled live analysis when funding ends, and a separately evaluated optional open-model adapter if wanted. Recheck provider terms and actual costs.

**Acceptance criteria:**

- [x] The prepared example and saved local papers remain usable without active credits.
- [x] Funding expiry does not silently incur unwanted charges.
- [x] Alternative inference is clearly optional and does not replace the official Meta integration by accident.

**Verification:** Exercise the no-credit/no-key state and review the operational instructions with actual provider settings.


**Completion evidence:** [operations.md](operations.md), [operations.test.ts](../tests/operations.test.ts).
