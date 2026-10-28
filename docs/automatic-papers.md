# Automatic paper illustration

Opening a research paper now starts bounded Meta preparation in the reader, without choosing a widget type, section or placement manually. This changes the earlier manual-only product behavior. The import dialog and reader explain that source excerpts are sent to the configured Meta service automatically. Operator creation/execution switches still take precedence. No deployment or public-access change accompanies this feature.

## Discovery to reading

Explore arXiv within `/explore`: all subjects, groups, physics archives, individual categories, literal text search, original metadata, abstracts and saved papers. Subject links stay inside Paperplay. Paper titles and Open in Paperplay open the pinned arXiv version in the existing reader. See [exploration](explore.md) for taxonomy, result limits and upstream policy. This searches the live arXiv API; it does not mirror the complete archive or guarantee upstream availability.

The source import first tries structured arXiv HTML and falls back to supported PDF extraction. Original figures, attribution, references and extraction limitations remain in the reading flow. An import failure does not authorize generation on the previously selected paper. The old optional immediate legacy analysis was removed from the import dialog to avoid two independent automatic analyses of one import.

## Meta chooses content and placement

The automatic controller partitions the saved source through existing section contracts. For each admitted section Meta chooses useful catalog widgets, their settings, source quotations and insertion passages. It can return no figure if the content does not benefit from one. The application validates every proposal against the exact source and catalog before inserting it beside the cited passage. It does not pick a graph widget from discipline keywords or insert everything at the end of the paper.

Each bounded run also attempts one bespoke generated SDK interaction, even if catalog widgets were found. The brief asks for a complementary concept, readable labels, padding and meaningful controls. A Meta-proposed concept informs the selected section where available; otherwise the first admitted section is the bounded input scope. Meta chooses the actual mechanism and exact quoted anchor within that scope. This is one attempt, not a guarantee that a scientifically faithful or usable widget can be generated for every paper.

A custom candidate must pass source/manifest admission, the isolated compiler, bounded execution and local layout/interaction checks before insertion. Rejected or unsupported candidates remain visible as failures; an authored generic fallback is never presented as a successful custom Meta figure. Accepted custom figures render inline, lazily near their passage, through the existing isolated runtime. A source-return button leads back to the exact cited text. Model-created figures remain scientifically unverified teaching additions.

## Budget, persistence and recovery

The initial automatic policy admits at most four sections and one generated attempt, with no automatic paid repair. At most five model creations are requested by a fresh normal run; existing server per-paper/global request, token and credit limits may stop it sooner. Long papers explicitly disclose sections outside the initial budget. This limit does not claim every passage has been covered. There are no reader-facing creation tools, generation buttons or JSON editors. Pedagogical controls manipulate the figures already inserted into the paper.

Local requests and accepted job references are saved before the corresponding creation/submission stage. Exact source fingerprints keep different versions separate. Browser Web Locks serialize concurrent controllers/tabs; durable storage and locking are required for automatic paid creation. Reloading a completed paper reuses its results. Opening an older paused or blocked paper automatically attempts safe recovery once the operator policy is ready. Completed and partial results are reused without new generation. An uncertain submission retains its request identity and recovery reference; it does not create a replacement paid attempt. If the server definitively confirms that the exact prepared attempt was never claimed, recovery can submit that same run/attempt identity; missing runs and ambiguous errors do not authorize replacement. Only the current Web Lock owner may persist a run failure, so a paused waiting tab cannot overwrite another tab’s accepted reference. No source cache is silently reset when it cannot be validated.

Leaving the paper stops local preparation and polling. A provider job already accepted may still finish and consume its reserved allowance; its reference remains recoverable. Reopening automatically resumes using the saved context. Unresolved automatic requests prevent source removal, so removal cannot silently discard the only context for recovering a job. Settled automatic records are removed only with their explicitly removed source; unknown or pending originals remain retained.

The [adoption policy](architecture-adoption.md) can disable new model creation and generated execution. Existing saved sources remain readable. Local widget interactions do not create new model calls. Shared snapshot/widget and experiment-bundle opening preserve the established no-new-creation behavior until a paper is explicitly selected for automatic preparation.

## Verification

Routine tests use injected provider-free transports and checked authored fixtures. Browser evidence distinguishes mocked API transport from actual Meta output; these are engineering workflow checks, not additional scientific or human evaluation. The follow-up automatic-only validation distinguishes live Meta responses from earlier simulated transport; no participant study is claimed. Existing held-out findings and reader-study gates remain in force.

The final full check passed **767/767 tests, TypeScript and the production build**. [Automatic reader browser evidence](../data/automatic-reader-browser.json) records four simulated section plans, one simulated custom candidate, real local admission/rendering, exact inline placement, a native control change and reopening with zero further model requests. [Exploration browser evidence](../data/automatic-explore-browser.json) separately records actual arXiv searches and responsive category navigation.

## Reader without authoring panels

The reader no longer mounts the manual Meta planner, custom generation workbench, figure gallery, figure/data importer or JSON editor. Saved source-linked figures and reading/source/notes/export tools remain available. The automatic header is a passive progress or failure message, with no Generate/Continue button. Generated illustrations render their learning controls without the advanced experiment-creation settings.

The Meta environment was checked without exposing credentials: the active server reported configured, and an authenticated model-list request confirmed the selected model was available with zero inference requests. A real fresh-browser test then exposed the actual failure: `/api/enrichment/start` returned403 because the automatic path had never bootstrapped its browser session. The automatic transport now initializes the existing free same-origin session before new section planning, preserving the server's authentication and origin checks. Paused/blocked recovery also changes the progress state immediately instead of continuing to display an inactive status.

[Actual automatic-only browser evidence](../data/automatic-only-live.json) records the fresh-session403, automatic same-request recovery, one real Meta-selected inline figure, a rejected custom locator and reopening with zero further model requests. The custom failure is retained rather than relabeled as success. The later contextual output schema restricts future anchors to existing selected block IDs/pages; it does not retroactively accept that failed candidate.

Final follow-up verification: **776 tests, TypeScript and production build pass**. Native actual Meta creation was bounded to two requests (one plan and one custom attempt), totaling10227measured tokens; the authenticated model-list probe and one existing-result retrieval created no model jobs. The live test confirmed inline placement, no manual authoring controls, narrow/enlarged-text containment and zero new model requests on reopening.

## Visible progress, quota waiting and source mathematics

Preparation now shows a spinner, real stages, per-pass section progress and a loading placeholder. The initial pass denominator reflects its selected sections (up to four), while a separate note discloses the full source section count. Scrolling past that panel keeps a compact progress indicator visible. Confirmed quota rejection shows a waiting state and a countdown instead of a generation spinner, then retries the same unsubmitted reference automatically. Daily token/request caps are retained; accepted or uncertain work is never replaced. A custom run that outlives its original creation window fails explicitly rather than silently extending that window.

Source paragraphs render inline mathematics through bounded KaTeX/MathML with `trust:false`. Existing command-bearing expressions such as `w:E\to\mathbb{R}_{\geq 0}` and `v\in V` become readable without altering saved source text, anchors or cache fingerprints. New arXiv imports retain explicit boundaries around actual inline math elements. Unsupported expressions fall back to original text; prices and code are not interpreted as formulas.

Verification for quota/progress/math: **785 tests, TypeScript and production build pass**. [Native evidence](../data/progress-math-browser.json) records a timed429 countdown, automatic retry with the same reference, visible loading/checking stages, an authored candidate through real local checks, and the user’s inline-math example at320px/32px with no clipping. Server quota flags were disabled and provider responses explicitly simulated; no live Meta creation was used for this check.
