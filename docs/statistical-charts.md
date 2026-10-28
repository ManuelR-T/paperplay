# Statistical charts and comparisons (PP-090)

`statistical-chart@1.0.0` binds checked table assets to line, scatter, bar and distribution views. The reader selects capabilities and source/data references, not scientific disciplines. **Try examples → Biological measurements / Physical measurements** opens two real attributed datasets with their own exact source attribution cards, rather than attaching unrelated measurements to the current paper.

The versioned chart contract names axes, units, scales, optional explicit domains, series origin, source anchors, data columns, optional filters/replicate/count columns, uncertainty and descriptive matched comparisons. The lifecycle checks assets and chart requirements before activation. A missing column, mismatched unit, invalid logarithmic domain or ambiguous comparison preserves the original source and last valid plot. Axis units must exactly match declared column units; no conversion or physical interpretation is inferred. Perform an explicit recorded data conversion before plotting different units together.

## Scientific distinctions

- **Observed** source summaries, **processed** source values, **fitted** local curves and **illustrative** references keep distinct labels. An illustrative asset cannot be promoted to observed measurements by a chart declaration.
- SD, SE, source-defined uncertainty, confidence intervals, credible intervals and ranges keep separate meanings. Coverage is supplied explicitly where appropriate; no automatic 95% label, significance or causal conclusion is generated. Missing endpoints stay missing; negative uncertainty is rejected.
- Missing observations are never zero-filled. Line segments stop at missing values. Explicit ordering is retained; sorting is a declared choice. Group filters and replicate identities remain inspectable.
- Every comparison uses the same domains across series. Domains include uncertainty endpoints and cannot silently clip values. Bars/counts require a linear y axis containing zero. Log scales require positive data and endpoints.
- Distributions use shared, equal-width bins in the original x units, with actual member rows/values and missing-row counts. Bin centers and counts are labeled **computed**, separate from observed inputs. Bins are not independent experimental replicates, and no bin uncertainty is invented.
- The optional descriptive unweighted OLS fit records its method, n, slope and intercept. It does not inherit observational uncertainty or produce a confidence/prediction band. Matched-key differences are arithmetic; duplicated keys require an explicit prior aggregation, not an inferred join or test.

A chart is bounded to eight series, 2,000 total input rows and 3–30 bins. Table/plot scrolling stays local, numerical controls work by keyboard, selections expose source rows and sample-count meaning, and exact source return retains focus. Display values round to twelve significant digits; source extracts preserve original decimal strings, and assets/exports retain their numeric precision. Rendering is provider-free; this bounded local data transform is not an original experiment replay or arbitrary generated execution.

## Admitted empirical examples

The [primary-source and rights brief](statistical-data-sources.md) records exact download digests, editions and numeric checks:

- **Arabidopsis:** ten leaf ranks × two genotype mean series, day 37 after sowing. The author-deposited CC0 workbook supplies fresh biomass in g and SE across five plants. Ranks within plants are correlated. The rank-matched mean-difference view is not a plant-paired significance test.
- **Mauna Loa 2020:** twelve NOAA monthly means in ppm, supplied monthly-mean uncertainty, source deseasonalized values, a separate Paperplay descriptive fit and an arbitrary clearly illustrative 410 ppm line. Daily SD is not substituted for source uncertainty, and this short window is not a climate-trend estimate.

[scripts/extract-statistical-examples.py](../scripts/extract-statistical-examples.py) rebuilds the small extracts from admitted local originals using Python's standard library. It verifies their pinned SHA-256 digests before extraction and performs no downloads. CI reads the checked-in bounded numeric extract; it does not require Python, network access or paid inference. No held-out corpus case is used for development.

## Portable studies

A `paperplay-data-study` version-1 file contains an exact source document, one statistical representation, checked embedded assets and optional linked selections. **Download data study / Open data study** round-trip locally, with a 512 KiB limit, strict versions, checksums, source grounding and navigation freshness. A distribution-only import retains only its supported view choices; the app does not invent missing y columns to create another plot. Generic representation imports in **Files & source** also support statistical views when the same original source is present.

## Verification

`npm run check`: TypeScript, 277 tests and production build. Deterministic references cover real source values and SE/sample counts, independent NOAA fit coefficients, null gaps, log/domain errors, uncertainty meanings, common histogram edges/member counts, paired keys, provenance restrictions, asset integrity and study/selection restoration. Native Chromium verified both real datasets, linked values/source focus, log-scale controls, recoverable invalid bars, computed bin membership, keyboard selection, study export/reopen, and generic representation import with explicit embedded-data binding. At 320 CSS pixels with 200% text and expanded spacing, plots/tables scrolled locally, the dialog retained its width and visible close action, and the observed model-request count stayed zero. No human participants, expert approvals, original experiment reproductions or paid model runs are claimed.
