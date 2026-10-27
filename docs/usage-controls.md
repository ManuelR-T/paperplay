# Shared inference usage controls — M3

Analysis creation and contextual questions share the same durable quota ledger. The server reserves capacity **before** sending any paid request. Retrieval and cancellation of already accepted jobs are not charged as new inference requests. No source text, prompt, answer, API key, cookie or full provider error is stored in this ledger.

## Stores and hosting

The default for a local/single-host installation is Node's built-in SQLite database at `.paperplay/usage.sqlite` (`USAGE_SQLITE_PATH` overrides it). Node 24.14 supports this API but currently emits an experimental-feature warning. Its `BEGIN IMMEDIATE` transaction, WAL journal and busy timeout serialize reservations from processes sharing that same persistent volume. A local file on one host is **not** a quota shared across independent serverless instances. Keep the database directory private and persistent if restarting a single-host deployment.

Distributed hosting uses Redis REST with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Reservation checks and insertion happen in one Redis `EVAL` Lua transaction; a pipeline of separate counter commands would not be sufficient. Configure the same `USAGE_NAMESPACE` and limits on every replica, and use a durable Redis database with a no-eviction policy appropriate for quota records. Losing/clearing the quota database resets accounting; this is an operator responsibility, not a billing guarantee.

Set `PAPERPLAY_DEPLOYMENT=distributed` for multi-instance hosts. Vercel, AWS Lambda and Cloudflare Pages environment markers also enable that requirement. In this mode, missing Redis configuration fails closed with HTTP 503 **before inference**. Invalid credentials, unavailable storage, malformed responses and quota exhaustion similarly do not fall back to process memory. SQLite is appropriate only when every server process shares the same reliable local volume. A hosted origin also needs the separate exact `ANALYSIS_APP_ORIGIN` setting described in the M2 report.

