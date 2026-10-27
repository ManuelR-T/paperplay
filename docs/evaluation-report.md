# Held-out enrichment evaluation — M4 / PP-034

Checked 27 October 2026. This is a small **developer self-review**, not a participant study, accessibility certification or statistical quality estimate. No engineers/students were recruited and no user-study outcome is claimed.

## Frozen protocol and evidence

The three paper IDs were selected before automatic enrichment in [the corpus plan](demo-corpus.md). The baseline used the unmodified production arXiv/PDF ingestion, bounded analysis context, official Meta structured-output adapter and `compileAnalysisPlan` validator. No figure placements or expected answers were manually supplied. Exactly **three** paid creations occurred: one separately declared Theta* excerpt diagnostic, the full Dijkstra HTML source and the full Attention HTML source. The full Theta* source failed before inference.

[Machine-readable baseline](evaluation-m4-baseline.json) records source/version hashes, extraction warnings, source dimensions, model, elapsed time, usage, figure identities, anchor locations, quote digests, accepted/rejected counts and exact prompt/catalog/schema/source-file hashes. Full source text, API keys and provider job access identifiers are absent from the public report. Private resumable raw model responses remain under ignored `.paperplay/evaluation/m4-baseline/` for local inspection; they are not deployment assets or repository fixtures.

This is a **pre-M5** baseline: `source-v1` normalization, four graph/sorting engines, graph/array/step/comparison figure catalog. M5's `source-v2` reconstruction and numerical renderers were developed afterward. Their improvement is not silently substituted for these observations. The evaluation script protects historical runs against changed source/catalog hashes. A later evaluation requires an explicit new `--run` identifier.

```sh
# No inference by default; use a fresh run name for changed code.
npx tsx scripts/evaluate-corpus.ts --run=inspection
# Explicitly paid, bounded run; optional excerpt is declared separately.
npx tsx scripts/evaluate-corpus.ts --live --theta-excerpt --run=another-frozen-run
```

The script checkpoints before creating inference and resumes accepted response IDs. A submission without a saved response ID never automatically retries. CLI execution is an operator tool with its own explicit request action; it uses the same durable token/request ledger as inference routes.

## Actual outcomes

| Case | Ingestion / context | Automatic result | Reported tokens | Latency after context |
| --- | --- | --- | --- | --- |
| H1: [Theta*, `1401.3843v1`](https://arxiv.org/abs/1401.3843v1), full paper | PDF, 47 physical pages, 904 blocks; over 70,000-character analysis limit | Source retained; explicit pre-provider rejection. **Not a full-paper enrichment success.** | No inference | Not applicable |
| H1 diagnostic: same PDF, explicitly selected physical pages 1–3 | Selection disclosed; original physical page references retained | Three cited conceptual step figures. Proposed conceptual graph failed its start-node configuration and degraded to the supplied explanatory steps. No Theta*, A* or Dijkstra run was substituted. | 4,246 input / 2,601 output | 16,443 ms |
| H2: [Simpler Universally Optimal Dijkstra, `2504.17327v2`](https://arxiv.org/abs/2504.17327v2), full source | HTML, 141 blocks, 44,370 context characters, logical HTML locations | One relevant cited timestamp-optimality walkthrough accepted. A proposed computed Dijkstra figure was rejected: its quotation belonged to a different block than the supplied block ID; its graph start was also empty. **No automatic computed Dijkstra example succeeded in this run.** | 13,721 input / 2,676 output | 19,856 ms |
| H3: [Attention, `1706.03762v7`](https://arxiv.org/abs/1706.03762v7), full source | HTML, 114 blocks, 35,669 context characters, logical HTML locations | Three cited conceptual walkthroughs: encoder/decoder organization, scaled dot-product attention, positional encoding. No model training, inference engine or translation benchmark claimed. | 9,757 input / 2,602 output | 15,992 ms |

Total reported provider usage: **35,603 tokens**. No dollar cost or remaining-credit balance was returned or estimated. Source and interpretation boundaries remain separate: successful quote matching establishes a location, not the truth of an explanation or a reproduced experiment.

HTML equations and source-figure captions were retained where represented by the importer; original image rendering and physical PDF-page mappings were not invented. PDF extraction did not recover Theta*'s original diagrams or equation layout. Its PDF metadata title was `theta.dvi`, an additional visible metadata-quality limitation.

## Self-review scorecard

Scores follow the planned rubric: 0 failed, 1 partial, 2 satisfactory; “—” means no augmented result to inspect. Scores describe this small frozen run, not population-level reliability.

| Case | Document fidelity | Accepted-source grounding | Pedagogical relevance | Capability honesty | Interaction correctness |
| --- | --- | --- | --- | --- | --- |
| H1 full | 1 | — | — | 2: explicit limit | — |
| H1 excerpt | 1 | 2 | 2 | 1 | 1 |
| H2 full | 1 | 2 | 2 | 1 | 1 |
| H3 full | 1 | 2 | 2 | 1 | 1 |

The accepted scientific concepts were relevant on self-review: line-of-sight conditions and distinct Theta* variants, insertion-time intervals in timestamp-optimal heaps, and query/key scaling followed by softmax and value weighting. Dijkstra's ordinary binary heap was not labeled timestamp-optimal or universally optimal. No original experimental number or reproduction label was invented.

The partial interaction/honesty scores reflect an observed general defect: model-written prose can describe controls absent from the renderer. The Theta* fallback mentions toggling blocked cells, the timestamp walkthrough mentions changing push/pop interleaving, and Attention assumptions refer to tiny vectors/sinusoidal values that are not actually shown. Their actual accepted figures only offer explanatory-step navigation. This is not evidence of executable support for these mechanisms.

### Recorded findings and disposition

1. **Wrong block/quotation pairing:** rejected correctly by production validation. Preserve the rejection; never search for another block and silently reattach a generated result. The valid timestamp explanation remains usable.
2. **Empty conceptual graph start:** safe conceptual fallback, disclosed. General optional-role/configuration handling can improve independently; the frozen result stays unchanged.
3. **Absent-control prose:** reported to the release integrator for general capability restrictions and an explicit display of available controls. Any corrected release behavior must be documented in the release validation; these baseline scores do not change without a new labeled review.
4. **Long full PDF:** explicit context limitation, not silent truncation. The separate first-three-page diagnostic does not make the full paper supported.
5. **Metadata/math/diagram loss:** retain warnings and original-source links. Geometry reconstruction improvements belong to the independent fixed-corpus before/after work in PP-043.

Self-review understanding tasks were to identify the line-of-sight restriction, distinguish a timestamp-heap theorem from ordinary Dijkstra, and describe scaled attention without claiming a trained network ran. The reviewer could locate the accepted source passages and explain those distinctions. This is weaker evidence than observation of students; human understanding remains unvalidated.

## Release interpretation

The run establishes automatic, relevant, cited **conceptual** additions on unfamiliar papers, including an algorithm-family negative control. It also establishes effective rejection of an invalid computed figure. It does not establish reliable automatic executable-figure selection, full-document PDF reconstruction, correctness of all generated prose, universal algorithm support or learning effectiveness. The rejected and partial cases must remain visible in release material.
