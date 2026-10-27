# Conservative PDF layout reconstruction — PP-043

`source-v2` adds measured two-column geometry repair and explicit original-caption references to the existing PDF.js extraction path. It retains the original PDF, physical pages, cancellation and import limits. There is no OCR, invented LaTeX or reconstructed figure image.

## Layout decision

PDF text fragments are grouped by vertical alignment and split at a sufficiently wide horizontal gap. Strong two-column candidates need overlapping left/right prose, at least four substantial prose lines on each side, and a dominant two-column proportion among prose lines. Full-width headings/regions divide the page into bands. Within a confident band, the left column precedes the right column; full-width separators retain their physical position.

The prose threshold prevents equation grids, author lists and short plot labels from being treated as ordinary two-column narrative. Ambiguous or single-column pages preserve the previous extraction text instead of forcing a speculative repair. All possible-column/repair cases retain an explicit uncertainty note. Geometry is a heuristic, not a proof of semantic reading order.

Only paragraphs beginning with an explicit `Figure N` or `Fig. N` prefix become `original-figure` reference blocks. Their original caption text and physical page are retained, with an explicit statement that the image was not reconstructed. This count does not establish perfect caption segmentation. Tables and mathematics remain extracted source text unless a structured arXiv representation supplies more reliable markup.

## Fixed before/after checks

The synthetic regression fixture contains a full-width heading, twelve interleaved left/right prose rows and a full-width original caption. Among the 24 ordered column markers, the previous stream-based text has **66 ordering inversions**; the repaired output has **zero**. All non-whitespace source characters are retained. This fixture tests a known reading order; its contents are original parser-test prose rather than a fabricated scientific result.

The [actual PDF metrics](pdf-layout-results.json) were collected from pinned original files with `npx tsx scripts/check-pdf-layout.ts <paths...>`:

| Fixed source | Pages | Confident repaired pages | Pages retaining every non-whitespace character | Unchanged extraction-text pages | Caption references before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Deep Residual Learning for Image Recognition, arXiv:1512.03385v1](https://arxiv.org/abs/1512.03385v1) | 12 | 12 | 12 | 0 | 0 → 10 |
| [Attention Is All You Need, arXiv:1706.03762v7](https://arxiv.org/abs/1706.03762v7) | 15 | 0 | 15 | 15 | 0 → 5 |
| Bundled priority-search-tree publisher PDF | 18 | 0 | 18 | 18 | 0 → 3 |

The ResNet PDF exercises actual narrow gutters and two-column scientific prose. Attention and the publisher paper are controls with mixed mathematics, diagrams and largely full-width narrative; their extraction text remains unchanged. The report records SHA-256 hashes and per-page counts, not full paper text. The two arXiv PDFs were read from temporary local files and were not redistributed into the repository. These parse-only observations do not reuse held-out papers to tune model planning and make no new inference calls.

Exact character retention verifies that this repair did not drop source characters; it does not measure equation correctness, spacing, hyphenation, figure completeness or semantic reading order. Caption counts are detected references, not a precision/recall score or a promise to recover all captions. Dense tables, mixed embedded text, rotated labels, equations and unusual layouts remain limited. The original page remains the authority.

## Identity and regression behavior

`NORMALIZER_VERSION` changed from `source-v1` to `source-v2`. Content hashes include the normalization version, so newly imported documents cannot silently reuse an older source identity/analysis after a layout change. Previously saved sources remain readable in their original version; they are not silently rewritten in IndexedDB. Reimporting through the new parser creates a new compatible identity.

`npx tsx --test tests/pdf-layout.test.ts tests/import.test.ts` covers the fixed ordering example, single-column/ambiguous preservation, exact source characters, caption/page anchors, explicit version change, actual 18-page publisher parsing, cancellation and existing source/network bounds. Encrypted/scanned status checks remain boundary simulations, as disclosed in the M2 pipeline guide. No universal reconstruction success is claimed.
