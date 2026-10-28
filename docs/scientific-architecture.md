# Scientific representation architecture — M12–M16

Status: **implementation in progress — PP-081–092 implemented (12/36)**, 28 October 2026. Parent epic: [PP-080 · #35](https://github.com/ManuelR-T/paperplay/issues/35). Completed work and evidence: [representation contracts](representation-contracts.md), [scientific provenance](research-evidence.md) [typed local data](scientific-assets.md) and [scientific quantities](scientific-quantities.md) and [approved capability registry](representation-capabilities.md) and [scientific intake corpus](scientific-corpus.md) and [composed figure layouts](composed-scenes.md) and [linked semantic selections](semantic-selections.md) and [process/network explanations](process-networks.md) and [statistical charts](statistical-charts.md) and [spatial images and fields](spatial-views.md) and [arguments and protocols](reasoning-guides.md). The 36 implementation issues and their GitHub references are also recorded in [scientific-backlog.json](scientific-backlog.json). This program extends the existing [M6–M11 delivery](next-roadmap.md); it does not reopen completed issues or change the deferred Railway release.

## Product objective

Make any scientific paper eligible for a useful, source-linked research representation, without assuming every paper is executable or fully reproducible. Biology, physics and computer science are the initial cross-domain evaluation targets; extension interfaces must also admit later fields such as chemistry, geoscience and astronomy.

A representation may be an interactive simulation, annotated original figure, explorable dataset, process map, derivation, argument or experimental protocol. The system records partial coverage, missing inputs and unsupported capabilities. It must never equate an explanation of one concept with complete coverage of a paper, or a successful animation with scientific verification.

This is an open-ended extension architecture and a measurable coverage program. No finite implementation or corpus can establish faithful simulation of absolutely all present and future scientific research.

## Shared vocabulary

- **Research representation:** a source-linked learning experience exposing a paper's concepts, evidence or method through figures, data, annotations or reasoning steps.
- **Representation plan:** the proposed concepts, source anchors, data, reader interactions and evidence level for that experience.
- **Capability gap:** a named unmet data, computation or interaction requirement at the intended evidence level.
- **Representation coverage:** the recorded represented, partial and unresolved scope of selected concepts and passages.

## Existing implementation to retain

- Next.js/TypeScript/shadcn reading, imported and prepared sources, original figures and exact source anchors.
- Ten declarative widget families, the bounded custom recurrence/scene runtime and trusted worker execution.
- Official Meta Muse section planning, inspectable proposals, acceptance, local editing, repair and inference quotas.
- Local notes, library, portable state, study packs, recovery and source/evidence distinctions.

The current custom runtime has 8 parameters, 8 state registers, at most 120 steps, 24 scene elements and 80,000 operations. It has seven primitives plus optional opacity and layout. These are current limits, not a proposed universal scientific language. Generated code is not executed by the current product.

## Proposed modules and interfaces

The names below describe planned seams, not new implementations claimed to exist today. Start with real variants and integration cases; do not add an abstract framework merely to wrap the current code.

| Module | Small external interface | Behavior behind it |
| --- | --- | --- |
| Representation planning | Source/concept scope, reader intent, available capabilities and budget → plan or explicit gaps | Relevant capability/recipe retrieval, data requirements, source/evidence mapping, modality choice and bounded Muse generation |
| Artifact building | Versioned plan/artifact manifest and approved assets → immutable artifact or build diagnostics | Declarative compilation or isolated generated-code build, pinned dependencies, SDK checks, content hashes and provenance |
| Execution | Validated artifact, inputs, parameters, seed and resource policy → bounded result/trace or structured failure | Trusted numerical/discrete adapters, sandbox host, scheduling, cancellation, reproducibility and optional brokered external jobs |
| Representation rendering | Validated result, composed-view specification and semantic selection → reader experience | Responsive layouts, annotation, chart/2D/3D adapters, accessible values, linked interaction and host-owned failure/stop controls |

Shared contracts describe source anchors, typed assets, quantities/units, scientific evidence, capability gaps and coverage. The reader consumes those contracts rather than switching on discipline names. Existing widgets remain one concrete adapter; composed annotations/data views provide another. Computation adapters and renderers remain independently replaceable.

## Planning and artifact lifecycle

1. Identify a specific source concept and desired explanatory purpose. Preserve the original text and assets.
2. Resolve the required data, supported controls, numerical methods and available execution/rendering adapters.
3. Prefer an existing declarative/trusted representation when it fits. Otherwise propose an isolated generated artifact or explain the capability gap.
4. Validate source grounding, data shape/units, requested capabilities and resource policy before building.
5. Build, execute and inspect through the applicable trusted or isolated path. Record independent scientific checks separately from build/visual checks.
6. Present a preview, assumptions, provenance and evidence level. Acceptance saves exact artifact/input versions; replay and parameter changes remain provider-free.
7. If a path fails, preserve the paper and valid work, expose the unmet requirement and offer a justified lower-evidence representation.

A generated test can help detect coding errors. It does not independently validate the model that generated it. Likewise, an observed dataset, fitted curve, simulated mechanism and illustrative numbers need separate provenance, even when they share one visual.

## Generated-artifact scope expansion

Earlier product scope and [CONTRIBUTING.md](../CONTRIBUTING.md) exclude running model-provided JavaScript. The owner requested this new architecture program on 28 October 2026. M14 plans a separate, explicitly gated execution path; it does not authorize bypassing the current trusted-worker policy or claim that a sandbox has already been selected or implemented.

The isolation spike must evaluate compilation, runtime, rendering and host communication. Model-authored code must not run in the application server process or existing trusted worker. A normal iframe, Worker, Node vm or container is not accepted as sufficient isolation by itself. Select actual adapters only after primary-source investigation and adversarial tests establish the required guarantees.

Generated artifacts request a limited capability set through a versioned manifest. Host-owned attribution, stop/error UI, data access and evidence state stay outside the artifact. No arbitrary network, secrets, host storage or inference access is implied. A remote compute broker, if later added, is an explicit user action with reviewed adapters and a run budget; it is not a privilege granted to generated code.

## Delivery order

The issue dependency graph is authoritative. Priorities do not bypass prerequisites. Each large issue should be split into reviewable increments during implementation.

### M12 — Shared scientific contracts and evidence

- [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36) — Define versioned research representation plans and execution contracts · **P0**, M. Dependencies: Current product baseline.
- [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37) — Track evidence and provenance for every scientific representation · **P0**, M. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36).
- [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38) — Introduce typed scientific assets and inspectable data ingestion · **P0**, M. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37).
- [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39) — Model scientific quantities, dimensions and coordinate systems · **P0**, L. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38).
- [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40) — Route plans through an extensible capability registry · **P0**, M. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38).
- [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41) — Establish a cross-domain coverage corpus and unsupported cases · **P0**, L. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38).

