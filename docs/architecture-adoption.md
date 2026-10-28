# Architecture adoption and compatibility — PP116

PP116 / [#71](https://github.com/ManuelR-T/paperplay/issues/71) introduces local operator gates and a staged compatibility inspection. It preserves the current private reader and its declarative widgets. This is implementation and engineering evidence, not a public rollout, scientific endorsement or completed reader study.

## Operator policy

The public, credential-free [policy contract](../shared/adoption.ts) separates generated execution from new model creation:

| Setting | Default | Disabled behavior |
| --- | --- | --- |
| `PAPERPLAY_GENERATED_EXECUTION_ENABLED` | Unset or exactly `true` preserves the existing **explicit Run** workflow. | Exactly `false`, or any other supplied value, denies generated compilation/execution and new generated-artifact creation. Source, notes, downloads and available recorded replay remain accessible. |
| `META_ANALYSIS_ENABLED` | Existing default is `true`; creation still requires valid server configuration, credentials and quota. | `false` denies new model creation. Accepted jobs remain eligible for their existing retrieval/cancellation paths. Invalid configuration cannot authorize creation. |
| `META_CREDITS_EXPIRE_AT` | No cutoff when absent. | A reached cutoff denies new creation. The public policy also denies creation for an invalid cutoff; it does not expose keys. |

These defaults retain the private app's explicit interaction. Installing/opening the app does not authorize generated execution. Existing isolation, source binding, local admission and resource checks still apply when the operator enables execution. A flag does not grant scientific verification or human-study approval. Trusted local declarative widgets remain available independently of the generated-code switch.

[`GET /api/adoption-policy`](../app/api/adoption-policy/route.ts) is dynamic and returns `Cache-Control: no-store, max-age=0`. It reads runtime environment metadata rather than baking policy into static page props. Changing deployment environment normally requires the operator's usual process restart; this feature does not provision or deploy anything.

The browser starts with policy **unknown**, which denies generated execution and new creation controls until a successful refresh. The application provider refreshes on mount and window focus; explicit compiler/runtime actions obtain fresh policy metadata too. An unavailable, invalid or oversized response fails closed for generated execution. This metadata request performs no inference and uploads no paper or dataset. There is no continuous policy poll or additional consent wizard.

The authoritative guards are in the [compiler client](../lib/artifacts/compiler-client.ts), [runtime client](../lib/artifacts/runtime-client.ts) and server handlers, not only their buttons. Compiler/runtime inputs are validated, bounded and privately copied synchronously before the policy wait; caller mutation cannot change the later worker payload. Policy is checked before infrastructure bootstrap and again at worker admission. Once a disabled/unavailable policy is observed, host-owned abort signals stop generated work in preparation, queue or execution. Revocation is observed through refresh, not server push; existing short worker deadlines remain in force between refreshes. Stop-all epochs also prevent pre-admission work from creating a worker later. Existing memory limits, CSP, serialized SDK boundary and private compiler receipts remain unchanged.

Imported JSON cannot install host policy, restore a compiler receipt, enable a capability or grant guest access to host services. The exact capability/version gate and existing representation registry require an installed exact version; there is no nearest-version substitution or discipline-specific fallback engine.

## Accepted work and recovery

The [enrichment](../server/enrichment/handlers.ts) and [artifact-generation](../server/artifact-generation/handlers.ts) handlers distinguish an accepted request from a new creation. The same frozen accepted request can recover under disabled creation without creating another provider job. Status and explicit cancellation remain available with the existing ownership/session, source/context and accepted-reference checks. A flag change never automatically cancels a remote job. New attempts or repairs remain new creation and are denied when their relevant switch is off.

Recovery still needs the original valid job capability and server credentials. Removing the signing/key material is not equivalent to switching creation off; saved source and references remain retained when retrieval cannot be authenticated.

**Known compatibility limitation:** the older fixed-catalog M2 analysis `start` endpoint still returns 503 for a retry while creation is disabled, including an already submitted request. Its existing **status/cancel** paths remain available. Use those accepted-reference paths; do not create a replacement job. PP116's idempotent-start recovery change applies to enrichment and generated-artifact runs.

The [actual accepted-job recovery record](../data/adoption-server-recovery.json) records policy switches off, HTTP 200 and completed retrieval of the existing C4 candidate with its original hash. It records **zero new CREATE requests** and publishes no cookie/job capabilities. Its token usage belongs to the earlier accepted job, not a new PP116 generation.

## Non-destructive compatibility inspection

[`inspectAdoptionRecord`](../lib/adoption/compatibility.ts) validates an explicitly supplied JSON record through the applicable existing format validators and returns its exact original string alongside a disposition. [`runAdoptionMigration`](../lib/adoption/migration.ts) produces a strict, content-hashed **dry-run** report. Neither API accepts a storage writer, launches a worker or calls a provider.

The staged run in [adoption-staging-report.json](adoption-staging-report.json) contains **20 fixtures in three batches**: release-1.1.0 snapshots; source-scoped import/reading/widget/workspace/enrichment records; and portable data-study, experiment, artifact, experience, extraction and cache formats. Its results are 13 compatible, two requiring recompilation, three read-only and two deliberately incompatible. Every batch records zero storage writes and zero executions; the overall fixture run records zero provider calls.

| Records | Admission/recovery behavior |
| --- | --- |
| Release 1.1.0 snapshot schema v1, reading state v1; current widgets/workspace v2 | Validate exact source, engine and format bindings. Preserve source position and original definitions; inspection itself does not execute them. |
| Saved enrichment v2, including the supported older catalog version | Validate through the existing parser. Keep accepted definitions and pending references; no creation, resubmission or original-byte rewrite occurs in inspection. |
| Local import records | Source/metadata remain readable. Historical analysis receives a structural, read-only inspection; the old full analysis validator can run engines, so that execution is deferred to normal explicit reopening rather than claimed as a dry-run. Binary PDF/Blob originals remain the responsibility of the existing reader/storage recovery path. |
| Data studies v1/v2 and experiment bundle v1 | Reuse existing bounded validators and exact asset/source requirements. Compatibility is structural acceptance, not a fresh scientific pass. |
| Generated artifact experiment v1 and saved build metadata | Require fresh local compilation for execution. Persisted metadata cannot reinstate the private in-memory admission. Missing exact source/assets retain an inert original or available recorded replay. |
| Scientific experience v1 and reports | Keep definitions, recorded captures and imported reports as historical data. Opening an interaction must pass its current host gates; imported reports do not acquire fresh verified labels. |
| Extraction evidence v1 | Verify the manifest/hash and available source binding. Do not reinterpret logical locators as original page geometry or retrieve supplementary files automatically. |
| Unknown format/version, corrupt or differently bound content | Return incompatibility/read-only recovery and retain original bytes. Never silently replace it with a nearby version, delete its store or invent a successful execution. |

The report lists fixture IDs, original JSON byte lengths/digests, dispositions and planned derived-cache invalidations. It does not copy source bodies, private notes, credentials or provider capabilities into the report. Validators may parse checked metadata internally; the report does not expose executable admissions. Inputs are limited to 20 MiB per record, 32 records and 40 MiB per inspection batch, with existing smaller format limits still enforced.

Reproduce the inspection with [`scripts/report-adoption.ts`](../scripts/report-adoption.ts):

```sh
npm run report:adoption
npm run report:adoption -- --output=/tmp/paperplay-adoption-new-report.json
```

Without `--output`, JSON goes to stdout. An explicit output writes only the new report file and refuses to overwrite an existing file. It never opens or rewrites user browser storage. The authored legacy fixture fixes its export timestamp; unchanged fixture inputs produce byte-identical reports. This does not rewrite any user export. Compare recorded input digests and report integrity hashes when fixtures change.

## Cache invalidation and rollback

The cache plan distinguishes accepted originals from derived records:

| Changed identity/version | Derived records to invalidate |
| --- | --- |
| Source, artifact, SDK, compiler or dependency lock | Build, execution and report |
| Runtime, asset binding, raw input identity, seed or random policy | Execution and report |
| Quality policy only | Report only |
| No change | None |

These are planned invalidations, not deletion commands. Original accepted manifests, source, notes and available recorded output are not eviction targets. Even a compatible persisted build needs a fresh compiler receipt; a compatible cached report remains history. Scientific checks and engineering quality checks retain their distinct existing authority rules.

Before changing an installation, retain original exports and the prior compatible application. If a format or cache version is unavailable, keep the original read-only and reopen it in a compatible version or explicitly recompute derived output when permitted. Do not reset a newer/unknown IndexedDB database, overwrite accepted originals or relabel a saved report as current verification. A prior app may not understand newly created formats; retaining its earlier export is the rollback path. This stage performs **no user-data migration or automatic rollback writes**.

## Evidence and remaining gates

The owner-reported full check passed **750 tests, TypeScript and the production build**. Focused adoption tests cover disabled direct APIs, revocation of queued/active work, private receipt reuse, immutable payload capture during delayed policy metadata, Stop during preparation, accepted-job recovery and staged compatibility. These checks do not establish scientific fidelity or reader effectiveness.

[Native UI evidence](../data/adoption-browser-ui.json) records an actual disabled-policy server: source/download/replay remain usable, generated controls are disabled with zero generated workers, and a trusted graph still computes and advances. At 320px with a 32px root font the page/dialog remain contained and measured buttons are at least44px. A separate, explicitly controlled policy transport on the enabled server demonstrates focus-observed revocation, worker termination, retained prior frame, failure-closed malformed/unavailable responses, and no automatic restart when policy recovers. It is not an actual deployment environment flip. The empty localStorage baseline does not establish a populated-notes regression test. Both native journeys record zero model-creation attempts.

[PP114's protocol](scientific-reader-study-protocol.md) and [observations ledger](scientific-reader-study-observations.json) still record **zero participants and zero sessions**, with human measurements unknown. Expert correctness and reader usability remain pending under [#69](https://github.com/ManuelR-T/paperplay/issues/69) and [#24](https://github.com/ManuelR-T/paperplay/issues/24). Scientifically misleading claims remain subject to the source-backed hold/fix/retest policy; implementation flags do not waive that gate. Release/hosting/access issues [#31](https://github.com/ManuelR-T/paperplay/issues/31), [#33](https://github.com/ManuelR-T/paperplay/issues/33) and [#34](https://github.com/ManuelR-T/paperplay/issues/34) remain separate and deferred. PP116 performs no deployment, public-access change, recruitment or new paid inference.
