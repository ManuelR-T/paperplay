# Local import persistence and recovery — M2

`lib/import-storage.ts` stores imported sources, their optional original PDF blobs, validated analysis results and accepted signed job references in the browser's versioned IndexedDB database `paperplay-imports`. There are no user accounts or cross-device synchronization. Private provider credentials are never part of these records.

The current database version is 1. Creating a fresh database creates the `imports` object store without deleting other data. A future database version is rejected explicitly instead of being reset or downgraded. Invalid saved records are skipped with a warning while other valid papers remain available; they are not silently deleted. Source and figure validation runs when records are read. Quota, unavailable storage and blocked upgrades have explicit messages.

## Before and after a paid request

The client controller persists the source checkpoint, then a `submitting` checkpoint with a request identifier, **before** calling `/api/analysis/start`. If either save fails, it does not start paid work. Once a signed job handle is returned, it is saved before normal status polling. If a later save fails, the in-memory document remains usable, but the warning explicitly states that reload recovery is not assured.

An accepted job is retrieved through `/api/analysis/status`; resuming never calls `/start`. The final result is checked against the original source before it can be activated or persisted as complete. Original source blocks remain unchanged; the result may contain validated additional anchors in its own document copy.

A lost or unreadable creation response can mean Meta accepted the request without the browser receiving its handle. This becomes `uncertain`, not an automatically retried failure. A saved `submitting` checkpoint without a handle becomes uncertain on reopen as well. The UI must not offer an automatic resubmission for such a record. Removing an uncertain local record does not cancel an unidentifiable provider request, and the controller explains this limitation.

## Reload, network loss and cancellation

Restoring a completed analysis requires no provider call. Restoring an accepted pending job resumes status retrieval only. Polling is bounded to at most 120 attempts with a default two-second interval. Network failures pause status retrieval while keeping the accepted reference; the reader can use Resume. Poll exhaustion also leaves the accepted job available to resume. Neither path silently creates a replacement analysis.

PDF extraction uses an AbortController and reports actual page progress when available. Cancelling extraction does not cancel a previously selected paper's provider job. Cancelling accepted model work calls the cancellation route and handles a completion/cancellation race according to the returned server state. If cancellation cannot be confirmed, the reference is retained. Removing a pending record first attempts cancellation; if it remains pending, its recovery record is kept.

One import/analysis orchestration operation is active at a time, while the reader may switch between prepared and imported papers. Generation/lifecycle guards keep obsolete async completions from overwriting newer operations. A write queue orders checkpoints and deletion. React Strict Mode cleanup only aborts the local operation; reactivation restores pending work without creating new paid requests.

## Browser APIs and verification

`useImportController()` is the React adapter for the dependency-injected `ImportController`. Its state includes `records`, `current`, `stage`, `busy`, `error`, `warning` and optional page progress. Its actions are import PDF/arXiv, analyze, resume, cancel, select, remove and refresh. `select('')` returns the workspace to prepared-paper selection.

Tests use real `fake-indexeddb` storage and fixture network transports, without paid calls. They cover persisted blobs/job handles, corrupted/newer database records, deletion, source/submitting checkpoint ordering, unknown submission outcomes, pending reload, finite polling, network pause, final-result validation, known configuration failures and cancellation isolation. Browser end-to-end checks are recorded in the parent milestone report.