### M13 — Composable representations and linked interaction

- [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42) — Build a composable scene and responsive layout language · **P0**, L. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40).
- [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43) — Synchronize composed views through semantic interactions · **P0**, L. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42).
- [PP-089 · #44](https://github.com/ManuelR-T/paperplay/issues/44) — Represent processes, networks and state-machine explanations · **P1**, M. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).
- [PP-090 · #45](https://github.com/ManuelR-T/paperplay/issues/45) — Compose statistical charts with uncertainty and comparisons · **P1**, L. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).
- [PP-091 · #46](https://github.com/ManuelR-T/paperplay/issues/46) — Explore images, spatial fields and multiscale observations · **P1**, L. Dependencies: [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).
- [PP-092 · #47](https://github.com/ManuelR-T/paperplay/issues/47) — Support equations, proofs and experimental protocols without forcing simulation · **P1**, M. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41), [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).

### M14 — Muse-generated artifacts with verified isolation

- [PP-093 · #48](https://github.com/ManuelR-T/paperplay/issues/48) — Specify generated figure artifacts and a small authoring SDK · **P1**, L. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40).
- [PP-094 · #49](https://github.com/ManuelR-T/paperplay/issues/49) — Validate the isolation architecture for generated scientific code · **P0**, discovery. Dependencies: [PP-093 · #48](https://github.com/ManuelR-T/paperplay/issues/48).
- [PP-095 · #50](https://github.com/ManuelR-T/paperplay/issues/50) — Build reproducible generated artifacts in an isolated compiler · **P1**, L. Dependencies: [PP-093 · #48](https://github.com/ManuelR-T/paperplay/issues/48), [PP-094 · #49](https://github.com/ManuelR-T/paperplay/issues/49).
- [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51) — Host generated figures with a capability-limited execution bridge · **P1**, L. Dependencies: [PP-094 · #49](https://github.com/ManuelR-T/paperplay/issues/49), [PP-095 · #50](https://github.com/ManuelR-T/paperplay/issues/50), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).
- [PP-097 · #52](https://github.com/ManuelR-T/paperplay/issues/52) — Let Muse plan, generate, test and repair new figure artifacts · **P1**, L. Dependencies: [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-093 · #48](https://github.com/ManuelR-T/paperplay/issues/48), [PP-095 · #50](https://github.com/ManuelR-T/paperplay/issues/50), [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51).
- [PP-098 · #53](https://github.com/ManuelR-T/paperplay/issues/53) — Evaluate generated layout and interaction quality before presentation · **P1**, L. Dependencies: [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42), [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51), [PP-097 · #52](https://github.com/ManuelR-T/paperplay/issues/52).
- [PP-099 · #54](https://github.com/ManuelR-T/paperplay/issues/54) — Cache and version artifact builds, executions and validation reports · **P1**, M. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-095 · #50](https://github.com/ManuelR-T/paperplay/issues/50), [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51), [PP-097 · #52](https://github.com/ManuelR-T/paperplay/issues/52).

### M15 — Scientific data and execution adapters

- [PP-100 · #55](https://github.com/ManuelR-T/paperplay/issues/55) — Add a reference-tested adapter for differential and hybrid dynamics · **P1**, L. Dependencies: [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).
- [PP-101 · #56](https://github.com/ManuelR-T/paperplay/issues/56) — Add stochastic population and reaction-network experiments · **P1**, L. Dependencies: [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-089 · #44](https://github.com/ManuelR-T/paperplay/issues/44), [PP-090 · #45](https://github.com/ManuelR-T/paperplay/issues/45).
- [PP-102 · #57](https://github.com/ManuelR-T/paperplay/issues/57) — Add bounded physical fields and conservation-based examples · **P1**, L. Dependencies: [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43), [PP-091 · #46](https://github.com/ManuelR-T/paperplay/issues/46), [PP-100 · #55](https://github.com/ManuelR-T/paperplay/issues/55).
- [PP-103 · #58](https://github.com/ManuelR-T/paperplay/issues/58) — Explore molecular and structural geometry through reviewed adapters · **P1**, L. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43).
- [PP-104 · #59](https://github.com/ManuelR-T/paperplay/issues/59) — Execute discrete algorithms and variable-length structures · **P1**, L. Dependencies: [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43), [PP-089 · #44](https://github.com/ManuelR-T/paperplay/issues/44), [PP-092 · #47](https://github.com/ManuelR-T/paperplay/issues/47), [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51).
- [PP-105 · #60](https://github.com/ManuelR-T/paperplay/issues/60) — Explore empirical datasets, models and experimental outcomes · **P1**, L. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-090 · #45](https://github.com/ManuelR-T/paperplay/issues/45), [PP-092 · #47](https://github.com/ManuelR-T/paperplay/issues/47).
- [PP-106 · #61](https://github.com/ManuelR-T/paperplay/issues/61) — Define opt-in adapters for external datasets and heavy computation · **P2**, discovery. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-094 · #49](https://github.com/ManuelR-T/paperplay/issues/49), [PP-099 · #54](https://github.com/ManuelR-T/paperplay/issues/54).
- [PP-107 · #62](https://github.com/ManuelR-T/paperplay/issues/62) — Generalize the extraction and supplementary-material pathway · **P1**, L. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41), [PP-091 · #46](https://github.com/ManuelR-T/paperplay/issues/46), [PP-092 · #47](https://github.com/ManuelR-T/paperplay/issues/47).

### M16 — Coverage, validation, performance and adoption

- [PP-108 · #63](https://github.com/ManuelR-T/paperplay/issues/63) — Verify scientific behavior with independent references and invariants · **P0**, L. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-084 · #39](https://github.com/ManuelR-T/paperplay/issues/39), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41), [PP-100 · #55](https://github.com/ManuelR-T/paperplay/issues/55).
- [PP-109 · #64](https://github.com/ManuelR-T/paperplay/issues/64) — Enforce responsive execution, cancellation and reproducible runs · **P1**, L. Dependencies: [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43), [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51), [PP-099 · #54](https://github.com/ManuelR-T/paperplay/issues/54).
- [PP-110 · #65](https://github.com/ManuelR-T/paperplay/issues/65) — Provide faithful degradation and visible representation coverage · **P0**, M. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41), [PP-089 · #44](https://github.com/ManuelR-T/paperplay/issues/44), [PP-092 · #47](https://github.com/ManuelR-T/paperplay/issues/47).
- [PP-111 · #66](https://github.com/ManuelR-T/paperplay/issues/66) — Retrieve relevant capabilities and control Muse generation budgets · **P1**, M. Dependencies: [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41), [PP-093 · #48](https://github.com/ManuelR-T/paperplay/issues/48), [PP-097 · #52](https://github.com/ManuelR-T/paperplay/issues/52), [PP-099 · #54](https://github.com/ManuelR-T/paperplay/issues/54).
- [PP-112 · #67](https://github.com/ManuelR-T/paperplay/issues/67) — Share scientific experiences with complete reproducibility manifests · **P1**, M. Dependencies: [PP-082 · #37](https://github.com/ManuelR-T/paperplay/issues/37), [PP-083 · #38](https://github.com/ManuelR-T/paperplay/issues/38), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43), [PP-096 · #51](https://github.com/ManuelR-T/paperplay/issues/51), [PP-099 · #54](https://github.com/ManuelR-T/paperplay/issues/54), [PP-108 · #63](https://github.com/ManuelR-T/paperplay/issues/63).
- [PP-113 · #68](https://github.com/ManuelR-T/paperplay/issues/68) — Run held-out cross-domain regression and artifact failure evaluations · **P1**, L. Dependencies: [PP-086 · #41](https://github.com/ManuelR-T/paperplay/issues/41), [PP-098 · #53](https://github.com/ManuelR-T/paperplay/issues/53), [PP-108 · #63](https://github.com/ManuelR-T/paperplay/issues/63), [PP-109 · #64](https://github.com/ManuelR-T/paperplay/issues/64), [PP-110 · #65](https://github.com/ManuelR-T/paperplay/issues/65), [PP-111 · #66](https://github.com/ManuelR-T/paperplay/issues/66).
- [PP-114 · #69](https://github.com/ManuelR-T/paperplay/issues/69) — Evaluate usefulness and scientific fidelity with domain readers · **P2**, external. Dependencies: [PP-113 · #68](https://github.com/ManuelR-T/paperplay/issues/68), [#24](https://github.com/ManuelR-T/paperplay/issues/24).
- [PP-115 · #70](https://github.com/ManuelR-T/paperplay/issues/70) — Document how to add a scientific domain without changing the reader · **P2**, L. Dependencies: [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-087 · #42](https://github.com/ManuelR-T/paperplay/issues/42), [PP-088 · #43](https://github.com/ManuelR-T/paperplay/issues/43), [PP-093 · #48](https://github.com/ManuelR-T/paperplay/issues/48), [PP-108 · #63](https://github.com/ManuelR-T/paperplay/issues/63), [PP-110 · #65](https://github.com/ManuelR-T/paperplay/issues/65).
- [PP-116 · #71](https://github.com/ManuelR-T/paperplay/issues/71) — Introduce the new architecture incrementally while preserving the current reader · **P1**, L. Dependencies: [PP-081 · #36](https://github.com/ManuelR-T/paperplay/issues/36), [PP-085 · #40](https://github.com/ManuelR-T/paperplay/issues/40), [PP-099 · #54](https://github.com/ManuelR-T/paperplay/issues/54), [PP-108 · #63](https://github.com/ManuelR-T/paperplay/issues/63), [PP-110 · #65](https://github.com/ManuelR-T/paperplay/issues/65), [PP-112 · #67](https://github.com/ManuelR-T/paperplay/issues/67), [PP-113 · #68](https://github.com/ManuelR-T/paperplay/issues/68).

## First useful slices

**A — Cross-domain representations without generated execution.** Establish contracts, source/evidence, assets, capability routing and the corpus (PP-081/082/083/085/086), then composed views and semantic selections (PP-087/088), process/argument representations (PP-089/092), and honest coverage/fallbacks (PP-110). A biological process, physical concept and computer-science mechanism should each be useful before a large solver catalog exists.

**B — Checked scientific computation.** Add units and coordinate conventions (PP-084), one small dynamics adapter (PP-100), and independent validation (PP-108). Broaden through stochastic systems, fields, geometry, collections and empirical data according to corpus gaps, not a blanket simulation promise.

**C — Muse creates an unfamiliar interaction.** Define an artifact and SDK (PP-093), prove isolation (PP-094), build/run under those guarantees (PP-095/096), then add the bounded generation/repair loop and layout checks (PP-097/098). Do not expose generated execution simply because Muse returned compilable code.

**D — Measured breadth and compatibility.** Finish caching, execution scheduling, controlled capability retrieval, export, held-out evaluation, extension documentation and rollout (PP-099/109/111/112/113/115/116). Domain-expert and student observations (PP-114) remain an external acceptance activity.

## Completion and evidence

- A feature has a real source-linked browser journey with keyboard/narrow-layout checks and known limits.
- A numerical/discrete adapter has independent references, preconditions, tolerances/invariants and bounded execution.
- The frozen corpus includes at least 12 real papers, four per initial domain, and explicit empirical/theoretical/missing-data cases. Corpus content and representation levels are recorded before evaluating output.
- Evaluation reports contain per-case failures, rejected attempts, missing capabilities, cost and measured resource use; held-out cases are separate from generation examples.
- Old sources, snapshots and accepted artifacts have compatibility fixtures and non-destructive recovery. Imported generated artifacts cannot bypass isolation.
- Changing parameters, selecting data, playing or reopening an experience does not call Muse. Every new paid planning/generation/repair attempt has explicit bounds, reservations and deduplication.
- No fresh live Muse run or human study is claimed by creating this backlog. Tests and implementation evidence belong to the individual future issues.

## Solo sizing and deferred work

The backlog uses provisional M (3–5 focused days) and L (6–10 focused days) estimates, with separate discovery and external-work categories. Ten M issues and 23 L issues total approximately **168–280 focused solo days**, before two discoveries, participant waiting, contingency or deployment. This is an ambition/ordering estimate, not a deadline or a commitment to implement all domains before shipping a useful slice. Re-estimate after each slice and the isolation/solver investigations.

The owner currently has no testers. Existing study [#24](https://github.com/ManuelR-T/paperplay/issues/24) and new [PP-114 · #69](https://github.com/ManuelR-T/paperplay/issues/69) cannot be completed by an agent walkthrough. Railway release issues [#31](https://github.com/ManuelR-T/paperplay/issues/31), [#33](https://github.com/ManuelR-T/paperplay/issues/33) and [#34](https://github.com/ManuelR-T/paperplay/issues/34) remain deferred. This program performs no provisioning, deployment, access change or public release.
