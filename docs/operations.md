# Operations and post-credit mode

Final release target: Railway, deferred until release. The [Railway plan](railway-release.md) proposes one Node instance with persistent SQLite and explicit access/operating checks; this is not yet configured. Existing Sites/D1 observations remain historical.

Checked against the implementation on 27 October 2026. See [deployment](deployment.md) for the two runtime targets and [Meta setup](meta-setup.md) for provider configuration.

## Stop new inference work

Set `META_ANALYSIS_ENABLED=false` on the server to stop new analysis and source-question requests. Alternatively, set `META_CREDITS_EXPIRE_AT` to an operator-selected ISO timestamp with an explicit offset, such as `2026-11-06T00:00:00Z`. At or after that instant, new inference creation stops. This example is not an assertion about the account's real expiry date. Restart the Node process or redeploy the hosted runtime after changing its environment.

Keep `MODEL_API_KEY` and signing configuration available while accepted jobs need retrieval or cancellation. Disabling creation keeps those operations available; removing the provider key prevents contacting the provider to retrieve or cancel them. Changing the signing key can invalidate saved job handles. Cancellation is best effort and does not establish that a request cost nothing.

Prepared papers, local simulations, source reading, downloaded bundles and previously saved results remain usable without new inference. `/api/health` reports `meta.configured: false` with a disabled reason when the operator switch or cutoff applies. This field describes whether new requests are configured, rather than the validity of every saved job or an account balance.

The cutoff does not inspect Meta billing. Check the provider dashboard for actual access, credit expiry and remaining funds. Paperplay does not convert tokens into a guaranteed dollar balance. See the official [Responses API](https://dev.meta.ai/docs/protocols/responses) and [retrieval reference](https://dev.meta.ai/docs/api-reference/responses/retrieve-response) for provider behavior.

## Durable limits

The defaults are 60 global creations per hour, 15 per anonymous session per ten minutes, 100 per UTC day and 2,000,000 accounted tokens per UTC day. Override them through `USAGE_HOURLY_REQUESTS`, `USAGE_SESSION_REQUESTS`, `USAGE_DAILY_REQUESTS` and `USAGE_DAILY_TOKENS`. These are application safeguards, not purchased provider allowances or a complete defense against determined anonymous abuse. Start with conservative limits for a public demo.

A bounded automatic paper may create four section plans and one custom figure. The former five-request session burst admitted only one such paper before blocking the next; the new burst admits three while retaining the same daily request/token ceilings. Quota responses identify the exhausted window and provide `Retry-After` plus an absolute retry time. The reader shows a waiting countdown and automatically resumes the same request identity when permitted; it does not clear the ledger or replace accepted/uncertain jobs.

Reservations are made before provider creation. Pending or unmeasured work retains a conservative token reservation; a measured terminal response reconciles it. Provider billing remains authoritative. An interrupted or uncertain creation must not be treated as free work and automatically recreated.

| Runtime | Shared quota store | Public short-link store |
| --- | --- | --- |
| Local or one persistent Node host | SQLite at `.paperplay/usage.sqlite`, override `USAGE_SQLITE_PATH` | SQLite at `.paperplay/short-links.sqlite`, override `SHORT_LINKS_SQLITE_PATH` |
| Distributed Node deployment | Upstash-compatible Redis REST, configured through `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and optional `USAGE_NAMESPACE` | Not supplied by the Node Redis quota adapter; the distributed Node route fails closed |
| Hosted Sites Worker | Shared D1 binding `DB`, injected by the hosting adapter | Same D1 database, separate tables |

For Node replicas, set `PAPERPLAY_DEPLOYMENT=distributed`; all replicas must use the same Redis database and namespace. Recognized serverless environments also require a shared store. Missing or unavailable quota infrastructure prevents new paid work before a provider request. Multiple processes on one persistent host may share the same SQLite volume. Ephemeral per-replica SQLite files do not provide distributed quotas.

The Sites build uses its D1 adapter directly. It does not require the Node Redis variables, and it cannot silently fall back to Node SQLite. With missing D1, new paid work and public-link storage fail closed. Signed accepted-job retrieval/cancellation can still use the provider while quota reporting is unavailable. This separation keeps recovery available without authorizing another creation.

## Usage, retention and privacy

On the Node runtime, run `npm run usage:summary` for the durable ledger's aggregate request/token summary. It does not call Meta or report a currency balance. The local CLI reads the configured SQLite/Redis adapter; it is not a D1 administration client. Use authorized hosting database/observability tools for D1 operations, and avoid exporting source bodies or credentials into logs.

Ledger housekeeping retains 30 days of accounting records. It records reservation/status/usage metadata, not paper bodies, questions, answers or provider credentials. Keep the SQLite directory writable and persistent; back it up if continuity of quotas matters. Restoring an older quota ledger can undercount subsequent work, so disable creation during a recovery and reconcile before reopening it.

Public short links expire after seven days and only hold a bounded canonical snapshot of a prepared public example. Imported private-paper snapshots require explicit downloaded bundles instead. Preserve the deletion token privately; deleting a link cannot revoke copies someone already downloaded. Preserve stable signing secrets across restarts. See [security boundaries](../SECURITY.md).

## Capacity and outage checks

The hosted Worker has a 128 MB memory limit per isolate, including JavaScript and WebAssembly allocations. CPU, requests, connections and D1 query/storage limits also apply and depend on the actual hosting plan. Verify that plan rather than assuming a free allowance. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

PDF extraction and numeric execution run in browser workers; the server validates bounded source/plan payloads and talks to the provider. This reduces hosted computation but does not prove capacity under concurrent load. A deployment still needs a realistic bounded smoke test; local success is not hosted load evidence.

If Meta is unavailable or credits expire, disable new creation and use the prepared or saved-result demo. If the quota store is unavailable, restore the shared store before reopening creation. If an accepted request has an uncertain outcome, resume its existing handle before deciding whether to create another. Never add a blind retry loop around paid creation.

## Evidence limits

The provider-free suite exercises the operator disable/cutoff and existing-job recovery behavior. [Clean source installation](clean-install-report.md) proves the prepared numeric workspace works without a key on a local production build. Hosted publication, hosted authenticated access and a hosted live-inference run require separate release evidence. No fresh provider calls were made to write this runbook.
