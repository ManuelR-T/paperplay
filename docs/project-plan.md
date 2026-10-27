# Paperplay — delivery plan

Planning date: 26 October 2026. Owner: one developer. Status: M0–M3 completed locally on 27 October; M4–M5 remain planned. See [M0 evidence](m0-report.md), [M1 evidence](m1-report.md), [M2 evidence](m2-report.md) and [M3 evidence](m3-report.md).

## Deliverables and tracking

- [Detailed backlog](backlog.md): 45 implementation issues with outcomes, scope, acceptance criteria, verification and dependencies.
- [Machine-readable backlog](backlog.json): the same issue definitions, local IDs and a valid dependency order.
- [Interactive roadmap](roadmap.html): searchable and filterable view of the issues.
- [Accepted product scope](product-spec.md), [domain vocabulary](../CONTEXT.md) and [technology research](technology-research.md).

PP-001 through PP-045 are local planning identifiers. No GitHub issues have been published by this planning work. The 32 M0–M3 issues are complete locally with recorded evidence; the remaining 13 are planned. Prepared sources, deterministic computations, bounded import, Meta enrichment, contextual questions, local restoration, sharing and durable usage controls are available. Actual distributed Redis/hosting verification remains a deployment gate in M4. When creating tracker issues, retain these IDs, copy the issue body and replace dependency references with the resulting tracker links. Do not create duplicates on retries.

## Delivery boundaries

**P0 — hackathon release candidate:** 31 issues covering two source-linked algorithm examples, generic graph/array/step figures, actual comparisons, scientific labels, PDF import, official Meta analysis, resumable background work, local analysis checkpoints, hosted usage bounds, accessibility, evaluation, deployment and an English demonstration.

**P1 — completion of the agreed MVP:** 8 issues adding structured arXiv import, contextual questions, complete local restoration, URL/file snapshots, usage reporting, the original-experiment feasibility/reproduction task and full acceptance verification. These were accepted in the product framing. Giving them a later position does not remove them from scope. P0 alone must be described as a release candidate, not the finished agreed MVP.

**P2 — optional extensions:** 6 issues for additional renderers and engines, expensive-computation workers, difficult-PDF reconstruction, optional durable short links and operation after credits expire. They must not delay the agreed MVP. Their inclusion in this backlog does not authorize a new paid service or change the local-first product by itself.

Explicitly excluded: arbitrary model-generated code execution, training, scanned-PDF OCR, real-time collaboration, a native mobile app, user accounts, billing and unrestricted paper discovery. There is no automatic promise to reproduce every published experiment.

## Effort and capacity

Estimates are focused implementation and verification hours for the selected scope. They are planning ranges, not promises, and are conditional on tractable corpus and API results. Account setup, unavailable datasets, waiting for credentials or user feedback, and unanticipated parser failures can add elapsed time. Existing scaffolding has not been counted as completed work.

- P0: **68–123 hours**; with 25% contingency, approximately **85–154 hours**.
- P1 increment: **16–33 hours**.
- Complete P0 + P1: **84–156 hours**; with 25% contingency, **105–195 hours**.
- P2 extensions: **17–34 additional hours**, before contingency; optional and independently selectable.

At eight focused hours per working day, the full MVP represents about **14–25 working days** after rounding up. At six hours per day, about **18–33 working days**. Real personal availability remains unspecified. These ranges are not a recommendation to work extreme hours for the event.

The official event page lists submission on 4 November at 21:00 ET. Recheck the portal's current requirements before delivery. A ten-day event window does not justify silently compressing the estimates into ten days. [Official event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon).

Measure actual throughput after M0 and the first complete reading experience, then re-estimate the remaining work. If the event deadline is fixed, use the reduction options below and clearly state what the submission actually includes.

## Milestones and exit gates

### M0 — establish the foundation and resolve integration risk

