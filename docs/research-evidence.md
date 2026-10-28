# Scientific provenance and evidence policy (PP-082)

`shared/research-evidence.ts` defines portable evidence declarations for individual claims, assets and views. A declaration identifies its origin, source anchors, assumptions, external/reference descriptions and upstream evidence dependencies. Valid origins distinguish source quotations, authored assumptions, extracted source data, observations, computed output and independent references. None of those declarations independently establishes truth or verification.

The plan validator checks subject/anchor identities, unique IDs, required references, missing dependencies and dependency cycles. A claimed source quotation must already satisfy exact-source checks. Unknown promotion fields such as `verified: true` are rejected. Observed and illustrative data can coexist with separate declarations.

## Application-owned checks

`runScientificCheck` is a trusted application-code seam, not an endpoint or a model-callable tool. An application-owned checker supplies an independent reference, exact scope, subject, verification level and executable check. Failure/exception never promotes a label. A receipt returned by the checker is immutable and recognized only by this application runtime through a private WeakSet; serializing or copying it loses that trust. No new scientific reference engine is certified merely by adding this policy. PP-108 supplies actual domain check/report implementations.

`assessScientificEvidence` recomputes scientific identity before interpreting receipts. It never accepts a caller-provided digest as a substitute for hashing the actual plan. Promotion is scoped to the checked subject; an experiment-level check cannot silently certify other figures or claims. Even a passed check says only that the recorded scope was checked.

The binding uses SHA-256 over canonical, locale-independent JSON: exact plan/source identity, claims, assumptions, input specs, seed, declared dependencies and explicit dataset/artifact/engine identities. Only widget view-navigation state and historical reported checks are excluded. This is conservative whole-representation invalidation: any scientific-input change invalidates existing receipts. Fine-grained cache reuse is a later optimization, not a reason to reuse stale evidence.

## Portable reports and UI

A plan can preserve `reportedChecks` as historical reports. Reopening one never recreates a trusted receipt; history is shown as **not reverified**. Input changes retain the report history while invalidating its scientific identity. Exporting a representation includes its declared evidence and historical reports, with no provider job/secret or original PDF added.

The generic preview lists source quotes, added explanations, data and views separately with their verification labels. References and assumptions are inspectable. No ordinary imported/Meta-authored plan can become scientifically verified simply by declaring an independent-reference origin or requesting experiment reproduction.

Provider-free policy tests cover forged/copied reports, failed independent checks, changed input/seed/data/artifact/engine, navigation stability, mixed data origins, evidence dependency cycles and report export/import. These tests verify trust/invalidation policy; their checker fixtures are not independent validation of a scientific paper.

Verification on 28 October 2026: strict TypeScript, 223 tests and production build passed. Native Chromium at 320 px displayed separate observed/illustrative data origins and retained a copied passed report as unverified history; no verification label was promoted and no document overflow occurred. No paid inference was used.
