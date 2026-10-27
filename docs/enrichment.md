# Inspectable, section-scoped Meta enrichment

The new workbench is independent from the release-1.1.0 automatic import contract. Existing saved version-1 figures still use their original reader and validators. New proposals use the source-linked `paperplay-widget` schema version 2 and catalog version `2.0.0`.

## Reader workflow

Choose a source section, then explicitly ask Meta for a widget plan. Nothing is applied automatically. Each proposal identifies its concept, exact quote/block/page, teaching objective, type-selection reason, needed data, synthetic or illustrative origin, actual declared interactions and limitations. A preview loads only when requested. Accept, defer and remove are local actions without inference.

The same workbench accepts current manually authored widgets from the research workbench. To repair one, choose that widget and describe a concrete problem. To request a settings edit, describe an admissible change. Meta proposes a new complete typed configuration, and the application presents its actual field differences before acceptance. Edits preserve the widget type; replacement uses the repair action. Both preserve the exact source anchor. Application evidence labels, original source, engine implementations, title and seed are protected. Arbitrary code/markup fields cannot become an executable widget.

The last valid widget stays active until a replacement passes validation and the reader accepts it. A failed/unchanged repair does not replace anything. Accepted local revisions have undo history (up to eight earlier configurations per widget). Applying, rejecting, undoing, opening a preview and changing local parameters do not call Meta.

## Long papers and honest coverage

`buildSourceSections` partitions the full immutable normalized source into at most 12,000-character source-fragment groups. Large blocks are split with explicit character offsets; repeated heading names have distinct numbered labels and stable section IDs. No original block is discarded or rewritten. The selected section plus limited neighboring passages forms the bounded provider context, with a separate context-size check. Neighboring context does not count as analyzed coverage.

Coverage is saved as analyzed, unsupported or failed per section; the absence of a completed request is labeled unanalyzed. Section enrichment never claims complete-paper analysis. The HTTP transport accepts up to 2.5 MB of full source/configuration, including source-v3 provenance, while the provider input remains capped at 70,000 characters. This improves the previous whole-paper cutoff but does not establish unlimited paper size or reliable math reconstruction.

## Creation, ownership and recovery

The Node routes are `/api/enrichment/session`, `/start`, `/status` and `/cancel` under that prefix. The first is a no-inference session bootstrap. A valid existing HttpOnly anonymous session is required before creation: losing a first creation response cannot silently assign its retry to a different newly created owner. Same-origin validation applies to every route.

New inference is explicit, uses the official configured Meta endpoint/model with background responses, `maxRetries: 0` and an output bound of 4,500 tokens. The accepted provider reference is represented by a signed capability bound to its owner, source fingerprint, selected section, action, exact target/feedback context, model and expiry. Local pending state retains that capability and the original request ID. Reload/status/cancel retrieves the same accepted job; no paid replacement is automatically created. A submission with unknown acceptance is reconciled under the same ID, or remains explicitly unresolved. Creation-disable flags do not disable retrieval/cancellation when the configured provider key/signing configuration remains available.

## Durable budgets and privacy

Every new request reserves both the existing shared global analysis/question quota and a separate durable per-paper allowance. Defaults are eight requests and 1,000,000 conservatively accounted tokens per source fingerprint and anonymous owner. Pending/uncertain work retains its ceiling; reported terminal usage can reconcile it. These are application allowances, not a credit-balance estimate or dollar cap. The operator must consult provider billing.

The per-paper SQLite ledger stores IDs, hashes, statuses, conservative/actual token accounting and accepted provider IDs. It contains no source passages, questions/feedback, generated prose, cookies or signed capabilities. Its default path is `.paperplay/enrichment-budget.sqlite`, or `enrichment-budget.sqlite` beside an explicitly configured usage SQLite path (so an existing `/data` mount can be reused). `ENRICHMENT_BUDGET_PATH` overrides it; `ENRICHMENT_SQLITE_PATH` remains an alias. A missing or unwritable ledger fails closed before new paid work. Distributed Node deployment currently fails closed for this feature until a shared per-paper adapter exists; the planned Railway target starts with one persistent host and is outside this implementation task.

Validated plans, accepted proposals, history and pending capabilities are saved in browser-local storage keyed by the exact source fingerprint and catalog version. The cache is bounded at 2 MB. An invalid/incompatible cache is retained unchanged and new saving is blocked until the reader explicitly forgets it. `forgetEnrichment(sourceId)` removes only that paper's enrichment records when the source is explicitly deleted. Pending access capabilities are not widget fields and must not be included in portable widget/study-pack exports.

## Verification and limits

`tests/enrichment.test.ts` exercises immutable long-source segmentation, partial coverage, six-family capability/grounding fixtures, individual proposal rejection, configuration injection/type/source protections, local undo, cache identity, two-connection durable ceilings, duplicate job recovery across handler instances, ownership/source/context tampering, disabled creation, cancellation, global/document quota denial and a missing ledger.

The six-family guard corpus uses the prepared graph/sorting/optimization selections and independently authored source-linked attention/probability/convolution notes. Its model outputs are deterministic provider fixtures. This establishes parser/validation behavior and catalog breadth, **not** observed Meta quality on six unseen papers or a user study. A real-provider quality run must retain its actual source scope, prompts, rejections, measured request/token counts and model version separately. No live paid request or participant session is claimed by these tests.

Each proposal also needs the catalog’s declared source-concept hints in the selected bounded context and must pass an initial bounded computation where applicable. These conservative guards can reject unrelated attention/probability/signal/etc. choices while retaining illustrative diagrams/tables; they do not prove equivalence to the original method. Exact quote matching validates a location, not the truth of every model sentence. Plausible but scientifically weak mappings can still require human rejection. Generated table values are only accepted as illustrative; the model cannot mark them source-reported or computed without a separately verified data path. Catalog interaction checks prevent declared unavailable controls, but general prose quality remains an evaluation concern. No original experiment reproduction is granted by these additions.