The Redis transport follows [Upstash's official REST command-body contract](https://upstash.com/docs/redis/features/restapi): HTTPS POST with a JSON command array and an Authorization header. Credentials are server-side only and never placed in URLs or operator output. REST calls time out after eight seconds and are not automatically retried. An ambiguous reservation can consume allowance without a provider call; this conservative behavior avoids overspending.

## Limits and accounting

| Variable | Default | Applies to |
| --- | --- | --- |
| `USAGE_HOURLY_REQUESTS` | 20 | All creation/question reservations in a rolling hour |
| `USAGE_SESSION_REQUESTS` | 5 | One anonymous session in a rolling ten-minute window |
| `USAGE_DAILY_REQUESTS` | 100 | Shared UTC-calendar-day request reservations |
| `USAGE_DAILY_TOKENS` | 2,000,000 | Shared UTC-calendar-day measured tokens plus unresolved reservations |

All values must be positive whole numbers. Limits apply at server endpoints, including direct requests; disabling a UI button is not the enforcement mechanism. Browser/session limits complement the shared global limits, since users can clear anonymous cookies. Requests rejected before reservation do not use allowance. A confirmed provider rejection retains its request-count entry but releases its token reservation. Unknown submission outcomes, accepted work without reported usage and cancelled jobs without usage retain a conservative reservation.

The reservation is `4 × inputCharacters + 16,000 + maxOutputTokens`: an explicit conservative capacity estimate for UTF-8 input and fixed system/schema/catalog overhead, not a measured token count or a quoted financial price. Final provider-reported input/output/total usage replaces it when terminal, including failed validation after completed inference. Partial or zero usage on queued/running/uncertain work never releases its full reservation. Output is capped separately in the provider call (6,000 tokens for analyses; the question adapter uses its own smaller cap). The budget is a token allowance, **not a hard dollar cap or a statement of remaining Meta credits**. Meta project/billing controls and the provider dashboard remain the financial source of truth.

Ledger records retain request identity, opaque anonymous session identity, operation kind, model, source/context fingerprint, timestamps, state, reserved count, optional background provider ID and optional measured usage. Reservations are retained for 30 days and cleaned on subsequent creation. Summaries cover the current UTC day. Configure retention/access in accordance with the intended deployment.

## Deduplication and recovery

The idempotency key is SHA-256 of anonymous session ID plus client request ID. A duplicate with changed source/context/model/limits is rejected. A duplicate with an accepted saved provider ID can recover the signed background capability across application processes/restarts. A reservation without an accepted reference cannot prove whether inference was accepted; it returns an explicit uncertain state and never creates replacement work. The UI can still reopen completed IndexedDB results without any server inference request.

Signed M2 job capabilities continue to enforce session/source ownership for retrieve/cancel. M3 capabilities include a ledger reference for reporting. Historical M2 capabilities without that reference remain readable, but their old consumption is labeled unavailable rather than invented. Request deduplication in memory is only an optimization over the durable reservation; it is no longer the quota authority.

If reporting fails after inference is accepted, the server preserves the recoverable job capability. The existing conservative reservation remains accounted until a later successful status report records measured usage. This reporting failure never silently releases capacity or turns a completed response into a request for another paid run.

## Operator summary

Run `npm run usage:summary` in the same environment as the server. It reads the selected durable store and prints UTC-day aggregate request counts by kind and state, provider-reported measured tokens, unmeasured requests/reserved capacity and configured limits. It never prints credentials, session IDs, provider response IDs, source bodies or question/answer text. The UI shows each available result's measured provider usage and model; absent usage is unavailable, not zero consumption.

Relevant failure distinctions in the ledger are `rejected` (confirmed no acceptance), `uncertain` (acceptance unknown), `accepted`, provider `failed`/`incomplete`/`cancelled`, `completed`, and `validation_failed` (inference completed but generated figures were rejected). Extraction fails before any reservation and is displayed by the import UI, so it does not appear as an inference expense. Reopening an existing result is local reuse, not another billable run.

## Verification and limits of the evidence

`tests/usage.test.ts` checks atomic local quotas across **four separate Node processes** sharing one SQLite database: with a limit of five, exactly five of sixteen competing reservations succeed. Independent store/handler instances recover persisted reservations, reject changed owners and prevent duplicate inference. Analysis and question reservations share session/token budgets; unknown usage remains conservatively accounted; measured usage and terminal status survive delayed status updates. Hosted-without-Redis and unavailable-store direct handler checks make zero provider calls.

The Redis adapter has network-free transport/schema tests verifying atomic `EVAL`, safe failure and no memory fallback. A real Redis deployment has **not** been provisioned or exercised by those tests. Before publishing a distributed deployment, configure the actual shared Redis service, exercise two server replicas against a deliberately low allowance, and confirm quota denial at the API while accepted retrieval/cancellation remains available. M3 local multi-process checks are not represented as remote deployment verification.

## Cloudflare D1 deployment adapter

The Worker deployment can inject `createD1UsageStore({db: env.DB})` from `server/usage/d1.ts` into the same analysis/question handlers. This is an alternative shared durable backend; it does not use a local SQLite file or require Redis. Apply `deploy/migrations/0000_paperplay.sql` through the deployment platform before enabling inference. Public request handlers never create or reset database tables.

Reservation uses a single conditional `INSERT … SELECT` statement containing every request and token limit check. It is not an asynchronous read-then-insert quota. D1's returned `meta.changes` distinguishes the winning insert from a repeated request, and the stored identity is checked before a duplicate can recover work. Measured updates use compare-and-swap against the previous JSON record so a concurrent stale status cannot erase final usage. Failed operations retain allowance or fail closed, rather than falling back to memory.

The adapter uses the plain D1 database binding without the Sessions API. Cloudflare documents that queries without that API execute against the primary database; no read-replica staleness assumption is introduced. The relevant platform contracts are [prepared statements and return values](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) and [read replication/session consistency](https://developers.cloudflare.com/d1/best-practices/read-replication/). D1's [current limits](https://developers.cloudflare.com/d1/platform/limits/) allow the adapter's 13 bound parameters and small metadata rows; this is not a guarantee of free account allowance or uptime.

`tests/d1-usage.test.ts` executes the exact adapter SQL against real SQLite/JSON1 using a structural D1 binding. Four connections/adapter instances admit exactly five of sixteen concurrent creation attempts for a five-slot limit. Additional tests cover changed owners, shared analysis/question allowance, conservative partial usage, terminal-update races, quota/database errors and retention. These local SQL tests do not by themselves claim a remotely provisioned Cloudflare D1 database was exercised; record remote deployment verification separately.