Issues: [PP-001](backlog.md#pp-001)–[PP-005](backlog.md#pp-005). Effort: **9–17 hours**.

Choose sources from two algorithm families and an unseen-paper corpus. Replace the abandoned scaffold with a clean runnable Next application. Define versioned contracts and verify official Meta capabilities early; wire baseline checks into CI.

Exit gate: the prepared shell builds, source/figure/engine contracts work for two families, and a tiny real Meta background/schema request either succeeds or has an explicit external blocker. A missing key blocks only provider-dependent tasks, not the reader and engine work.

### M1 — demonstrate the product using prepared sources

Issues: [PP-006](backlog.md#pp-006)–[PP-017](backlog.md#pp-017). Effort: **26–46 hours**.

Build faithful normalized source fixtures, the reformatted reader, inline anchoring, deterministic execution, reusable trace controls, graph and array/step figures, two algorithm families and compatible comparisons. Derive evidence labels from actual checks.

Exit gate: a reader can manipulate ideas in two different papers, replay the algorithm, compare real measurements and return to the source. The team must describe the sources as prepared at this stage; this gate does not prove automatic import.

### M2 — enrich an imported paper through Meta

Issues: [PP-018](backlog.md#pp-018)–[PP-026](backlog.md#pp-026). Effort: **22–42 hours**, including the P1 arXiv task.

Extract PDFs with page provenance, normalize context, persist checkpoints, integrate official Meta structured output, select/anchor figures, validate results and connect background start/status/cancel to the import flow. Add structured arXiv ingestion as the P1 source adapter.

Exit gate: a new supported document produces useful source-linked additions without manual fixture editing. Reloading resumes accepted model work. Unsupported methods receive a labeled explanatory fallback. Original text remains distinct from generated content.

### M3 — complete persistence, questions, sharing and cost controls

Issues: [PP-027](backlog.md#pp-027)–[PP-032](backlog.md#pp-032). Effort: **11–23 hours**.

Add source-aware contextual questions, complete reading/parameter restoration, small versioned URL snapshots and explicit export/import for larger local content. Protect hosted anonymous jobs and bound spending; distinguish actual usage from estimates.

Exit gate: another clean browser can reproduce a compatible shared experiment, local documents are not assumed to exist remotely, and hosted API access cannot read or cancel another anonymous session's work.

### M4 — validate, deploy and prepare delivery

Issues: [PP-033](backlog.md#pp-033)–[PP-039](backlog.md#pp-039). Effort: **16–28 hours**.

These activities start as soon as their dependencies permit, rather than all waiting for the end. Review keyboard/mobile/reduced-motion behavior, evaluate held-out papers, document the open source project, deploy and rehearse the English demo. Audit one original experiment and reproduce it only if the required evidence is available. Close the full-MVP acceptance gate after P1 features land.

Exit gates are separate: PP-037 produces a demonstrable hackathon candidate; PP-038 establishes completion of all accepted MVP requirements. An original experiment that cannot be reproduced must have an honest evidence report and lower fidelity label.

### M5 — selectively extend the open source project

Issues: [PP-040](backlog.md#pp-040)–[PP-045](backlog.md#pp-045). Effort: **17–34 hours** before contingency.

Select extensions from observed demand. Do not start all six as a new mandatory release. Extra renderers and engines must use existing contracts; expensive workers and advanced extraction should address measured problems.

## Dependency spine and solo execution order

The complete dependency graph is in backlog.json. It has no cycles, and no P0 issue depends on a P1/P2 issue. Milestone numbers organize outcomes; they are not a requirement to finish every task in one milestone before starting any task in the next.

The main prerequisite spine is:

1. PP-002 → PP-003: runnable Next shell and versioned contracts.
2. PP-001 + PP-006 → PP-007 → PP-008: faithful papers and anchored reading.
3. PP-009 → PP-010/PP-014 + PP-011 → PP-012/PP-013 → PP-015/PP-016 → PP-017: trustworthy reusable interaction.
4. PP-004 → PP-022, alongside PP-018 → PP-020: verified provider and source context.
5. PP-023 → PP-024 → PP-025, with PP-021 checkpoints: automatic planning, validation and recoverable model work.
6. PP-017 + PP-025 → PP-026 → PP-034: complete import experience and unseen-paper evaluation.
7. PP-031 + PP-033 + PP-035 + PP-036 → PP-037: bounded hosted access, usable delivery and rehearsed demo.
8. P1 completion and PP-039 evidence report → PP-038: agreed MVP acceptance.

For one developer, finish one active implementation issue at a time and prefer small complete user journeys. Dependencies that could run in parallel do not create additional solo capacity. Independent work can proceed while waiting for a real external prerequisite.

## Conditional deadline reductions

These are explicit alternatives if measured capacity is insufficient, not accepted scope changes or completion claims:

- Keep P1 visibly open for the event candidate; the agreed MVP remains unfinished until those issues close.
- Limit demonstrations and verified engines to the two selected families; unfamiliar papers can use source-grounded diagrams/steps.
- Keep modest input sizes and direct browser execution before implementing P2 workers.
- Prefer a faithful readable PDF excerpt with an explicit original-source fallback over claiming perfect reconstruction of every equation/figure.
- If automatic import is not reliable, demonstrate prepared sources and describe that limitation; do not claim the automatic-paper acceptance criterion has passed.
- Do not trade away source attribution, honest scientific labels, real computations or secret handling for cosmetic polish.

If these reductions still do not fit, choose a narrower demo claim instead of scheduling unachievable work. The first capacity checkpoint is M0; the second is PP-017.

## Requirement coverage

- Generic algorithm papers, two families, catalog selection and honest unsupported cases: PP-001, PP-003, PP-009–PP-017, PP-023, PP-024, PP-034.
- Original paper reformatted in English, inline added figures and source navigation: PP-006–PP-008, PP-018–PP-020, PP-026.
- Animation, interactive graphs and actual method comparisons: PP-010–PP-015.
- Scientific reproduction when possible, simplification otherwise, seeded data and provenance: PP-001, PP-009, PP-016, PP-034, PP-039.
- Official Meta integration, grounded explanations and contextual questions: PP-004, PP-022–PP-027.
- Real progress, cancellation and asynchronous recovery: PP-020, PP-021, PP-025, PP-026.
- Local persistence with no accounts and parameter restoration: PP-021, PP-028.
- Share exact compatible experiment state, including the local-PDF limitation: PP-029, PP-030.
- Small credit budget and a hosted anonymous demo: PP-022, PP-031, PP-032, PP-036.
- Editorial UI, desktop-first responsive use, accessibility: PP-007, PP-008, PP-011–PP-013, PP-033.
- New-paper quality, understanding and live-demo success: PP-034, PP-036–PP-038.
- Open source operation, attribution and extension: PP-035; optional PP-041 and PP-045.

## Common issue completion rule

An issue closes when its acceptance criteria are satisfied with concrete evidence, appropriate checks pass and relevant user/developer documentation is updated. Scientific labels require reference evidence, not merely plausible model output. Browser behavior requires a browser check when available. Live provider calls are bounded and never part of every CI run.

Mark externally blocked issues with the exact missing prerequisite. No API key is requested through an issue body. Never mark a task complete because a file exists, a mock succeeds or the event deadline has arrived.

## Release checks

Before the event candidate: verify prepared and imported flows, both families, unsupported-method fallback, original-source navigation, refresh during a model job, provider failure, anonymous-job isolation, request/usage limits, responsive controls, production build and the English demonstration.

Before declaring the full agreed MVP complete: additionally verify arXiv import, contextual questions with current run context, reading/parameter restoration, URL/file snapshot round trips, real usage reporting and the experiment-evidence report. Recheck all product-spec acceptance criteria through PP-038.
