# Meta-selected paper illustrations

Opening a research paper starts automatic Meta illustration. Meta decides whether a passage needs an added figure, selects a bank type and its parameters, or requests a new interaction. The application validates and renders those decisions at their exact cited passages. Original paper content, figures and rights remain separate.

## All saved sections, with no inferred additions

The controller sends **every saved source section** to Meta, rather than stopping after four. Large papers are partitioned to fit individual requests, without silently dropping the remaining sections. This covers the source actually imported; extraction warnings still describe missing or unsupported original content.

Meta receives all ten approved bank types, their descriptors/templates and the available interaction contract. Keyword matching does not choose or hide a bank type for planning, veto a model-selected type, or insert a substitute figure. Previously prepared graph/comparison/walkthrough additions are no longer inserted in normal reading. Saved figures appear automatically only when their recorded authorship is Meta. Original source figures remain visible. Explicitly opened shared experiments retain their separate source-bound recovery path.

Each result may contain catalog `proposals`, isolated `customFigures` requests, both, or neither. Empty arrays are a deliberate model decision, not a trigger for a default diagram. Existing Meta choices are included in later planning context to reduce redundant illustrations.

Invalid catalog proposals are not silently skipped. Once a prior response is definitively terminal, Meta receives the rejected IDs and validation paths and corrects that section automatically. Already admitted illustrations remain available; accepted or uncertain jobs keep their original retrieval identity. There is no fixed spending/attempt ceiling on these corrections. Response-local custom IDs do not discard a different interaction on a later correction: durable task identities also bind the request content.

## Model-selected custom generation and repair

A custom request specifies its concept, objective, interaction brief and exact source block/page/quote. The separate Meta generation tool creates the SDK implementation from that request. The host does not force a custom illustration into the first section or invent its scientific content.

Generated candidates pass source binding, isolated compilation, runtime and layout/interaction checks before display. Actionable local failures are sent back to Meta with the exact candidate and diagnostics. A technical provider session supports three attempts/five minutes; a **known terminal failure** may continue in a fresh session with the failure context. This does not stop the illustration task after one or three tries. An accepted or uncertain submission is always retrieved using its existing reference, never replaced. Infrastructure failures and explicit cancellation do not authorize invented successful output.

Custom requests are handled as Meta raises them while the paper is reviewed. Controls run locally and do not create model calls. Runtime isolation, source validation and finite code/input/output limits remain technical execution contracts, rather than spending quotas.

## Hackathon operation

Application financial/request quotas are **off by default**. This includes the prior per-session/hour/day limits, daily token allowance, per-paper eight-request limit and generation reservation ceiling. `PAPERPLAY_QUOTAS_ENABLED=true` explicitly opts an operator back into configured quotas. [Operations](operations.md) describes the setting.

Actual metering, durable request identities and accepted-job recovery remain enabled. No usage ledger is cleared and no billing usage is fabricated. Provider credit/access failures remain provider responses; the application does not claim access to a remaining euro balance. Operator creation/execution switches remain available independently of quota mode.

## Persistence and visible progress

The reader shows planning, custom generation, checking and completion as real states. Saved Meta figures are immediately reusable. The version-two controller migrates valid old four-section caches and continues through the remaining sections; it retains accepted job references. Old incomplete custom sessions retain their original one-attempt contract for retrieval and move to a new session only after a known terminal failure.

Storage and browser locking coordinate repeated views/tabs. A failed durable save prevents further submissions because the request must remain recoverable. Cached complete results do not incur duplicate creation. An obsolete prompt rejection can receive a new request identity only when the server explicitly certifies that the old request was never submitted; ambiguous context errors retain the old reference. Model excerpts are disclosed in the import flow; the original PDF is not automatically uploaded by this illustration path.

## Verification

Provider-free tests cover all 43 source sections, explicit no-widget decisions, Meta-selected placements, plan correction, repair diagnostics, continued technical sessions and legacy cache/job recovery. Quota-disabled tests record more than the former daily/request/token ceilings while preserving deduplication. Reader tests reject silent authored/default additions. Full-bank requests measured 41–44k characters on the prepared corpus, within the adapter’s per-request input contract. The final complete suite passed 808/808 tests sequentially, with TypeScript and the production build passing. Two parallel-suite attempts hit existing isolated compiler/guest wall-clock limits; execution limits were not relaxed.

The [live whole-paper report](../data/meta-only-paper-live.json) records 43/43 sections of arXiv 2504.17033v2 and 24 displayed Meta-authored bank figures (graph, table, diagram, equation). This initial live pass exposed ten rejected proposals/plans and ended partial; the automatic planning-correction patch was added afterward and verified in provider-free tests, not a second paid full-paper run. Meta requested no SDK-generated interaction on this paper, so the report does not claim live SDK creation or repair success.

Earlier [automatic reader](../data/automatic-reader-browser.json), [automatic-only live](../data/automatic-only-live.json), [quota/progress](../data/progress-math-browser.json) and [math-copy](../data/bmssp-math-copy.json) reports document their dated implementations and failures; their old limits are historical, not the current behavior. New end-to-end evidence belongs to the Meta-only implementation report.
