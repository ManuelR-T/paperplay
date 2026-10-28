# Empirical datasets and reported outcomes (PP-105)

`dataset-exploration@1.0.0` adds a `dataset-study` view over existing checked table assets, or a reported-only view with no data asset. It separates supplied values, source-reported results, local descriptive calculations and illustrative inputs. It is not a simulation engine, an automatic statistical test selector or independent scientific verification.

## Source admission and useful examples

[Dataset source admission](dataset-data-sources.md) records the exact rights and scientific scope. The plant example reuses the PP090 CC0 Chew workbook extract, with a checked wide-to-long reshape pinned to its input-table checksum and original file digest. Twenty rows hold leaf-rank/genotype means and supplied SE from five plants per source mean. They are not twenty independent plants, and no raw plant identities, pooled n or SEM are reconstructed.

The NOAA example reuses the pinned 2020 monthly observations. Source monthly uncertainty retains the `source-uncertainty` kind and unspecified coverage. Contributing days are not independent replicates, and a short-window unweighted descriptive line is not a climate-trend, causal or forecasting claim. Neither example replaces the admitted source bytes with a current download.

The B1 development-corpus example describes Hodgkin–Huxley Figure 11, printed p. 521: source-observed voltage-clamp currents and source-calculated comparisons are separate reported outcomes. The caption identifies axon 31 at 4 °C. A short exact caption excerpt, source link, authored explanation and explicitly partial protocol remain useful without local raw trace data. There are no invented trace points, n, error bars, digitization or recreated figure pixels. The prepared card's logical page 1 is explicitly distinguished from the article's printed page. Missing local raw data does not assert that recordings never existed.

## Typed analysis and numerical scope

Requests bind the source ID/version and optional pinned content fingerprint, table ID/checksum, variables, grouping/filter selections, transformations, method, replication declaration and supplied uncertainty. Unknown units can be inspected unchanged. Conversion uses only compatible registered units and explicit temperature semantics already present in table metadata: absolute Celsius points convert affinely, while SD/SE and other spreads use difference semantics without offsets. Changing a response in the UI removes its previous uncertainty mapping rather than apply old error bars to another variable.

The initial methods are descriptive summaries and unweighted intercept-plus-slope least squares. Each variable's summary uses its own nonmissing finite values: n, min/max, mean and sample SD with denominator n−1. Empty/singleton samples keep unavailable statistics null. OLS separately requires joint complete x/y pairs and varying x; it returns original responses, centered predictions, residuals, SSE, fitted domain, units and residual degrees of freedom. Two points can define a line but cannot estimate residual variance. Failed/degenerate fits preserve supplied observations and diagnostics.

Means and fits use centered/scaled arithmetic and compensated sums rather than unchecked raw moment subtraction. Finite arithmetic failures are explicit. SSE avoids prematurely squaring a tiny residual scale; genuinely unrepresentable positive SSE or residual variance does not become a false perfect-fit/zero-variance claim. Displayed summaries and coefficients are rounded to six significant digits with a visible note. Original/converted observations, exact predictions, residuals and analysis downloads retain their numeric values.

Source SD, SE, unspecified uncertainty and intervals retain their declared meanings. Intervals stay asymmetric; no coverage, computed SEM/CI, p value, predictor-error model, imputation, weights, nonlinear fit or automatic model selection is inferred. A descriptive fit does not establish independence, normality, causality or experimental reproduction. Further methods need their own reviewed contracts and references; [the research note](dataset-adapter-research.md) records the deliberate exclusions.

## Replication, missingness and provenance

Selected rows, usable rows, distinct declared unit IDs among usable rows, missing/duplicate usable-unit IDs, source n per row and independent n are different fields. Source n is never summed across rows. Independent n is available only for an explicit independent-unit declaration with complete, nonduplicated unit IDs; that declaration is not a verified experimental design. Summary-only and repeated-measure inputs preserve unavailable independent n. SD across source means is labeled as variation between supplied row means, not raw individual variation.

Every selected observation retains a stable row ID, original values, converted values and supplied uncertainty. Missing values stay null. Per-variable missingness, joint exclusions/reasons and filter exclusions remain inspectable. Empty selection arrays mean all rows/groups; a real missing group remains distinct from the absence of grouping. Filters never create observations or fill omitted values.

Analysis requires a checked immutable asset and its exact checksum. Source-cited assets are revalidated against the actual document. The canonical source fingerprint hashes the validated document with its derived anchors removed; blocks, metadata and version remain bound. Same-ID/version source-content changes cannot reuse an older result. The registry checks this fingerprint against its actual source context.

Locally computed results receive a private nonpersistable computation receipt. Structural JSON validation or a copied/serialized result cannot restore that receipt or mint scientific evidence. `verifyDatasetStudyResult` recomputes over admitted inputs before returning a fresh receipt. A receipt records local analysis, not authenticity of measurements or independent validation of reported statements. Reported-only cards remain explicit source declarations.

## Bounds and reader behavior

The adapter reuses table limits of 1,000 rows/32 columns, with at most eight selected groups, two variable conversions, a 256 KiB request and 2 MiB result. No expression language, external fetch, arbitrary join or new dataset store is added. Bounded arithmetic executes locally; asynchronous source/integrity work observes cancellation, and UI request/source/checksum identities prevent obsolete completions from replacing newer settings. No worker is required for this finite arithmetic subset.

Variable, method, group and conversion controls update the local analysis. Source values, supplied uncertainty, computed summaries/fit and residuals have separate labels. Source returns focus the exact attribution/result passage; reported-only mode provides protocol/source buttons without numeric controls or an empty fabricated plot. Stable row selection is checked against the actual table and active filters; edits clear incompatible selection. Failed settings preserve the prior valid result, labeled read-only. A portable data study saves exact inputs/source/assets and navigation and reopens through **Files & source → Open figure or study**, then recomputes locally.

## Verification

TypeScript, the complete 578-test suite and production build pass; 23 tests specifically cover dataset arithmetic/reference/integration behavior. Subsequent presentation changes pass TypeScript/build and native checks. Independent authored rational fixtures cover noisy OLS coefficients/SSE, singleton/n=2/constant-x behavior, missing pairs, repeated/missing units, explicit unit/temperature/spread conversion, large offsets and underflow/overflow recovery. Additional tests cover original source admission/reshape, reported-only data absence, forged copied results, changed source content, exact portable inputs, and actual filtered row selections. NIST data considered during research were not bundled without a separate rights admission.

[Native-browser evidence](../data/dataset-browser.json) records actual plant filtering/conversion/fit/residuals, NOAA uncertainty, the B1 reported result/protocol, portable selected-row replay, synthetic missingness, source focus, and 320 px enlarged-text containment after fixing an implicit grid track. No paid inference, frozen held-out source, human study or release work is part of this issue.
