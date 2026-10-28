# Opt-in data and compute broker discovery (PP-106)

This discovery implements a browser local-file adapter and one application-owned **deterministic fake** job adapter. No external dataset service, trained-weight loader, GPU provider, deployment, credential picker or scientific model execution is installed. The demo sends explicitly selected scientific manifests to this application's server, validates their identity and returns synthetic engineering counts. Zero USD is a fixed protocol constraint, not an estimate for a real provider.

[The primary-source research and admission design](external-adapters-research.md) records why a future real adapter needs its own idempotency, cancellation, cost, retention, endpoint/credential and result-format review. The fake's at-most-one creation behavior does not establish a universal exactly-once guarantee for remote paid side effects.

## Requirements and local fallback

Representation plans may declare bounded `externalRequirements` for datasets, weights and compute, with exact source anchors, content fingerprint, expected version/hash/size, availability hint and an explicit blocking policy. Blocking unmet requirements appear by name in the capability-gap report. Optional requirements preserve local source guides and reported/conceptual alternatives.

For a local dataset match, `expectedSha256` means an existing **ScientificAsset manifest-and-data checksum**, and expected bytes count its serialized UTF-8 manifest. It is not the original-file digest. Only a checked local asset can satisfy the match. A declared `available` status, copied JSON, unknown release version, unrelated weight file or ordinary local table cannot grant an execution capability. Weights and real heavy compute remain named gaps. Requirement metadata is inert and cannot authorize a broker request or scientific verification.

The Files & source panel demonstrates those distinctions with clearly labeled adapter-demo requirements, not inferred needs of the paper being read. The existing scientific importer previews and confirms CSV/JSON locally. `importBrokerLocalFile` also exposes that bounded confirmation contract, preserving original byte identity and UTF-8 errors. Importing or adding the synthetic two-row fixture leaves upload selection empty.

## Frozen selection, disclosure and action

`prepareBrokerRun` works entirely locally. It validates the actual source and checked selected assets; freezes the adapter/version, run UUID, source fingerprint, selected IDs, manifest checksums, exact serialized byte lengths/hashes and resource budget; and hashes the canonical request and disclosure. Empty selection means no input assets. A private local preparation receipt cannot be reconstructed from copied JSON. At most four prepared runs are retained in the UI's memory; private prepared bytes are not persisted for recovery.

The disclosure names the fixed application-server recipient, purpose, included data/excerpts, retention, cancellation limits and zero actual charge. Selected manifests can contain quoted source passages, provenance, rights and private derived values; those are explicitly included. No entire PDF, conversation or unselected attachment is appended. Changing selection, manifest identity or budget invalidates the visible review and consent.

Only **Start demo job**, after authorizing that particular reviewed run, calls server prepare/start. The server signs a ten-minute owner-bound review token; start requires its exact consent/review hash and byte-identical selected payloads. Reopening, importing, editing, rendering, requirement inspection, reviewing locally and generated SDK events do not submit work. Recovery is a separate explicit metadata request.

## Durable jobs and bounded resources

Six same-origin POST routes provide prepare, start, status, cancel, collect and list. JSON bodies are streamed and actual UTF-8 bytes counted, with compressed bodies rejected. The transport ceiling is 6 MiB to allow a nested JSON encoding of at most 2 MiB of selected manifests; exact selected bytes still obey the smaller per-run budget. Output collection verifies the raw serialized byte length/hash and existing scientific manifest checksum separately. Each client transport has a maximum 30-second deadline and never automatically retries creation.

The immutable budget allows one creation, at most eight selected manifests/2 MiB input, 2 MiB output, a five-minute simulated execution deadline, 60 charged status/resume checks and eight collections (default four). A new submission includes one initial fixed reconciliation; duplicate starts, including the creation-disabled recovery branch, consume retrieval budget before any further lookup. There is at most one initial cancellation call; repeats do not recontact the adapter, and bounded status requests reconcile confirmation. Stop polling only stops local retrieval. Cancellation-requested is distinct from cancelled, and completion can win a late cancellation.

