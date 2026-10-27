# Contextual questions — PP-027

`ContextualQuestion` renders a question button and shadcn dialog for an explicit `QuestionContext`: `{ source, blockId, figure?, seed?, stepIndex? }`. A passage selection sends only that normalized passage as model context. A figure selection also includes its cited passages, synthetic input, assumptions, supported-engine limitations and server-recomputed state. The route receives the source to validate its identifiers and anchors, but the provider receives the selected bounded context rather than the complete paper.

The dialog identifies the selection, distinguishes conceptual figures from computed runs, and displays measured token usage when returned. There is no conversation history. Each explicit Ask Meta action creates one bounded request; opening a dialog or changing a parameter does not call a provider. Changing source version, selected block, figure, seed or playback step clears/aborts the displayed answer. Stale responses are ignored and never reassigned to a new selection.

## Server behavior

`POST /api/questions` accepts `{ context, question, requestId }`. Questions are 3–1,000 characters. Source/figure contracts and selected-block association are validated before inference. At most eight selected passages and 24,000 passage characters are accepted; total serialized selected context must remain within 40,000 characters. Context is rejected instead of silently truncated. The UI may show a shortened preview of a long selected passage; that preview is not the provider context.

For supported computed figures, the server recomputes the same current input, seed, registered binding and parameters using trusted local engines. Client-supplied metrics or execution results are not accepted. Question inputs are limited to 32 array values or 16 graph nodes / 64 edges, and an operation limit of at most 10,000. Larger configurations must be reduced before asking about their run. The selected playback index is clamped to each actual trace's final step. Complete synthetic-run totals are explicitly separated from selected-step state; a bounded incomplete run has partial totals. Step walkthroughs and illustrative figures have no executed algorithm outcome.

Official Meta inference uses the configured server-only endpoint and model, with strict structured output, `max_output_tokens: 1200`, a 25-second SDK request timeout and no automatic retries. Source and question text are untrusted data. Instructions demand a concise English interpretation, exact source quotes and honest limitations, never a promise of future computation or a fabricated benchmark. No arbitrary generated code is executed.

An answer must include plain explanatory text, `interpretation: true`, and 1–4 citations. Each citation's block ID, page and whitespace-normalized quote must match one of the passages actually supplied to the provider. Normally at least 12 quote characters are required; a complete shorter equation can be cited. Invalid output or citations are withheld with a validation error. Provenance validation does not establish scientific correctness, and the UI says so.

## Usage and failure states

The route reuses same-origin checks, signed HttpOnly browser sessions and the shared durable `UsageStore` used by analysis creation. A reservation is committed before inference. Duplicate request identifiers never issue another provider request; they return a conflict because private answers are not stored server-side. A successful answer includes model, context identity and provider-reported token counts. The operator ledger stores only request metadata and measured or conservatively reserved usage, never paper/question/answer text.

Confirmed provider rejection, incomplete output, failed citation validation and ambiguous transport outcomes have distinct usage statuses. A lost response can mean the question was processed, so no automatic retry is attempted; the user is told another explicit Ask Meta click creates a new paid request. Closing or changing the dialog aborts browser retrieval but cannot promise cancellation of an already accepted synchronous provider request. Reading and figure manipulation remain available on provider errors.

## Verification

`npx tsx --test tests/questions.test.ts` runs seven provider-free tests covering actual recomputation after input changes, conceptual/unexecuted context, short-equation citations, fabricated/wrong-page/unrelated citations, markup, context identity changes, durable quota reservation and exhaustion, duplicate creation protection, missing configuration, invalid origins, overlong questions, usage reporting and sanitized transport failures. Full browser and optional real-provider evidence are recorded in the milestone report by the integration owner.
