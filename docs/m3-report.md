# M3 — Local experiments, contextual questions, sharing and usage controls

Implemented and verified locally on 27 October 2026: PP-027–PP-032. The production build runs locally. No public deployment or remotely provisioned Redis service is claimed.

## Delivered

| Issue | Result | Main evidence |
| --- | --- | --- |
| PP-027 | Contextual questions for passages, equations and figures; current input/parameters recomputed by trusted server engines; exact source citations; stale answers cleared | `lib/questions.ts`, `server/questions/`, `components/contextual-question.tsx`, `tests/questions.test.ts` |
| PP-028 | Reading position, selected figure, seed, input, method, parameters, playback and explanatory step restored locally; recent papers; associated settings removed on deletion | `lib/reading-state.ts`, `components/reading-session.tsx`, `tests/snapshots.test.ts` |
| PP-029 | Bounded versioned public URL snapshots for prepared mechanism figures; clean-browser restoration without inference | `lib/snapshots.ts`, `components/experiment-actions.tsx` |
| PP-030 | Versioned downloadable JSON bundles; explicit source-text/PDF inclusion; attribution retained; validated imports and clear missing-source errors | `lib/snapshots.ts`, workspace and reader integration, snapshot tests |
| PP-031 | Durable shared quotas before analysis/question creation, signed anonymous ownership, persistent deduplication, conservative unresolved reservations, distributed-host fail-closed behavior | `server/usage/`, analysis/question handlers, `tests/usage.test.ts` |
| PP-032 | Actual result/model usage, saved-analysis reuse labels, privacy-preserving operator summary and distinct failure states | `npm run usage:summary`, `docs/usage-controls.md` |

## Real browser and provider observations

The collaborative browser changed a prepared graph edge weight from its default to 19, moved playback, and reloaded. The edited input, playback state and reading position were restored. A separate incognito profile opened the generated public URL and received the same edge weight, seed and method without any analysis/question request. A downloaded public metadata bundle restored the experiment after another edit, and the restored values survived refresh.

The sorting paper was selected, its seed changed to 91, and input regenerated. A reload restored that selected paper and seed. Recent-paper state updated. Generated conceptual steps were restored as well as computed figures; playback resumes paused rather than automatically running an animation.

Two small actual questions were sent to the official configured Meta API, model `muse-spark-1.3`:

- A figure question about the changed graph correctly reported final synthetic distance 4 via S→B→A→T. It distinguished the selected early step (tentative distance 19 on S→A) from complete-run operation counts, and disclosed that the binary heap illustrates the paper's background rather than reproducing its verified data structure. Reported usage: 1,198 input / 1,165 output tokens.
- A selected `getmin` type-signature equation received an explanation of its symbols and explicitly stated that selecting an equation had executed no tree search or benchmark. Reported usage: 685 input / 869 output tokens.

Both answers passed exact source quote/page validation. Changing the figure input and reopening its question cleared the old answer and draft. Asking is an explicit action; reading, playback, seed changes, sharing and restoration do not call inference. No conversation history is submitted. The ledger summary reported exactly two completed questions and 3,917 measured total tokens. No dollar cost or remaining-credit estimate is invented.

An existing imported source was exported through the UI with both inclusion checkboxes explicitly selected. The downloaded 744,211-byte bundle contained its source text, original PDF and one figure; it contained no saved provider job capability. The incognito profile imported it without Meta inference. It displayed the figure as an **imported experiment snapshot**, retained the PDF as a local Blob link, and restored the selected explanatory step after reload. Deleting it removed the IndexedDB record, reading state and recent entry. A metadata-only export of that now-unavailable local source produced an actionable missing-source message.

Public metadata bundles retain the prepared paper's license/attribution. Imported source bundles retain supplied attribution but cannot attest its authorship or redistribution rights. No bundle overwrites the canonical prepared source registry. Prepared snapshots additionally enforce the registered figure ID, source anchor, input family and engine compatibility.

Desktop (1280px), 390px and 320px browser checks found no document-wide horizontal overflow. Question inputs use 16px text; source reading and auxiliary text retain the M1/M2 readability improvements.

## Actual server enforcement

Four independent Node processes competed for five slots in one SQLite database: exactly five of sixteen reservations succeeded. Separate handler instances recovered a previously accepted provider reference without a new paid creation. Changed-owner/context reservations and signed job tampering were rejected.

A separate optimized production server ran with `USAGE_DAILY_TOKENS=1` and an isolated temporary SQLite file. Direct HTTP POSTs to `/api/analysis/start` and `/api/questions` both returned HTTP 429. Its ledger contained zero requests and zero measured tokens; no paid provider operation was started. A second production configuration with `PAPERPLAY_DEPLOYMENT=distributed` and no Redis credentials returned HTTP 503 for both routes before inference. These checks tested API enforcement, not UI disabling.

Accepted/in-progress/uncertain work keeps its conservative reservation even if an early provider response reports zero/partial usage. Only terminal usage replaces that allowance. Delayed status responses cannot erase final usage or downgrade completed accounting. Reporting failures preserve the existing reservation, the recoverable analysis capability, the validated question answer or the original provider uncertainty as appropriate.

## Repeatable validation and deployment boundary

`npm run check` passes: strict TypeScript, **95 provider-free tests**, optimized Next production build. Tests cover source/engine/version incompatibility, bounded/malformed URL and bundle data, source/PDF inclusion declarations, exact citations, changed parameters, incomplete/unexecuted runs, endpoint ownership, persistence, quotas, concurrency, ambiguous sends and reporting failures. Live provider calls are outside CI.

The production trace excludes `.env*` and `.paperplay/**`; generated route trace manifests contained no local environment file or usage ledger. The ledger is runtime writable state, not a deployment asset. Node 24 currently emits its upstream experimental SQLite warning; this is documented and does not prevent the build or checks.

SQLite is reliable for multiple processes sharing the same persistent local volume. It is not a quota shared across independent serverless instances. The Redis REST adapter uses atomic Lua transactions and has transport/failure tests, but **a real remote Redis deployment has not been provisioned or exercised**. Before a public distributed deployment in M4, configure the same durable Redis service/namespace on all replicas and verify quota denial with actual replicas. Paid requests fail closed until that configuration exists; there is no process-memory fallback. `ANALYSIS_APP_ORIGIN` must match the hosted origin.

The default shared allowance is 20 creations/questions per rolling hour, 5 per anonymous session per ten minutes, 100 per UTC day and 2,000,000 accounted tokens per day. Unknown usage reserves a deliberately conservative token estimate. These limits are not a financial billing cap; Meta billing remains the source of truth. The CLI prints only aggregate metadata, never paper bodies, questions, answers, cookies or API keys.

URL snapshots currently cover small prepared mechanism figures only (8,000 decoded bytes / 12,000 encoded characters). Other figures and private sources use bundles (20 MiB file, original PDF up to 10 MiB). Storage remains browser-local; no accounts, cloud synchronization or public paper uploads were added. M4 evaluation/accessibility review, real hosting and delivery remain planned. No commits, tracker issues or deployments were created.

Further references: [contextual questions](contextual-questions.md), [snapshots and bundles](experiment-snapshots.md), [usage controls](usage-controls.md), [M2 limits](m2-report.md).
