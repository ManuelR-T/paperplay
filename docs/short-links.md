# Optional durable public snapshot links

PP-044 is selected by the request to implement all M5 extensions. This is a narrow opt-in service for **prepared public mechanism figures**, not a central paper library. Existing full URL snapshots and local bundles remain available independently.

## Inclusion and access design

“Create 7-day link” is an explicit button under “Optional 7-day public link”. Its disclosure says that it stores the public demo's input, seed and engine settings. The endpoint accepts only a compatible prepared primary snapshot through `encodePublicSnapshot`. It never accepts a source document, imported/private source, PDF, analysis result, API credential or provider job reference. Canonical public figure metadata is reconstructed from the registered preset rather than retaining arbitrary client descriptive strings. Input node labels and numeric values remain the explicitly shared experiment data.

The public identifier is 128 random bits. Anyone with `/s/<id>` may read it until its seven-day expiry. Resolving performs no inference; it validates the current source/engine versions and redirects to the existing full URL snapshot mechanism. Corrupt or incompatible payloads do not activate. Redirects use a fixed relative `/#snapshot=…` location, never a client-supplied destination.

Creation returns a separate 256-bit deletion capability once. Only its SHA-256 digest is stored server-side. The plaintext capability is saved in this browser's local storage and never placed in the public URL, copied public link or exported experiment. Losing that browser data loses deletion control, but the public link still expires. Deletion is authorized by capability possession rather than an account; guessing the public identifier alone cannot delete it.

Deleting clears the active payload and deletion digest immediately. Minimal creation metadata becomes a tombstone until expiry so repeated create/delete operations cannot reset the abuse allowance. Expiry stops public access after seven days. Old rows are cleaned on later creations; inactive database rows and infrastructure backups are not represented as being physically erased at the exact expiry instant.

## Storage and bounds

Local Next installations use a private SQLite file at `.paperplay/short-links.sqlite`, overridable with `SHORT_LINKS_SQLITE_PATH`. The service shares the analysis session signing key when configured, retaining the same anonymous session identity. Without Meta configuration, a stable `SHORT_LINKS_SIGNING_SECRET` can enable this feature. Missing stable signing/storage configuration returns an actionable HTTP 503; local reading, full URLs and bundles still work.

The Worker deployment injects `createD1ShortLinkStore({db: env.DB})` and `createShortLinkHandlers({store,signingSecret,allowedOrigin})`. Apply `deploy/migrations/0000_paperplay.sql` through the hosting platform before enabling requests. No D1 runtime request creates or resets the schema. The injected `signingSecret` is the final session signing key, the same `signingKey(MODEL_API_KEY, ANALYSIS_SIGNING_SECRET)` derivation as analysis, so using a short link does not invalidate pending-job ownership.

Creation has atomic limits of ten links per anonymous session per rolling hour and one hundred globally per UTC day. A single conditional SQL insert checks and inserts in one statement on both stores. Deletion keeps its creation-count tombstone; no asynchronous check-then-insert race or memory-only fallback is used. Cookie clearing cannot bypass the shared daily limit.

Each snapshot retains the existing 8,000 decoded-byte / 12,000 encoded-character limit. At one hundred creations per day and seven-day access lifetime, active payload storage is bounded to a small number of megabytes before indexes, tombstones and platform backups. This is an engineering bound, not a quoted provider price or guaranteed free tier. No new paid hosting service or account system is required by the implementation. The platform dashboard remains the source for actual storage costs and retention.

## APIs

- `POST /api/short-links` with `{snapshot}` returns HTTP 201 `{id,path,expiresAt,deleteToken}`. Creation requires the configured same origin.
- `DELETE /api/short-links` with `{id,deleteToken}` removes an active payload. It also requires the configured same origin. An absent, expired, deleted or incorrectly authorized link returns HTTP 404.
- `GET /s/<id>` is publicly readable and returns HTTP 302 to the validated full snapshot. Expired/deleted/incompatible links return HTTP 410 with a readable route back to the workspace.

The client preserves local deletion controls and explicitly warns if they cannot be saved. The server logs no full payload, private capability or paper body. Creation itself never calls Meta or spends inference tokens.

## Verification

`npx tsx --test tests/short-links.test.ts` verifies canonical public restoration, absent deletion secrets in public resolution, wrong-capability rejection, genuine deletion/expiry, source/schema/version/origin restrictions, missing configuration, quota exhaustion and storage failure. The D1 test executes real SQLite/JSON1 statements through the structural binding: four independent store instances admit exactly one hundred of one hundred twenty concurrent attempts. Deleting a link does not open a new global slot. A separate session test creates and deletes ten links, then confirms the eleventh is denied.

These tests validate the exact SQL and handler behavior. Browser deployment/remote D1 observations are recorded in the release report; local tests alone do not claim a hosted endpoint was provisioned or exercised.
