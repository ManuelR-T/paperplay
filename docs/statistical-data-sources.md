# PP-090 empirical statistical data sources

Checked 28 October 2026. Recommend the two extracts below: author-deposited Arabidopsis measurements with supplied standard errors, and NOAA atmospheric carbon dioxide measurements with source-defined uncertainty fields. Neither uses a held-out PP-086 paper (B3/P3/P4/C4), personal data or new dependencies. This is source preparation; no chart, dataset or application code is added. Downloads and inspection stayed in `/tmp`.

## Biological example: Arabidopsis leaf biomass

Source: Yin Hoon Chew, **Biomass and area of Col-0 and 35S:miR156 Arabidopsis rosette and leaves**, FAIRDOMHub, version 1, deposited 22 August 2018 by Andrew Millar. The author-group record links the experiment to Chew et al., PNAS 2014, DOI `10.1073/pnas.1410238111`; it identifies April 2014 measurements and separate model outputs. [Versioned record](https://fairdomhub.org/data_files/2212?version=1), [versioned XLSX download](https://fairdomhub.org/data_files/2212/download?version=1).

Rights: the **data file** explicitly carries **CC0-1.0**; the site's metadata separately carries CC BY 4.0. Cite creator, title, version and record URL when extracting. This conclusion comes from the file's license field, not merely its public accessibility. [Author-deposited rights/provenance record](https://fairdomhub.org/data_files/2212?version=1).

Pin: `Biomass MIR156.xlsx`, 127,343 downloaded bytes; SHA-256 `98833cf34fda5b598ed0dbb390386abf1797e26b5e9393f5df8a1266c2ff5e68`. The record's version is immutable-looking but the digest, not that assumption, identifies the inspected bytes. Temporary inspection copy: `/tmp/paperplay-pp090-biomass.xlsx`.

Minimal extract: workbook **Summary!A5:E14**, ten leaf ranks L1–L10, containing two genotype means and their supplied SEs (20 plotted means). Preserve workbook coordinates in the provenance. Do not silently extract similarly shaped simulation sheets.

| Column/context | Meaning and unit |
| --- | --- |
| `Summary!A5:A14` | Leaf rank L1–L10; ordered plant-organ index, dimensionless, not time. |
| `Summary!B5:B14` | Col-0 mean fresh biomass, **g**. |
| `Summary!C5:C14` | Source-provided SE of the Col-0 mean, **g**. |
| `Summary!D5:D14` | 35S:miR156 mean fresh biomass, **g**. |
| `Summary!E5:E14` | Source-provided SE of the miR156 mean, **g**. |
| `Summary!A3:B3` | Day 37; underlying sheets identify this as DAS, and the author assay explicitly defines the age as 37 days after sowing. All selected ranks are measured at that age. |

Evidence from the downloaded XLSX: chart XML `xl/charts/chart1.xml` explicitly labels fresh biomass in grams; `Summary` row 4 labels the uncertainty columns `SE`. Each selected mean formula references five leaf measurements, and each SE formula is `STDEV(references)/COUNT(references)^0.5`. The [author assay record](https://fairdomhub.org/assays/711) independently confirms five plants, publication error bars showing their SEs, and harvest at 37 days after sowing. Thus this is **observed experimental summary data**, not 20 independent plants or 20 raw instrument readings. Ranks within one plant are correlated; do not infer independent rank samples or causal effects from this extract.

Raw checks are available inside the same workbook. For Col-0 L1, `Col!E8,E48,E88,E129,E170` derive fresh mass from foil-plus-plant minus empty-foil measurements. Their mean is `0.00042000000000000923 g`; `Summary!C5` is `0.00012409673645989936 g` SE. For miR156 L1, `Summary!D5 = 0.0012000000000000123 g` and `E5 = 0.00013038404810405353 g` SE. Independent standard-library recomputation of the 20 selected means and 20 SEs agreed with cached workbook values to maximum absolute difference `5.21e-18 g`. These are extraction/formula checks, not experimental validation.

Recommended chart: two explicitly observed mean series versus rank, optionally with **±1 supplied SE** bars, accompanied by “five source measurements per mean.” SE is neither SD nor a 95% confidence interval. No confidence level or significance test is supplied for those bars. For a model comparison, the workbook has separately named simulation outputs (`Indiv`, and `Leaf size distribution` columns under `Simulation`); their provenance must remain **model/simulation**, and the latter must use its matching leaf-area observations and mm² units. Do not mix area with biomass or call these model outputs fitted observations. A locally fitted trend would be a separately computed, explicitly named analysis, with its method and selected rows recorded.

## Physical example: Mauna Loa monthly CO₂

Source: NOAA Global Monitoring Laboratory, **Trends in Atmospheric Carbon Dioxide**, Mauna Loa monthly mean product. [Official data landing page](https://gml.noaa.gov/ccgg/trends/data.html), [CSV download](https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv), [companion TXT with column descriptions](https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt), [measurement/product explanation](https://gml.noaa.gov/ccgg/trends/mlo.html).

Rights: NOAA GML explicitly permits public-domain information on its servers to be used freely unless specifically marked otherwise; retain acknowledgment, avoid implying endorsement and label modified/derived material. No contrary annotation was found in this downloaded product. The recommended 2020 slice is in NOAA's own measurement era, avoiding the older Scripps-origin portion. Acknowledge NOAA GML and cite the exact product and download date; do not copy the website's plot. [Official reuse terms](https://gml.noaa.gov/about/disclaimer.html).

Pin: CSV file creation comment **9 October 2026, 13:08:07** (timezone unspecified), downloaded 28 October 2026; 38,776 bytes; SHA-256 `d895fb5b4a59fb5e4cd98e69b7667fe5bef595c6581f630852b12cb41c07f675`. Temporary copy: `/tmp/paperplay-pp090-co2.csv`. This URL is updated, so archive/version the chosen extract with this source digest before release; a later download may differ.

Minimal extract: all **12 rows where `year = 2020`**, preserving source order and original decimal strings. This avoids preliminary recent data and the 2022–2023 temporary observatory relocation. No selected row has a negative missing/interpolation sentinel.

| CSV column | Meaning and unit |
| --- | --- |
| `year`, `month` | Calendar key; month 1–12. |
| `decimal date` | Source temporal coordinate in fractional calendar years; retain as supplied rather than treating it as seconds. |
| `average` | Observed monthly mean dry-air CO₂ mole fraction, **ppm** (µmol/mol); monthly means are constructed from daily background-air means and centered in the month. |
| `deseasonalized` | NOAA's processed monthly value after removing its estimated seasonal cycle, **ppm**; derived from observations, not another independent measurement. |
| `ndays` | Number of contributing days, count. |
| `sdev` | Companion TXT explicitly labels this “st.dev of days,” **ppm**; it describes day-to-day variation, not SE or a confidence interval. |
| `unc` | Source uncertainty of the monthly mean, **ppm**; preserve this interpretation without asserting a confidence level. |

Independent row checks from the downloaded CSV: January 2020 has `average=413.59`, `deseasonalized=413.22`, `ndays=29`, `sdev=0.73`, `unc=0.26`; December has `average=414.23`, `deseasonalized=414.91`, `ndays=30`, `sdev=0.48`, `unc=0.17`. All concentrations and their uncertainty columns are in ppm. The TXT header distinguishes SD of daily values from uncertainty of the monthly mean; negative values denote missing/interpolated or unavailable metadata and must never become negative error bars.

Recommended chart: observed monthly mean points and a distinctly labeled **NOAA deseasonalized, derived** series. Optionally show the source `unc` as “± NOAA supplied monthly-mean uncertainty”; its confidence/coverage level is unspecified here, so do not label it SD, SE or 95% CI. NOAA explains that monthly uncertainty considers correlated day-to-day variability; do not substitute `sdev / sqrt(ndays)`. The measurements represent background air at this observatory, not a global mean or an independent sample of 12 atmospheres. [Official interpretation](https://gml.noaa.gov/ccgg/trends/mlo.html).

If a fitted-series example is required, compute a separate descriptive unweighted least-squares line through the 12 **deseasonalized** points, with `x = decimal date - 2020`. As an independently recomputed check, `fitted_ppm ≈ 413.1454736904323 + 2.1357192858021357*x`. Label it **Paperplay descriptive fit to NOAA processed values**, with no prediction or confidence band. This short-window fit does not establish a climate trend, account for serial dependence, reproduce NOAA's processing or estimate physical causal parameters. It must not replace or be labeled observed data.

## Admission recommendation

Both sources have verified downloadable numeric bytes, explicit reuse terms and independent numeric checks. Admit the ten-row/two-genotype plant summary and twelve-row NOAA slice with source coordinates, units, rights and digests. Keep observed measurements, supplied summaries, source processing, model outputs, local fits and any future illustrative values distinguishable in legends and saved provenance. Do not add uncertainty to individual plant measurements, fitted curves or simulated values unless an explicit method and interpretation are supplied.

NIST Pontius was considered but not selected: its official pages identify observed load-cell calibration data yet do not specify physical load/deflection units. The recommended pair avoids having to invent those units. [NIST dataset description](https://www.itl.nist.gov/div898/strd/lls/data/LINKS/i-Pontius.shtml).
