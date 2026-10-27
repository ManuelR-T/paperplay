# Reader and personal research tools — implementation evidence

Implemented in the M6–M10 development branch, 27 October 2026. This is developer verification of software behavior, not a participant study or an independent accessibility certification.

## Implemented surfaces

- Shared reading preferences provide 18/20/22 px source prose, 55–75 ch measure resolved against the actual serif font, line spacing 1.55–1.85, light/sepia/high-contrast appearances and a focus mode. Stored source strings stay unchanged; PDF line wrapping reflows for presentation. Preferences preserve the visible source anchor.
- Source-aware contents and the sticky reading breadcrumb preserve physical PDF versus logical HTML references. Stable source/figure offsets supplement legacy absolute reading positions. Scroll-only saves no longer rerender every paragraph or recalculate all figures.
- Passage tools are available on hover, focus, keyboard and touch. Curated, source-scoped glossary entries and explanation layers cover the three prepared editions; missing imported definitions remain unresolved. Worked examples explicitly identify synthetic assumptions and hand calculations. An existing contextual-question action is explicit and remains separate from source text.
- Legacy figures use keyboard-operable disclosures; heavy figure components and workers mount on opening rather than on every offscreen passage. Source paragraphs remain in the DOM for reading, navigation and browser find. Incoming figure/hash links open the intended disclosure.
- Original comparison renders a single original PDF page through the pinned PDF.js worker and local resources. It renders original bytes, not generated imagery. Exact page/quotation references remain available; optional text-region highlights are offered only for complete retained coordinate mappings, with approximate glyph extents labeled. Raw reconstruction provenance is inspectable.
- Local notes, passage highlights and scoped personal definitions support editing, deletion, tags, source/version/quote validation, import/export and unresolved old-source states. Legacy and v2 widget configurations can be linked to a note. Credentials and job capabilities are not accepted by the strict notes format. A shared note store parses the notebook once rather than once per paragraph.
- Local library search indexes valid prepared/imported sources, scoped definitions and resolved personal notes in a browser worker. It has explicit source/index bounds, cancellation, stale-result guards and no blocking search fallback or inference. Deleted/unavailable sources do not remain searchable in a rebuilt index.
- Study packs provide a standalone printable HTML view of explicitly included source/notes/PDF and captured figure states. Actual legacy and v2 configurations, source attribution, scientific labels, safe image captures and compatible reopen links are retained. Full source and PDF inclusion are off by default. Metadata can include a short cited quotation; links do not transfer a local PDF. Original TeX is printed as wrapping source when its typeset form would clip.

## Observed browser behavior

The actual Chromium UI at localhost:3011 started with 20 px prose, zero mounted legacy simulations and three available figure disclosures. Settings changed prose to 22 px and sepia, focus mode hid the research desk, and Escape left focus mode. High contrast produced light text on a dark page; 320 px checks reported document width 320 px with no horizontal document overflow.

A scoped gradient-descent passage displayed the authored scalar example A=2, b=2, w0=0, alpha=0.25 and first update 0.5, with explicit synthetic scope. A personal note was saved, then a 524-byte annotation file and a source-excluding HTML pack were downloaded. The worker indexed 147 entries across the original prepared sources and notes; a query from one paper returned matching quadratic passages from another source. A later study-pack export captured both a current v2 equation widget and a completed legacy numeric figure (83 updates, residual about 9.0463e-9).

A reader-only failure rehearsal imported the actual 18-page priority-search-tree PDF with one browser-injected unavailable-analysis response and zero real provider creations. All 243 reconstructed source blocks remained readable. The original comparison exposed retained provenance/region controls. An original-page render produced a 2076-pixel-wide canvas with nonwhite original page content and reported page 1 of 18 without errors. This checks the reader fallback; it is not a claim of a real provider outage or a successful model analysis.

The settled default prepared-reader view passed axe-core WCAG 2/2.1 A/AA checks with 27 passes and zero violations. This targeted automated observation does not establish complete accessibility conformance for every imported paper, every widget or every assistive technology.

## Repeatable checks and remaining limits

`tests/reader-tools.test.ts` contains six boundary/reference tests covering quote/source-version identity, missing passages, note/experiment portability, credential-field rejection, storage failure, scoped definitions, full-text identity, preference domains, explicit pack inclusion, source validation of new widget metadata and inert visual payloads. Strict TypeScript passed after integration.

The wider reader-performance/browser profile and complete application test count are recorded by the integration owner. Authored explanation layers are a curated starting set; unknown paper content is not automatically understood by those templates. Local storage remains finite and can be cleared. Search reports bounded indexing, not full-text coverage of an unlimited library. Pack reopen links require the originating installation, supported versions and source/site access. No reader-study participants were available, and no learning outcome is claimed.

A later native interaction check double-clicked the original KaTeX alpha glyph and opened its matching source-scoped definition. The same action is available through focusable symbol buttons and a definition selector. Returning from the definition focused the exact original source block after dialog dismissal. Equation scroll regions and the original-page preview are explicitly keyboard-focusable.
