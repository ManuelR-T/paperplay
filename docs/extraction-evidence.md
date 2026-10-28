# Inspectable extraction evidence

PP-107 retains a versioned sidecar next to the immutable SourceDocument. It inventories source text, structured equations and tables, figure references and supplementary references, together with extraction basis, losses and original locators. A checksum binds the sidecar to its source fingerprint; a separate digest identifies original input bytes. Neither digest establishes scientific validity.

## Source adapters

PDF imports retain the actual file bytes and their SHA-256. PDF.js user-space frames, rotation, user units, viewport transforms and baseline regions remain explicit; baseline boxes are heuristic rather than exact glyph bounds. Physical PDF pages can be opened locally. Annotation and attachment metadata are inspected through bounded optional APIs. Attachment contents, OCR, reconstructed equation TeX and inferred table cells are not extracted. Unsupported modalities have explicit losses and a return to the original. Image-only imports retain a downloadable original and loss report without inventing a readable SourceDocument.

Structured arXiv HTML retains raw TeX/MathML as inert strings, table cells including blanks/spans, captions and references. HTML structural paths do not masquerade as PDF coordinates. Duplicate element identities and unsafe URLs remain losses. The PDF fallback preserves reconstruction coordinates when rebinding its source identity to arXiv. Existing prepared papers receive a clearly labeled normalized-SourceDocument inventory: its hash identifies normalized JSON, not unavailable publication bytes.

Inventories are bounded to 512 entries, 1 MiB, 1,024 cells per table and 4,096 cells overall. Capacity loss is explicit. An absent entry means not inventoried, not proof that the publication contains no such object. A damaged or future saved sidecar remains downloadable separately while the source and PDF stay readable.

## User interpretation

Files & source exposes the inventory and its original locators. Derived transcriptions and notes form a separate append-only revision chain, bound to the source, manifest and before-value hashes. Replace, revert and undo append revisions; none modifies SourceDocument quotations, the PDF or attachment. IndexedDB compare-and-swap prevents one tab silently replacing another tab's notes. Invalid imports and incompatible saved records remain available for explicit recovery. Annotations-only export excludes original file and attachment bytes.

## Supplementary material

References do not fetch automatically. The first admitted adapter is the exact public Chew biomass workbook from FAIRDOMHub, version 1. Local review, a recipient/data disclosure and separate consent precede bounded server retrieval. Exact bytes, MIME/magic, release URL and digest are checked. The result is a passive workbook download: formulas, archives and workbook code are not executed, and its values do not automatically become scientific assets or evidence. Arbitrary URLs, credentials and access-control bypass are not supported. See [the admission record](supplement-admission.md) and [primary-source research](supplementary-extraction-research.md).

## Verification

Contract, PDF, structured HTML, correction, import/recovery and supplement tests cover source/checksum changes, malformed geometry, table bounds, unsafe references, consent and byte mismatch. Native-browser evidence is recorded in `data/extraction-browser*.json`; authored fixtures are identified as engineering examples. No paid inference or human-reader result is required or claimed by these checks.

During browser QA, FAIRDOMHub returned HTTP 406 when the request's Accept header named only the XLSX MIME. Its download controller accepts `*/*`; response MIME, exact bytes, ZIP signature and SHA-256 remain mandatory. This is HTTP content negotiation, not an access-control workaround. The unavailable response remained visible with original/local alternatives before the corrected request was tested.
