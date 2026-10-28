# Arguments, equations and partial protocols (PP-092)

`reasoning-guide@1.0.0` is a local reading adapter for argument, derivation and protocol maps. It does not execute a procedure, evaluate symbolic mathematics, verify a proof or reproduce a scientific result. The same representation contracts, source version checks, semantic step selections and portable study host serve all three forms.

## Contract and interaction

A guide contains at most 48 named steps. Definitions, assumptions, equations, inferences, procedures, observations and gaps have distinct roles. Each step declares source anchors, an original-source locator, dependency IDs, assumptions and missing details. Source quotations must match their declared exact anchor. Source summaries are explicitly labeled Paperplay summaries; added explanations require explicit assumptions. Gaps require missing details and cannot be labeled source-reported. Dependency cycles, dangling IDs and duplicate steps are rejected.

Every step offers a return to its excerpt and an original-paper link with the stated locator. Prepared excerpt cards disclose their logical page numbering and limited coverage; linking to a paper does not imply that the entire paper or its figures were extracted. A dependency map is an authored reading aid, not a machine-checked proof graph.

Readers can select a step directly, move previous/next, follow prerequisite buttons, undo selection, or inspect a dependency table. Unresolved details stay visible above the walkthrough. A selected step participates in source linking and v2 study export/reopen through the existing semantic store; input/source changes invalidate stale navigation.

## Notation

Equation steps retain the exact submitted notation string and a required plain-language fallback. KaTeX rendering uses untrusted mode, strict errors, expansion/size limits and a 2000-character input budget. It performs no symbolic execution or external lookup. Unsupported or uncertain notation remains visible as raw text and requires declared missing details. Rendering failures retain the raw transcription instead of silently replacing the equation. Mathematical display alone grants no scientific verification.

## Grounded examples

The development-corpus examples and checked primary locators are documented in [argument-protocol-sources.md](argument-protocol-sources.md). Bell's ideal exact-correlation argument distinguishes source-reported assumptions/bound, a short original conclusion quotation, and a separately authored 0°/60°/120° substitution. It does not reconstruct the subsequent approximation argument, CHSH or detector experiments.

Hodgkin–Huxley's Figure 11 supports a **partial** voltage-clamp experiment/comparison explanation. Observed right-column and calculated left-column traces remain distinct. Preparation, solutions, apparatus/calibration, acquisition timing, repeat schedule and acceptance criteria are unresolved here. They are not completed with plausible instructions. No original scan/figure pixels are redistributed; broad reuse rights were not established. Only a bounded excerpt, metadata, links and authored explanations are stored.

## Verification

`npm run check`: TypeScript, 289 tests and production build. Reference tests cover both offline adapters, source/role checks, explicit added assumptions, missing details, dependency cycles/dangling IDs, unsupported and unsafe notation fallback, stale and portable step selection, evidence gaps and the illustrative angle arithmetic.

Native Chromium checked both examples, mathematical rendering, source focus, authored/source role labels, persistent missing protocol details, direct/prerequisite/next navigation and step export/reopen. Mobile equation layout was inspected at 320 px; notation has a separate scrollable region and a text fallback. These engineering checks do not establish formal validity, laboratory usability or expert approval. No paid model requests were made.
