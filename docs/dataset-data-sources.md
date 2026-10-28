# PP-105 dataset example admission

Checked 28 October 2026. These examples reuse PP090 admitted data and the B1 development-corpus article. No held-out paper, new dataset download, figure pixels, third-party statistical implementation or paid inference is included. Source preparation and arithmetic reference tests are not experimental replication or expert review.

## Arabidopsis: a reshape of supplied summaries

Yin Hoon Chew, **Biomass and area of Col-0 and 35S:miR156 Arabidopsis rosette and leaves**, author deposit [FAIRDOMHub file 2212, version 1](https://fairdomhub.org/data_files/2212?version=1). The official record explicitly declares CC0-1.0 for the data file; site metadata is separately CC BY 4.0. The [author assay 711](https://fairdomhub.org/assays/711), description, specifies five plants, harvest at 37 days after sowing and SE error bars. Associated article DOI: `10.1073/pnas.1410238111`.

The factory derives its table from `createStatisticalExample('biology')`, not another manually retyped numeric extract. Keep the original attribution, source owner/version and workbook digest `98833cf34fda5b598ed0dbb390386abf1797e26b5e9393f5df8a1266c2ff5e68`. Pin the exact checked input table checksum in the reshape transformation. Wide columns `col/colSE` and `mir/mirSE` become twenty rows with rank, genotype, value in g, source SE in g and source n=5. Preserve original leaf IDs within deterministic genotype-prefixed row IDs; do not generate new plant identities.

The checked wide input manifest-and-data checksum is `09257ec1cb0fc589a86d81851023082ce1250d70f2e71297e0d6b3f3960407a8`; the sealed long-table checksum is `3aa0d920673794465b474be839955113430ee3174c9f1d0b998cc060345a7587`. These identify the local representations, separately from the original XLSX digest. The factory records the actual input checksum; provenance changes must produce a new representation checksum rather than preserving an obsolete identity.

Each row is a source mean, not a raw plant measurement. Twenty means are not twenty independent plants; ranks measured on the same plants are dependent. Summaries across ranks describe rank means and must not pool source n or manufacture SEM/CI. The source workbook contains additional raw references, but those are not automatically admitted as local raw data by this reshape. Full extraction details and the original independent workbook checks remain in [PP090 admission](statistical-data-sources.md).

## NOAA: existing monthly observations

Reuse the checked `measurements` asset from `createStatisticalExample('physics')`, including its 2020 twelve-month slice, original file digest and provenance. [NOAA product explanation](https://gml.noaa.gov/ccgg/trends/mlo.html) distinguishes monthly observations, seasonal adjustment and monthly uncertainty accounting for dependent daily means. Its contributing-day count is not independent replication. Source-supplied uncertainty is not silently converted to SD, SEM or 95% CI. Rights, exact edition/digest and row checks are already admitted in [PP090](statistical-data-sources.md); no current download replaces the pinned original.

## B1: reported experimental result without invented trace data

A. L. Hodgkin and A. F. Huxley (1952), **A quantitative description of membrane current and its application to conduction and excitation in nerve**, DOI `10.1113/jphysiol.1952.sp004764`. [Primary article archive and metadata](https://pmc.ncbi.nlm.nih.gov/articles/PMC1392413/). **Figure 11, printed p. 521**, [original archived page](https://cdn.ncbi.nlm.nih.gov/pmc/blobs/5164/1392413/f4ed0e5e38c2/jphysiol01442-0127.png), was visually reinspected for this admission.

The single source quotation retained in the example is the following 18-word caption excerpt:

> Right-hand column: observed time course of membrane currents during voltage clamp. Axon 31 at 4° C; compensated feedback.

The result explanation is an authored paraphrase: the left column is calculated current using equation (26) and subsidiaries, while the right column reports voltage-clamp observations; current and time scales change within the figure. These are different origins, not two sets of raw observations.

The prepared source has one logical card page. Its anchor uses logical `page:1`, explicitly labeled **Figure 11, printed p. 521**; it must not pretend the card's page number is an original article page. No general figure redistribution permission was established. The example includes a short quotation, metadata, original-source links and authored explanation, with no copied figure image or full article.

The local availability reason is precise: no checked raw trace table is included in this study, so fitting, point selection, replicate counts and numeric uncertainty are unavailable. This does not assert that raw recordings never existed. The protocol reference is explicitly partial: conditions are identified, while a standalone preparation, acquisition/calibration details, repeat schedule and acceptance criteria are not reconstructed. See [PP092 source admission](argument-protocol-sources.md), printed pp. 518–521. No complete experiment reproduction is claimed.

## Independent arithmetic references

Dataset reference tests use only project-authored small rational values: exact straight-line coefficients/residuals, sample mean/SD and explicit missing/replication cases. Synthetic inputs retain illustrative provenance. NIST Norris bytes considered in the research note are not bundled or used by tests because their redistribution rights were not admitted. Test success checks the bounded arithmetic and provenance boundaries; it does not validate the original experiments.
