# Typed scientific data and local import (PP-083)

Scientific assets use `paperplay-scientific-asset`, version 1. The strict contract describes identity, type, shape, coordinate axes/conventions, missing values, data origin, attribution, rights, transformations, optional original-source references and a SHA-256 manifest/data checksum. The source-file digest is additionally recorded by CSV/JSON import. Checksums establish identity/integrity, not scientific truth or redistribution permission.

## Supported contracts

- Tables: at most 1,000 rows and 32 typed columns, stable row/column IDs, finite numbers/text/null, exact rectangular shape.
- Tensors: flattened finite values, optional missing values, explicit rank/shape, at most 32,768 entries.
- Sequences: declared alphabet and length; DNA/RNA symbols are checked against that declared alphabet.
- Graphs: stable node identities, directedness, optional weights and checked edge endpoints.
- Geometry: finite 3D vertices, triangular face references and a declared coordinate convention.
- Original-image references: exact extracted figure/source identity and retained image URL when available. Unknown dimensions stay unknown. The checksum covers the manifest/reference, not pixels that have not been fetched.

These contracts do not claim specialized microscopy, molecular or field visualization. The current asset adapter renders a semantic table or a bounded metadata/data inspector. Later domain/view issues provide richer adapters.

## Import and confirmation

In **Files & source**, choose a local CSV or JSON file. The input is bounded to 2 MiB before parsing. CSV handles quoted commas, doubled quotes and quoted newlines, rejects duplicate headers and inconsistent widths, and preserves leading-zero identifiers as text. Empty CSV cells and missing JSON keys become null. JSON tables use arrays of row objects; nested cells and unlisted columns are rejected. A complete checksummed scientific-asset manifest may also be imported. Sources with extracted original figures also offer an explicit original-reference inspector; no image bytes are fetched or invented by that inspector.

Numeric inference is column-wide. Mixed columns stay text and an all-missing column remains text rather than inventing numeric measurements. Units remain explicitly unspecified. File contents, file names and formula-looking cells are never executed.

The preview displays origin, shape, missing-value policy, first twenty table rows, transformations and integrity. **Use these data** explicitly binds the checked object to a selected passage in a representation preview. Reader-supplied values remain labeled reader-supplied; they are not automatically labeled observations from the source paper. Bad imports leave original papers, notes and existing figures unchanged. There is no upload or paid inference in this flow.

## Binding and portability

`validateScientificAsset` checks structure, exact source references where applicable and the manifest checksum, then returns an immutable object whose integrity check is recognized only in this application instance. A parsed/copied JSON object cannot skip that check. Source assets from another document/version cannot be silently rebound.

The representation builder accepts checked objects separately from a portable plan. Declaring embedded manifests does not activate them: the preview offers **Check embedded data**, shows the checked preview, then asks to use it. Missing assets retain a named gap and can be supplied explicitly under the required asset ID. The asset adapter consumes those exact objects. Existing widget engines still consume their inline specifications; attaching an external dataset cannot silently change or certify their inputs.

An exported representation retains declarations, expected data checksums and embedded data within the existing 256 KiB representation limit. Import requires integrity checking and explicit binding again. Larger datasets bind locally but remain separate from the portable plan, with a visible instruction to retain the original files. Supplying a different dataset under the same ID fails its expected-checksum check. An oversized representation itself is refused rather than exporting an unreadable file. Private data is not added to public links or uploaded automatically.

## Verification

Provider-free tests exercise quote-aware CSV parsing, malformed/oversized input, missing values, leading-zero IDs, mixed data, checksums/immutability, tensor/sequence/graph/geometry structure, exact original-image references, explicit checked bindings and scientific-identity invalidation. These are structural/integrity checks, not a claim that data has been scientifically validated.

Verification on 28 October 2026: TypeScript, 234 tests and production build passed. Native Chromium at 320 px verified preview before confirmation, leading-zero IDs/nulls, export and checked reimport, malformed CSV recovery, a 1,000-row external binding, rejection of the wrong dataset, and restoration with matching data. Long cells scroll inside the table; the dialog and document remain 286/320 px wide. The inference request count remained zero.
