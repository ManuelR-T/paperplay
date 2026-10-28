# Research representation contracts (PP-081)

The version-1 `paperplay-representation` plan is an additional format; it does not replace or rewrite existing v2 widget snapshots. `shared/representations.ts` is the validation interface. `lib/representations/lifecycle.ts` exposes build/inspect and execution outcomes, and `components/representation-preview.tsx` renders supported previews.

## Source and intent

A plan has an exact document/version identity and named quoted passage anchors. Claims distinguish verbatim source quotations from pedagogical additions. Objective, assumptions and requested evidence describe intent, never an automatic scientific certification. Assets and quantities are explicit references/declarations; the typed scientific asset layer and dimensional validation are subsequent issues.

Every view binds to declared source anchors. Existing widget citations are additionally checked against their document metadata. Unknown fields, duplicate identifiers, mismatched quotes/versions, undeclared dependencies and files above 256 KiB are rejected. Unknown versions and unavailable capabilities return an actionable outcome and the original record without storage mutation.

## Two current adapters

- **`widget-v2@2.1.0`** wraps the existing envelope without changing any spec, seed, view, source citation or authorship. The generic preview delegates to the existing `WidgetView`, whose interactive computation remains in the trusted worker.
- **`source-guide@1.0.0`** presents named explanatory steps and exact quotes, with a direct return to the original passage. It computes no scientific trace. The manual editor can create an explicitly labeled reader scaffold without inference; imported plans may supply more specific authored explanations.

These adapters share plan/build contracts and a discipline-independent renderer. They do not infer behavior from labels such as biology or physics. The source-guide scaffold itself is not a domain-specific explanation or a newly generated scientific interpretation.

## Lifecycle

`buildRepresentation(input, source)` returns a validated artifact or `invalid`, `unsupported` or `missing-data`. Required assets deliberately return `missing-data` until a reviewed asset binding is available; a model's assertion of availability cannot supply a dataset.

`executeRepresentation(artifact, source, {signal, compute})` revalidates the artifact and executes its views, returning typed failure/cancellation or a run. The injected `compute` adapter enables worker execution. Without it, direct calculation is only available server-side; browser execution never silently falls back to the main thread. Every run marks requested evidence as unverified.

The current reader's **Create a figure** panel offers a source-guide preview. **Files & source → Import widget file** also accepts the new representation format, retaining unavailable inputs for export. Preview parameter edits are included in its downloaded representation. Guides can be exported and reopened; this first contract issue does not introduce a new persisted notebook or cloud account.

## Compatibility and evidence

`tests/representations.test.ts` round-trips all ten v2 widget families byte-for-byte through the plan adapter and checks synthetic structural fixtures for a biological process, physical recurrence, algorithm trace, empirical result and theoretical argument. Other tests cover claim-layer separation, unavailable versions/capabilities/data, tampering, duplicates, budgets, cancellation and adapter failure. These fixtures are not real-paper scientific validation; the attributed cross-domain corpus is PP-086.

Verification on 28 October 2026: `npm run check` passed strict TypeScript, 218 tests and production build. Native Chromium verified source-guide step changes, exact quotes, mobile source return/focus, graph representation import and unknown-version export recovery at 320 pixels without document overflow. No paid inference was used.
