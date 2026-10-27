# PDF and arXiv import (M2)

Paperplay imports a source document before proposing explanations or widgets. Import does not call a model or send a local PDF to a server. It produces the existing `SourceDocument` contract, with deterministic block IDs, source anchors, extraction warnings and a versioned content identity. The controller can retain the returned original Blob for the PDF reader and IndexedDB storage.

## Public entry points

```ts
import { extractPdf } from '@/lib/import/pdf';
import { importArxiv } from '@/lib/import/arxiv-client';

const pdf = await extractPdf(file, { name: file.name, signal, onProgress });
const paper = await importArxiv('1805.04154v1', { signal, onProgress });
```

Both return `ImportedSource` from `shared/import-types.ts`. PDF progress reports completed physical pages and total pages. HTML is one logical reference document, so it has no physical PDF-page progress. Cancellation uses the caller's `AbortSignal`.

## Local PDF extraction

PDF.js runs in the browser using the local `/pdf.worker.min.mjs` worker. `scripts/copy-pdf-worker.mjs` copies the installed package's worker, CMaps, standard fonts and WASM files to `public/`; run it after dependency installation (the package postinstall hook does this). Runtime extraction does not require a CDN. Keep the worker and library from the same installed package version.

The importer checks the byte size and PDF signature, then reads the text of each physical page. Text items become paragraphs without moving content between pages. Each block has a stable page-and-sequence ID, and each non-heading block has an anchor quoting its first 300 characters. The original Blob is retained, including when metadata or layout extraction is incomplete.

Limits are explicit failures: local PDFs up to 10 MiB and 50 pages; all imported sources up to 200,000 source characters and 1,000 blocks. Content is not silently cut to fit. Model analysis has its own smaller context budget; successful import does not promise that the complete source fits a model request.

Password-protected, malformed, and image-only documents produce actionable failures. There is no OCR in M2. A source with fewer than 200 extracted characters is treated as unreadable. Pages with little text, possible multiple columns, and uncertain mathematical/layout fidelity produce visible warnings. Multi-column detection is a heuristic, not a layout reconstruction guarantee. PDF text stays paragraph text: the importer does not manufacture LaTeX equations, tables or scientific figures from lossy text extraction. Users must check the original PDF for exact math and reading order.

## arXiv resolution

The client sends an arXiv identifier to `GET /api/arxiv?id=…`. Accepted inputs are modern or legacy arXiv IDs, optional explicit versions, `arXiv:` prefixes, and HTTPS `arxiv.org` `/abs/`, `/html/` or `/pdf/` links. This route is not a general URL proxy. User credentials and arbitrary hosts, ports, protocols and paths are rejected.

Unversioned IDs are resolved through the arXiv Atom API to a specific `vN` before content is fetched. If the version cannot be resolved, import fails and asks for an explicit version or local PDF. Explicit versions do not need that metadata lookup. Each content redirect must remain on the approved HTTPS arXiv hosts and paths, and the final content identifier must match the pinned version. Redirects are manual and limited to three; requests have a 12-second timeout and streamed size limits. Cancellation propagates to fetch.

Structured HTML is preferred (maximum 2,000,000 downloaded bytes). Cheerio extracts headings, paragraphs, TeX-bearing math and original figure captions into plain schema fields; executable markup and remote images are not retained or fetched. Equation groups retain each available math expression. Figure blocks link to the original article rather than claiming to reproduce the image. Unsupported or missing math representations may remain plain text with a warning.

**HTML page 1 is a logical source reference, never a physical PDF page.** Its source URL is `/html/<pinned-id>`, and the extraction warning explicitly explains this distinction. The reader should label these anchors as HTML references. There is no inferred HTML-to-PDF page mapping.

If readable HTML is unavailable, the route downloads the fixed pinned PDF URL, capped at 3,000,000 bytes. It returns bounded base64 JSON (under 4.5 MB) so the browser can use the same PDF extraction path and retain the original Blob. The browser normalizes that result as an arXiv source with the pinned identity; its page references are physical PDF pages. If neither source works, the failure remains explicit. Network availability and arXiv rate limits can affect import independently of local PDF import.

## Identity and provenance

`normalizeSource` uses portable Web Crypto SHA-256 over normalized content, source identity, metadata and normalizer version. Local PDF identity also includes the original PDF-byte digest; arXiv identity includes its pinned ID. The resulting source ID and `sourceVersion` are deterministic for the same input and normalization version. Changed content creates a changed identity. These values support deduplication and cache invalidation; they do not certify scientific correctness.

Normalization collapses presentation whitespace. Paragraph splitting preserves all normalized source text and its physical or logical page. Source content over schema/import limits is rejected. Metadata title and author fields follow schema length limits; source anchors are excerpts of retained blocks, not additional summaries.

## Verification

Run `npx tsx --test tests/import.test.ts`. The tests cover deterministic normalization and changed-content identity, source limits and anchors, column/math text behavior, strict identifiers, structured HTML sanitization and math groups, version pinning, PDF fallback, redirect blocking and streamed byte bounds.

The actual bundled 18-page publisher PDF is parsed with the installed PDF.js legacy Node build to check physical-page provenance, retained Blob and mid-import cancellation. Invalid magic, corrupt PDF bytes and oversized input are exercised directly. Password, image-only and 51-page status tests simulate the PDF.js library boundary; they are not claims of coverage against separate encrypted/scanned fixture files. The browser uses the standard worker build; Node uses the injectable extraction core to avoid browser DOM dependencies.

A live explicit-version check of the existing demo ID `1805.04154v1` successfully returned structured HTML with 151 source blocks during implementation. The downloaded source was not committed or logged. Network-free fixtures remain the repeatable test suite.

API references: [PDF.js examples and Node usage](https://mozilla.github.io/pdf.js/examples/), [arXiv API user manual](https://info.arxiv.org/help/api/user-manual.html).
