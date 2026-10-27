# Paperplay demo and evaluation corpus

PP-001 research, checked 27 October 2026. This selects sources and reference cases; it does **not** claim that any engine, source fixture or experimental reproduction has already been implemented. Sources below are publisher pages, author-maintained resources and original papers.

## Selection

Use two demo sources with explicit publisher reuse licenses: **priority-queue graph algorithms** and **adaptive comparison sorting**. They exercise graphs, arrays, step sequences and comparisons without making the reader or figure envelope algorithm-specific. Use publisher editions for redistributable prepared fixtures; do not assume an arXiv copy has the same license as its publisher edition.

No paper PDF, source text, original figure or upstream code was copied into the repository in this issue. Later fixtures must retain attribution, source version, license and modification notices. Paper licenses do not automatically cover separately linked code, datasets or third-party images. Creative Commons BY permits sharing/adaptation subject to attribution and its other conditions. [CC BY 3.0 deed](https://creativecommons.org/licenses/by/3.0/).

## Demo D1 — graph algorithms and decrease-key

**Title:** Proof Pearl: Purely Functional, Simple and Efficient Priority Search Trees and Applications to Prim and Dijkstra.

**Authors:** Peter Lammich and Tobias Nipkow. **Pinned edition:** ITP 2019, LIPIcs volume 141, article 23, pages 23:1–23:18, published 5 September 2019. **ID:** DOI `10.4230/LIPIcs.ITP.2019.23`.

**Canonical source and rights:** the [publisher record](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ITP.2019.23) explicitly identifies **CC BY 3.0 Unported**. Its [18-page PDF](https://drops.dagstuhl.de/storage/00lipics/lipics-vol141-itp2019/LIPIcs.ITP.2019.23/LIPIcs.ITP.2019.23.pdf) carries author attribution and a CC-BY notice. Pin this edition, not an unspecified evolving artifact.

**Research basis:** the paper introduces functional priority maps/search trees, then develops Prim and Dijkstra applications. Section 6 presents directed-graph shortest-distance computation; it deliberately computes distance weights rather than reconstructing paths. Formal artifacts are linked through the paper and the [author-maintained Archive of Formal Proofs entry](https://isa-afp.org/entries/Prim_Dijkstra_Simple.html), which separately lists its code license as BSD.

**Prepared-fixture strategy:** redistribute attributed portions or the publisher PDF under its license, retain section/page anchors and identify Paperplay additions. Use section 3 for the priority-map concept and section 6 for the graph execution experience; leave the rest accessible through the original. If using upstream formalization code, separately retain the exact BSD notice/version; an independent TypeScript implementation does not inherit formal verification merely by following the paper.

### Proposed experience and reference cases

These are implementation proposals, not reported experiments:

- Animate tentative distances, settled vertices, relaxation and priority decreases on a small weighted directed graph. Show the queue alongside the graph.
- Compare two implementations of the **same shortest-distance task**, such as scan-based and priority-queue Dijkstra. Do not compare Prim's spanning-tree weight with Dijkstra's distances as though they were the same metric.
- Start with nonnegative integer weights and fixed node-order tie breaking. Initial illustrative case: `s→a:4`, `s→b:1`, `b→a:2`, `a→t:1`, `b→t:7`; expected distances are `s=0, b=1, a=3, t=4`.
- Reference checks: zero-weight edge, tied alternatives, disconnected vertex, single source, a queue key that decreases twice and rejected negative weights. Check final distances against an independent small Bellman–Ford or exhaustive-path oracle, plus settled-distance invariants.
- Record edge relaxations, queue updates/extractions and output distances. Browser timing is local evidence only.

**Fidelity boundary:** an ordinary JavaScript Dijkstra is initially a **simplified illustration of the application mechanism**. It is not a reproduction of the paper's priority search tree implementation or Isabelle proof. A mechanism-reproduction label requires the stated semantic checks and a precise claim about what was reproduced. Reproducing the functional data structure or a formal proof is additional work, not an implied demo capability.

**Data/protocol feasibility:** synthetic graphs require no external dataset. Reference semantics are tractable; the paper's formal verification is not a hardware benchmark that browser timing can reproduce. Pin exact artifact versions before any claim of correspondence with executable author code.

**Ingestion review:** inspected the publisher PDF text and a page image. It is a single-column mathematical paper with dense Isabelle notation, subscripts, symbols and multi-line definitions. Some extracted symbols break into separate tokens; preserve equations/definitions from a controlled fixture or show the original page rather than silently rebuilding them. The exact source pipeline still needs PP-006/PP-018 validation.

## Demo D2 — adaptive stable sorting

**Title:** Nearly-Optimal Mergesorts: Fast, Practical Sorting Methods That Optimally Adapt to Existing Runs.

**Authors:** J. Ian Munro and Sebastian Wild. **Pinned edition:** ESA 2018, LIPIcs volume 112, article 63, pages 63:1–63:16, published 14 August 2018. **ID:** DOI `10.4230/LIPIcs.ESA.2018.63`. Related extended manuscript: [`arXiv:1805.04154v1`](https://arxiv.org/abs/1805.04154v1), submitted 10 May 2018.

**Canonical source and rights:** the [publisher record](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESA.2018.63) specifies **CC BY 3.0 Unported** and provides the [16-page publisher PDF](https://drops.dagstuhl.de/storage/00lipics/lipics-vol112-esa2018/LIPIcs.ESA.2018.63/LIPIcs.ESA.2018.63.pdf). Use that edition for bundled/reformatted content. The arXiv page's license link instead resolves to arXiv's non-exclusive distribution license; do not infer an independent reuse grant for the entire arXiv source package.

**Research basis:** the article presents Peeksort and Powersort, stable mergesort variants that exploit existing runs. The [author's publication page](https://www.wild-inter.net/publications/munro-wild-2018) links the paper and implementations. The [author-linked code repository](https://github.com/sebawild2/nearly-optimal-mergesort-code) identifies an MIT license and documents a Java/Ant experimental workflow. The paper names archived study code at [Zenodo DOI 10.5281/zenodo.1241162](https://doi.org/10.5281/zenodo.1241162).

### Proposed experience and reference cases

These are implementation proposals, not measurements from the article:

- Detect existing sorted runs in an input array; animate the selected merging order and resulting merge tree. Begin with one named method, preferably Powersort, and a compatible left-to-right natural-mergesort baseline.
- Let readers change run structure and a deterministic seed while keeping the compared methods' inputs identical. Record comparisons, merge cost and sorted output; define each counting convention before comparison.
- Reference cases: empty/singleton input, sorted input, strictly decreasing input, repeated equal keys and uneven run lengths. Use decorated values `(key, originalIndex)` to check stability, not just numeric sortedness.
- For tiny sequences, compare output with a trusted stable-sort oracle and check permutation preservation. Validate node-power/merge-order cases against the author's algorithm or an independently derived reference. Do not certify Powersort after checking only that its output is sorted.
- Explicitly document any omitted insertion-sort cutoff, buffering optimization or other change before labeling the result.

**Fidelity boundary:** a colored mergesort animation is not evidence that Powersort is implemented. Source-linked merge-order and stability checks are needed for a mechanism claim. The original Java runtime study cannot be relabeled as reproduced by timing a TypeScript/browser port. PP-039 can assess a restricted original-protocol replication separately.

**Data/protocol feasibility:** deterministic synthetic arrays are enough for an educational mechanism. Original study scripts exist, but the precise archived code, generators, runtime environment, warmup and measurement conventions remain to be pinned and run before claiming experiment reproduction. No original benchmark has been rerun here.

**Ingestion review:** inspected PDF text and a page image. Single-column text is promising; mathematical expressions, merging illustrations, pseudo-code and charts need separate fidelity checks. Prefer a controlled publisher-edition fixture first. Experimental arXiv HTML is an import candidate, not a substitute for checking edition identity and source fidelity.

## Held-out set — do not use for prompt or fixture tuning

Freeze these three IDs before automatic-enrichment work. Inspecting metadata to select a test set is allowed; do not hand-author their figure placements or feed their expected answers into the planner. Run PP-034 after the initial prompts/catalog are frozen, and record the exact model/prompt/schema/engine versions.

### H1 — any-angle geometry, deliberately unsupported execution

**Theta*: Any-Angle Path Planning on Grids**, Kenny Daniel, Alex Nash, Sven Koenig and Ariel Felner. Pin [`arXiv:1401.3843v1`](https://arxiv.org/abs/1401.3843v1), 16 January 2014; it identifies the related JAIR 39 (2010), pages 533–579, DOI `10.1613/jair.2994`. The [publisher article](https://jair.org/index.php/jair/article/view/10676) is a separate edition.

Purpose: challenge graph-related keyword matching. Theta* requires any-angle/line-of-sight behavior; plain Dijkstra must not be substituted and called Theta*. Expected behavior with the initial engines: a source-grounded schematic or walkthrough, no invented execution or optimality guarantee.

Rights: the arXiv license link resolves to the [non-exclusive arXiv distribution license](https://arxiv.org/licenses/nonexclusive-distrib/1.0/license.html). The publisher page inspected did not expose a separate reuse grant. **Link-only/user-import evaluation; do not bundle the paper or its original figures without confirming further permission.** Ingestion risk: the arXiv page offers PDF but no HTML link; geometric figures and grid-corner assumptions are important.

### H2 — related graph theory with a stronger claim boundary

**Simpler Universally Optimal Dijkstra**, Ivor van der Hoog, Eva Rotenberg and Daniel Rutschmann. Pin [`arXiv:2504.17327v2`](https://arxiv.org/abs/2504.17327v2), revised 12 March 2026. The arXiv license link identifies [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The related [ESA 2025 publisher HTML](https://drops.dagstuhl.de/storage/00lipics/lipics-vol351-esa2025/html/LIPIcs.ESA.2025.71/LIPIcs.ESA.2025.71.html) has its own pinned conference edition and CC-BY 4.0 notice.

Purpose: a basic Dijkstra engine may illustrate queue operations, but it does not establish the paper's timestamp-optimal heap property or universal-optimality theorem. Expected behavior: appropriate anchored explanation with explicit simplification. Keep the v2 manuscript and conference source distinct. HTML exists; equations and formal complexity statements remain extraction risks.

### H3 — architecture/training outside the initial engine catalog

**Attention Is All You Need**, Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser and Illia Polosukhin. Pin [`arXiv:1706.03762v7`](https://arxiv.org/abs/1706.03762v7), revised 2 August 2023; original submission 12 June 2017.

Purpose: negative control for generic reading without supported Transformer execution. Expected behavior: cited architectural steps or an honest unsupported/simplified figure, never a claim of reproducing training or translation results. This replaces the abandoned attention-specific demo as an evaluation case only. Rights: the page's license link resolves to arXiv's non-exclusive distribution license; use links/user import, not bundled full text or figures. HTML exists, with substantial math and architecture diagrams.

## Evaluation rubric and stop conditions

For each held-out run, record the source ID/hash, extraction warnings, prompt/catalog/model versions, latency, actual usage when available, planned figures, accepted/rejected output and manual findings. Score each dimension `0 = failed`, `1 = partial`, `2 = satisfactory`; do not report scores until a run actually occurs.

1. **Document fidelity:** reading order and important equations/figures are preserved or missing content is disclosed.
2. **Source grounding:** every addition has a resolvable, relevant passage/page anchor; a matched quote alone does not validate the explanation.
3. **Pedagogical relevance:** the figure explains the identified concept rather than decorating the paper.
4. **Capability honesty:** unsupported methods remain illustrative; no engine substitution, made-up measurements or self-issued verification label.
5. **Interaction correctness:** supported controls produce real deterministic changes, reset works and comparisons use compatible data/metrics.
6. **Understanding:** a reader can explain the changed behavior and locate the source after a short task. Record participant observations separately from developer self-review.

Release-blocking failures: an invented scientific result, false reproduction label, arbitrary code execution, silent source substitution, broken source reference presented as valid, or a fabricated comparison. A well-labeled unsupported-method fallback is a successful honesty test, not evidence of broad executable coverage. A minimum useful enrichment result requires satisfactory source grounding/capability honesty and a relevant figure; inspect small-sample results rather than presenting the rubric as a statistically validated metric.

## Open follow-up work

- PP-006 is complete for disclosed, attributed source selections with hashes and local full PDFs; see `prepared-sources.md`. A complete automatic normalized edition is not claimed.
- PP-010/PP-014 now implement reference-checked Dijkstra variants and core Powersort with a stable natural-merge baseline; see `engines.md` for precise simplifications and excluded experiments.
- PP-018/PP-019 must validate real PDF/HTML extraction; the risks above are observations, not a passing parser test.
- PP-034 must run the frozen held-out evaluation. No automatic-placement or user-study result is claimed yet.
- PP-039 must pin original code/data/protocols if pursuing experiment reproduction; it may conclude that only a simplified mechanism is feasible.
