# Whole-paper illustration planning

Opening a paper starts an editorial decision by Meta over the complete imported source. The application sends all saved blocks in reading order, including equations, captions, source links and extraction warnings. It does not partition a paper into independent illustration decisions, substitute an abstract, or silently truncate the text. Original figure references and captions are included; their image pixels are not automatically sent.

## Decide first, implement second

The `paper-outline` phase asks where an interaction would materially improve a reader’s understanding of this paper. Meta receives the full approved widget bank and, when present, the configurations of previously generated figures. It chooses a small complementary set of figures with exact source placements and reader goals. Roughly three to six strong figures is editorial guidance for a typical paper, not a quota or required minimum. Zero is valid when no addition helps.

The plan considers redundancy across the entire paper: changing labels, repeating an isomorphic diagram, or restating prose in another table does not make a new teaching purpose. Each chosen figure names the question it answers, why it belongs at that passage, a concrete action and the relationship the reader should notice. Meta can explicitly keep an existing figure, omit it, select a bank implementation, or request a new SDK interaction.

Only selected entries are implemented. Each `paper-figure` request receives the complete source again plus its approved brief and anchor. Generated SDK requests likewise use the complete source and a frozen anchor. The application validates the result’s identity, type and placement; it does not infer pedagogical relevance from keywords or manufacture a substitute figure. The graph bank executes Dijkstra search, so the planner is told not to relabel it as a pivot routine, forest partition or a different paper-specific algorithm.

## Context and visual clarity

The reader sees the purpose and passage context directly above each illustration, followed by **Try** and **Notice** prompts. The generated guide is shown with the corresponding figure; it is not buried in a details panel. Existing manually opened figures retain a visible source mapping. Concept diagrams place wrapped labels inside spaced boxes and terminate arrows at box borders. Graph edge labels have higher contrast, and padding accommodates labels at the canvas boundary. The implementation supplies its final reading guide so the suggested interaction describes the controls that actually exist.

Local controls operate on the actual approved widget. A new generated interaction must pass source binding, isolated compilation, execution and layout/interaction checks before it appears. Actionable failures return to Meta with diagnostics. Technical generation sessions support three attempts/five minutes; a known terminal failure may continue in a new session. There is no application spending or overall repair-attempt cap in hackathon mode.

## Saved papers and recovery

Version-three state keeps the global reading plan, its figure bindings and the completed implementation IDs. Earlier section-era figures are supplied to Meta as candidates for reuse, with their actual widget configuration. Only explicitly selected candidates appear in the new reading plan. Omitted figures remain archived in browser storage. Early version-three plans receive one editorial review with their actual saved configurations; current plans reopen without new generation. Historical workbench or analysis figures no longer insert themselves independently; explicitly opened snapshots retain their separate recovery path.

Already accepted requests retain their original owner and frozen context. The compatibility controller recovers only previously recorded section-era work before the new global plan; it does not continue the old section-by-section sweep. Uncertain submissions are never replaced. Known pre-submission rejections can be retried with an appropriate reference. Browser locking coordinates tabs, and a figure, its plan binding and its completed marker are saved atomically to prevent duplicate insertion after interrupted storage.

## Transport and metering

Application quotas remain off by default (`PAPERPLAY_QUOTAS_ENABLED` unset or `false`), with durable accounting retained. Input limits are technical transport bounds, not financial budgets: oversized complete input fails explicitly before provider submission, with no excerpted replacement. Provider billing and access remain authoritative. See [operations](operations.md).

## Verification

The provider-free suite verifies complete-source requests over 100,000 characters, one global decision for a 43-section paper, generation only for selected entries, curation of 24 saved figures down to one explicit reuse, exact anchor enforcement, contextual guides, repair and durable interruption recovery. Historical reports describe their dated implementations: the [previous section-based live run](../data/meta-only-paper-live.json) produced 24 figures and exposed the repetition that motivated this change.

The [whole-paper live run](../data/whole-paper-editorial-live.json) on 28 October 2026 used the real Meta API on the 43-section sorting-barrier paper: four complementary bank figures, followed by one global review that retained those four and corrected their interaction guides. Reopening made no additional model request. The [desktop capture](../data/whole-paper-editorial-live.png) shows spaced concept labels and one shared arrow legend. A 390px viewport kept the page at 390px with the large diagram scrolling within its frame. This is one real-paper check, not scientific or human-reader validation. The automated suite passed 839 tests; TypeScript and production build passed.
