# Scientific intake corpus (PP-086)

[data/scientific-corpus.json](../data/scientific-corpus.json) contains twelve real, attributed research papers: four each in biology, physics and computer science, spanning empirical, mathematical, theoretical, computational, formal and algorithmic work. The [primary-source admission brief](scientific-corpus-sources.md) records inspected locators, access caveats and rights. The manifest bundles metadata and links only: no paper text, images, measurements, weights or implied redistribution licenses.

Every case identifies its exact source edition, proposed passage/figure locator, concept, intended representation, assumptions, required inputs and omissions. These are expert-reviewable expected scopes; expert review remains pending. Six body locators and four abstracts were inspected; two other cases retain unresolved direct passage/figure admission. An institutional figure attribution cannot authorize pixel extraction or stand in for reading the original caption. A source must be imported and grounded to its exact passage before creating a source-linked representation.

Four deliberately incomplete input scenarios omit single-cell data, experimental calibration, expensive inference inputs/compute or trained translation resources. Each names an expected conceptual/synthetic fallback and forbidden reproduction claims. These restrictions describe the chosen evaluation inputs, not what authors released. Image-heavy cases include the original membrane circuit and condensation figure. Reaction–diffusion and structure inference exercise cross-domain requirements.

## Frozen split

Development: B1, B2, B4, P1, P2, C1, C2, C3. Held out: B3, P3, P4, C4. Membership/split digest: `e026de172c7d72f9d755d7994b723b05a4ffed7050b9f921c3e75df934ad3db0`.

Existing prepared graph/sort and attention examples remain development cases. The held-out intake audit found no earlier title/identifier use in app fixtures, prompts or templates. A regression guard prevents importing this evaluation manifest into development paths. These cases are reserved for the later held-out evaluation; intake metadata does not constitute a model run, prompt recipe or claim about unseen model pretraining. If prior project use is discovered, version the corpus and replace the affected held-out case rather than quietly changing membership.

## Reproducible local report

```sh
npm run report:scientific-corpus
# JSON only, for a file:
npx tsx scripts/report-scientific-corpus.ts > docs/scientific-corpus-report.json
```

The [checked-in report](scientific-corpus-report.json) counts expected representations and requested evidence separately from performed evaluation. It queries the installed adapter metadata offline and records actual capability gaps, source admission requirements and scenario fallbacks. A generic catalog candidate does not establish a paper-specific recipe or completed representation. There are **zero executed, independently verified or expert-reviewed papers**, **zero model runs** and **zero human sessions** in this intake report. A twelve-case sample does not establish universal scientific coverage.

Verification: strict manifest validation, exact split/membership checks, scoped source-admission/rights assertions, deliberately incomplete scenarios, honest report counts and development-leak guards. Full `npm run check` is recorded with delivery evidence in the architecture backlog. No paid inference or unavailable participant review is substituted by these deterministic checks.
