# Source mathematics and copying

Scientific source text and anchors remain unchanged; only presentation and clipboard serialization are adapted.

`SourceMath` recognizes explicit delimiters and conservative command-bearing formulas from older cached imports. KaTeX remains bounded, with `trust:false`, limited expansion and no arbitrary HTML. A host-owned `\textsc` alias renders algorithm names such as Pred and BMSSP upright instead of causing the whole expression to fall back to raw TeX. Punctuation stays with the preceding formula when lines wrap. Unsupported syntax stays visible as original text.

The reported SSSP paragraphs were compared with the actual [pinned arXiv HTML](https://arxiv.org/html/2504.17033v2). The current importer extracts each mathematical expression once. Its semantic MathML/TeX annotation regression also preserves intentionally repeated adjacent formulas. No source-level duplicate deletion or mathematical rewriting was introduced.

KaTeX emits accessible MathML alongside visual HTML. Browser selection previously included both: alpha appeared twice and a hatted distance became two flattened fragments. The semantic representation remains accessible, but is excluded from visual selection. Reader copy handlers serialize each selected formula once as its original delimited TeX, preserving hats, primes, subscripts and algorithm names. Selecting part of a formula copies that complete formula. Ordinary text/currency copying is left to the browser. The handler works on a cloned range and never changes the saved source or user's selection.

[Native evidence](../data/bmssp-math-copy.json) records exact copying of both user-reported paragraphs, partial-formula copying, retained MathML, zero KaTeX errors and narrow/enlarged-text containment. The full checkpoint passed787tests; final renderer changes passed14targeted tests, TypeScript, production build and the native clipboard checks. No Meta creation was performed.
