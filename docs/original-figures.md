# Original source figures in the reader

Original illustrations are displayed separately from Paperplay teaching widgets, at their existing source block and with the original caption. They are not generated substitutes.

## PDF sources

`OriginalSourceFigure` loads the original-page renderer when the figure approaches the viewport. Offscreen PDF previews are released with a measured-height placeholder while captions stay in the document. After rendering, the PDF worker/document is released while the original canvas pixels remain visible. The renderer uses the pinned PDF.js resources and original local bytes or a same-origin prepared PDF. It renders the source canvas directly; there is no model request, OCR or upload of the local PDF.

Four regions of the unchanged bundled publisher PDFs were inspected and recorded in `lib/reading/original-figures.ts`: the priority-search-tree paper's Figure 3 and the sorting paper's Figures 1/2 and Algorithm 2. Crops are bound to exact prepared source versions and physical pages. “Show whole page” retains access to all surrounding context. Larger-page controls allow local zoom/keyboard scrolling. Existing canvas pixel and file-size budgets still apply.

For imported PDFs, a detected caption shows the complete original page inline. No guessed figure crop is labeled exact. This preserves raster and vector illustrations as original pixels, at the cost of also showing surrounding page content. Arbitrary figure segmentation, scanned/image-only document import and original figures with no detected caption remain outside this change. Source documents and old snapshots are not rewritten.

## Structured arXiv sources

New imports retain up to eight original image asset URLs per detected figure, resolved relative to the exact versioned article path. Only HTTPS assets under the same article path/origin are retained; scripts, unrelated trackers and other-paper paths are excluded. Images are rendered as ordinary image resources with lazy loading, plain-text alternative text and no referrer. SVG images are loaded in image context, never inserted as executable document markup.

Saved older HTML records without asset locations remain unchanged. Their figure caption and article link stay available; reimporting captures supported image locations into a new source version. Arbitrary remote HTML, SVG-only inline drawings and unavailable source assets are not silently reconstructed. Remote image availability remains subject to the source host; a failure keeps the caption and source link.

## Checks and rights

`tests/original-figures.test.ts` checks exact-version crop binding, normalized bounds, preserved HTML image/alt/caption data and rejection of unrelated/executable URLs. Actual Chromium rendering of sorting Figure 1 produced a 1204×387 canvas from page 6 of the 16-page PDF; its two tree diagrams were inspected against the complete publisher page. The original PDFs and source attributions retain their existing licenses. Importing a paper does not grant redistribution rights; no new PDF/image is published or copied into a public hosting service by this change.

A direct check of the actual versioned Attention article (`1706.03762v7`) retained three PNG assets across its two image-backed figures; all three asset URLs returned HTTP 200 with an image content type. Relative URLs follow browser base-URL semantics, including a declared HTML base element; the checked paths do not duplicate the version directory.
