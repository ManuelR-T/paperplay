# PP110 development coverage cases

These deterministic cases reuse admitted development sources and existing local fixtures. They do not introduce papers, download source material, use held-out papers, call a model, or represent observations from readers or experts. Requirements and explanations added by these tests are authored local declarations, not quotations or claims that an unavailable experiment was attempted.

## B1: Hodgkin–Huxley reported result with missing local data

Reuse `createDatasetExample('reported')`, admitted in [dataset-data-sources.md](dataset-data-sources.md). The source is Hodgkin and Huxley (1952), [DOI 10.1113/jphysiol.1952.sp004764](https://doi.org/10.1113/jphysiol.1952.sp004764), [primary article archive](https://pmc.ncbi.nlm.nih.gov/articles/PMC1392413/). Its exact existing anchor is `figure11` / `figure11-caption`: Figure 11, printed p. 521. The factory contains a previously verified 18-word caption selection. The local source's logical page 1 is an attribution card, not original printed page 1.

The supported fallback distinguishes the source's reported observed voltage-clamp currents from its calculated comparison. It supplies no checked raw trace table, invented samples, inferred independent n, digitized figure or numeric uncertainty. A quantitative replay therefore has an explicit missing dataset requirement and an action to import exact checked data or retain the reported-only explanation. A partial protocol locator does not imply a complete laboratory SOP. Missing locally does not mean the paper has no public data or the recordings never existed.

Coverage must not turn analysis of the caption into an assertion that the whole article, its equations, experimental procedure or all figures were analyzed. Conversely, a source-linked reported-only card is useful coverage of that selected passage, rather than a fabricated numeric chart or an unrelated generic engine.

## C1: functional data structure and proof remain unsupported

Reuse `getPreparedPaper('priority-search-trees')`: Peter Lammich and Tobias Nipkow (2019), *Proof Pearl: Purely Functional, Simple and Efficient Priority Search Trees and Applications to Prim and Dijkstra*, [DOI 10.4230/LIPIcs.ITP.2019.23](https://doi.org/10.4230/LIPIcs.ITP.2019.23). The admitted publisher edition is CC BY 3.0, with existing project attribution and change notices. Block `g-introduction-text`, original PDF page 1, identifies the purely functional data structure and Isabelle/HOL verification; `g-priority-definition`, page 2, states the priority-map interface. These source passages are already in the local prepared selection.

The existing Dijkstra heap/scan teaching engines and independent shortest-distance checker do not implement the publication's functional priority search tree or replay its Isabelle proof. An authored requirement for the exact unavailable proof adapter must remain unmet even if ordinary graph engines are installed. Its next action is to retain the exact source passage and conceptual explanation, or supply a separately reviewed compatible proof adapter. A generic graph trace must not silently replace that goal. This limitation agrees with `lib/fidelity.ts` and [scientific-validation.md](scientific-validation.md).

A selected source block can be analyzed while other local blocks remain `not-analyzed`. A mathematical argument may make an experimental-data dimension `not-applicable` only with an explicit scope reason; that does not mark the rest of the paper analyzed. The prepared document contains selected passages from an 18-page original and warns that it is not a full normalized edition. Even complete coverage of its local blocks would not establish full-paper analysis.

## Portable evidence boundary

Coverage exports should preserve versioned source identity, checked local scope, named unmet requirements, decision reasons and next actions. Source excerpts default to off. An explicit selection may include only bounded exact excerpts from the source actually bound to the report. Full source text, original PDF/upload bytes, asset payloads, provider credentials, jobs and live authority do not belong in this report format. An exported or reopened report remains an inert declaration; it does not become a fresh scientific validation receipt.

The adversarial privacy fixture adds an unselected private marker solely as test data to a copy of a prepared development source. Export must exclude that marker while retaining the exact selected source identity. This is an authored privacy assertion, not a newly admitted passage or a modification to the corpus.

## Verification recorded for this slice

The independent test file covers the two real development cases, automatically derived reported-only/unknown-adapter gaps, exact sentence offsets versus section analysis, explicit user not-applicable decisions, stale source bindings, non-executing argument/protocol fallbacks, and bounded extension-request round trips. It also checks adversarial self-hashed report ranges: an imported declaration cannot redirect a selected concept into a different saved section. The report hash is an identity check, not authority to bypass source-range validation.

A regression caught and corrected the fallback label `Original page 1` on the HH excerpt card. Fallbacks now identify the **saved-source page**, preserving the distinction from original Figure 11 at printed p. 521. Export tests cover no excerpts by default, an explicitly selected exact sentence, rejection outside the chosen scope, eight-excerpt and total 4,000-character limits, altered imported bytes, and exclusion of an unselected authored private marker. These are deterministic engineering assertions, not a human evaluation or scientific verification of either publication.
