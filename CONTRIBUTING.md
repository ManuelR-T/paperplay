# Contributing to Paperplay

Paperplay adds source-linked explanations and bounded simulations to research papers. Product text and generated explanations are in English. Keep the source author's claims distinct from Paperplay's additions.

Use the Node version in `.nvmrc`, then:

```sh
npm ci
npm run dev
npm run check
```

Prepared examples work without a provider key. Put an optional Meta key in ignored `.env.local`, never in code, issues, snapshots or browser-visible `NEXT_PUBLIC_` variables. Routine tests must not start paid inference. Live evaluation scripts require their explicit opt-in flags.

## Where to extend

- `shared/schema.ts`: versioned source, input, figure, engine, trace and snapshot contracts.
- `lib/engines/`: trusted deterministic algorithms, capabilities, measurements and execution bounds.
- `lib/prepared-figures.ts` and `data/`: source presets and attributed examples.
- `components/figures/`: generic renderers over supplied input/state, not algorithm-name branches in the reader.
- `lib/execution/`: the worker protocol, interruption and result validation.
- `lib/import/`: extraction, physical/logical source references and normalization versions.
- `lib/analysis.ts` and `server/questions/`: bounded model contracts and scientific grounding checks.
- `server/usage/`: creation quotas, reservations and measured usage; browser controls are not the enforcement boundary.

Follow the [worked third-family extension](docs/engine-extension.md). It adds matrix input, numerical traces and a real source through the same registry/preset interface. Preserve existing snapshot meanings; detect incompatible versions explicitly.

## What a useful change includes

Explain the concrete behavior and its scope. For a new engine, provide independent reference cases and tests for mathematical preconditions, finite bounds, deterministic output, limits and cancellation. Validate worker/direct equivalence when execution changes. A sorted output alone does not establish a merge-scheduling algorithm, and a plot alone does not establish a convergence claim.

For a new paper or figure, retain source version, authorship, permission/attribution, relevant passage anchors and known extraction loss. Use synthetic teaching data unless original data/protocol evidence is actually available. Unsupported behavior remains a labeled conceptual explanation; never substitute a different engine silently.

For model changes, use strict bounded contracts, exact source checks and declared capabilities. Do not execute model-provided JavaScript. Keep frozen held-out evidence intact; a changed prompt/catalog needs a separately named evaluation, with actual failures retained.

Run the focused checks affected by the change and `npm run check` before delivery. Add meaningful boundary/reference tests rather than tests that merely repeat an implementation. Check keyboard access, readable small text, reduced motion and narrow layouts for changed UI.

## Scientific labels and rights

Fidelity labels come from application-owned checks, not a model's assertion. Cite the precise mechanism or experiment actually verified. Local timing is not evidence of reproducing a paper's hardware study. The [original merge-cost replay](docs/reproduction-audit.md) executes the author's pinned Java artifact and cannot certify the browser's separate TypeScript implementation.

Project code is ISC-licensed; paper and dependency rights remain their own. Preserve `public/papers/ATTRIBUTION.md`, source-specific notices and upstream package licenses. Update [the dependency inventory](docs/dependency-notices.md) when the locked dependency tree changes. Importing a paper does not grant permission to redistribute it.

Discuss scope and evidence in a reviewable change description. Do not publish a release, deploy new credentials or submit hackathon material merely because a local check passed; use the project's explicit delivery instructions and authorization for those actions.