SQLite transactions atomically claim the globally unique run UUID, owner, immutable review and creation reservation. Only the first claim may call the fake adapter's create function. Durable fake-provider state is independently keyed and survives restart. Retries/recovery only look up the same key, including response loss after acceptance. Ambiguous acceptance stays uncertain and conservatively reserved; no replacement submission is invented. Uncertainty can remain unresolved when no accepted provider reference is discoverable. Terminal state/output identity and measured resource counters cannot regress under concurrent or stale operations.

Admission additionally limits each browser owner to 20 runs/day, the host to 200/day and the durable store to 10,000 records. New creation can be disabled while accepted-job retrieval/cancellation remains available under its own limits. Two SQLite connections and separate Node processes exercise contention. This prototype uses atomic transactional updates/direct retrieval, not a provisioned background queue or a general real-provider lease/fencing implementation.

The default store is `.paperplay/broker.sqlite`. No uploaded manifest bytes are persisted. Reviewed metadata and small synthetic engineering results remain until server data is removed; collection expires after 24 hours. That is collection expiry, not a promise of physical deletion. Tombstones preserve idempotency instead of silently allowing an old run to be recreated. A future real adapter needs explicit storage/deletion and billing policies.

## Ownership and returned evidence

Broker ownership uses its own HttpOnly/SameSite cookie, `paperplay_broker_session`, independently of Meta's existing analysis cookie. A separate server signing key is generated lazily, atomically and with mode 0600 under the ignored `.paperplay` directory, or supplied through `BROKER_SIGNING_SECRET`. A Meta API key is not required. The current SQLite backend fails closed for distributed/serverless deployments; shared-ledger provisioning is separate release work. No key or provider/owner credential enters guest inputs or portable science artifacts.

Collection binds run/request/review hashes, adapter/version, exact current source fingerprint, selected input hashes, budget, output schema/bytes and manifest identity. Recovery can reconstruct that binding from accepted metadata without retaining or re-uploading private prepared payloads. A returned declaration is not an integrity receipt: the client admits the result locally through the existing checked-asset mechanism. The result must remain **illustrative engineering output**; it is never relabeled as observed data or independently verified science. Rejected returned text is bounded and explicitly downloadable, and a previous valid result remains available.

The fake is metadata in the capability catalog, not an executable adapter in the ordinary representation registry. Generated manifests cannot request broker privileges or arbitrary endpoints/credentials. The QuickJS/data-only SDK has no broker callback, fetch, owner session or upload permit. An actual guest attempt to call the same-origin broker route cannot reach the host fetch. A real external adapter must be admitted through trusted application code and explicit bounded consent, not imported code or a model-chosen URL.

## Verification

`npm run check` passes TypeScript, 611 tests and production build, including 33 broker tests. Coverage includes process contention, globally unique run ownership, pre/postacceptance ambiguity, restart recovery, exact consent/source/input/output identity, stream limits, collection expiry, quota separation, cancellation/completion races, disabled creation, private receipt boundaries and guest isolation.

The complete suite also exposed an existing finite-program interpreter conformance fixture racing its 100 ms production budget under concurrent Node test load. Its test-only reference adapter now uses the same one-second allowance as other finite interpreter fixtures and asserts the generated production policy remains 100 ms. Runaway/deadline tests and production resource limits are unchanged.

[Native-browser evidence](../data/broker-browser.json) records no broker requests before explicit start, empty initial selection, exact local matching, an 826-byte selected fixture, same-job recovery without original payloads, verified 932-byte synthetic output, rejected tampering with prior result retained, explicit cancellation, local CSV confirmation without upload, source-scoped recovery and mobile enlarged text. No real provider, paid inference, held-out evaluation, human study or Railway release was used.
