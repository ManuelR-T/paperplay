# Paperplay — agreed product scope

Status: product framing, 26 October 2026. This document describes intended behavior, not completed functionality. It supersedes the initial Vite/Express/Groq and attention-paper scaffold.

## Product

**Manipulate the ideas in a research paper to understand them.**

Audience: engineers exploring an unfamiliar method, with explanations accessible to students who know basic programming and mathematics. The interface, generated explanations and demonstration are in English.

The developer is working solo. The open source project should support research papers about algorithms generally. Pathfinding is a possible demonstration case, not the product's boundary. The developer's own delivery schedule remains open; the public event lists a 4 November submission deadline. [Official event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon).

## Reading experience

Open directly into an example augmented paper. Readers see the source paper reformatted for comfortable reading, with added figures at relevant points in the article. Clicking a referenced passage opens or focuses its associated figure. Figures also work inline without requiring a separate laboratory pane.

Preserve source text, equations, original figure references and source anchors. Clearly distinguish material added by Paperplay from the source author's claims. Generated explanations supplement the paper; replacing it with a summary does not satisfy the scope. A document with incomplete extraction must show its limitations and offer the original rather than silently filling missing passages.

Import accepts PDF and arXiv links. A public structured article source is preferable when available; PDF extraction is a fallback with explicit limitations for columns, equations and figures. Scanned PDF OCR is outside the MVP.

Desktop is the primary reading target. Use editorial typography, generous reading space and restrained color in the article, with more expressive interactions inside figures. Keep essential controls usable on smaller screens; a separate mobile application is outside scope.

## Generic figures and supported algorithms

The system has two independent extension points:

- **Figure renderers** display reusable visual structures: graphs, arrays/tables, matrices, mathematical plots, step sequences and method comparisons.
- **Execution engines** implement specific supported algorithms and produce deterministic traces or measurements for those renderers.

Meta chooses, configures and places figures from this catalog. It does not invent executable code. A new paper can receive useful source-linked illustrations without requiring an engine for every algorithm it describes.

Prioritize animation, interactive graphs and comparisons. Add small reusable array and step primitives so those priorities do not accidentally limit the product to graph algorithms. Rendering a supplied graph or explanatory sequence is not evidence that its algorithm has been implemented.

For an unsupported method, generate a source-grounded schematic or illustrative walkthrough and label it accordingly. Do not silently substitute A*, another supported method, invented measurements or an unrelated simulator. An incompatible comparison becomes a conceptual explanation rather than a fabricated benchmark.

At least two substantially different algorithm examples should exercise the same figure contract before calling the architecture generic. Their exact papers are still to be selected; the requirement does not imply support for all algorithms at launch.

## Scientific fidelity

Aim for experiment reproduction when a supported engine, data and protocol permit it. Otherwise offer a mechanism reproduction or a clearly identified simplified illustration. These are different claims, not interchangeable quality scores.

The application, supported-engine metadata and reference checks determine the fidelity label. The language model cannot grant its own output a verified label. An exact source citation confirms provenance, not the correctness of an entire interpretation.

A reproducible run records the paper version, engine version, dataset or generated input, seed, parameter values, metric definitions and results. An experiment reproduction also records the original evaluation protocol and the scope and tolerance of the comparison. Browser runtime is measured locally; it must not be presented as reproducing a paper's hardware timings.

Recommendation for the unanswered data choice: start with deterministic synthetic inputs designed to reveal a mechanism. Use original public data and documented protocols when an experiment can actually be reproduced. Label synthetic examples; do not describe them as the paper's dataset.

Users manipulate predefined parameters and inputs. Natural-language figure editing, a code editor and arbitrary generated-code execution are outside the MVP.

## Meta integration and analysis lifecycle

Use the **official Meta Model API**, not Groq. The current documentation supports an OpenAI-compatible client directed to `https://api.meta.ai/v1`; the proposed initial model is configurable `muse-spark-1.3`. The package name does not change the inference provider. Actual model access and credit activation require a real account check. [Meta Responses API](https://dev.meta.ai/docs/protocols/responses).

Meta's responsibilities are to identify explainable concepts, select and configure appropriate figure types, choose relevant source anchors, explain observations in context and answer questions about a selected passage or figure.

An analysis progresses through real observable stages: document extraction, source preparation, model analysis, output validation and figure assembly. Do not display invented percentages or pretend to observe internal model stages.

Create model analyses in background mode, persist the response reference locally, retrieve status and results through server routes and support cancellation. On reopening the application, resume pending work or explain that a response has expired. Reconnecting must not automatically create and bill a second analysis. Document extraction and application validation have their own recoverable checkpoints; provider background execution is not a complete application workflow engine. [Meta response retrieval](https://dev.meta.ai/docs/api-reference/responses/retrieve-response).

Use structured output plus runtime validation of supported figure types, source references, bounded controls and engine compatibility. Treat paper content as untrusted input to the model. A malformed result must fail explicitly or use a valid fallback.

## Contextual questions

Provide questions about a selected passage or figure rather than a general-purpose chat product. Include the selected source and, when relevant, the current input, parameters and measured execution state. Answers reference the source or identify an interpretation; they must not describe a run that has not occurred.

## Persistence and sharing

No user accounts. Save imported documents, analyses, settings, source anchors and pending-job references in browser-local storage, preferably IndexedDB. Saving locally does not mean that model analysis is offline: relevant source content is sent to Meta.

Share reproducible figure state: public source identifier, figure specification or stable reference, dataset reference or compact synthetic input, random seed, parameters and engine/schema versions. Use a versioned URL payload for small snapshots. For larger local content, offer a snapshot export/import rather than imply that another browser can access the sender's IndexedDB.

A shared URL for a private local PDF cannot transfer that PDF by reference alone. The recipient must import the source or receive a deliberately exported bundle. A central shared paper library and synchronization are outside the MVP.

## Technology decisions

- Next.js App Router, React and TypeScript: reading pages and server routes in one application.
- shadcn/ui with Tailwind CSS: frontend component foundation, explicitly selected by the user during M0.
- Meta-compatible server client: official Model API with server-only credentials; prefer its documented background primitives over an additional job platform initially.
- Zod: application contracts and validation after model output and snapshot import.
- PDF.js in the browser: extraction and access to original pages; structured arXiv content when available for higher-quality reformatting.
- React/SVG for custom figures; add a chart or animation library only for an identified renderer need.
- Browser execution in TypeScript, with Web Workers where calculation would otherwise block interaction.
- IndexedDB for local persistence; no application database or sign-in requirement for the initial product.

Source research and platform limitations: [technology-research.md](technology-research.md).

## Budget and delivery

Budget: approximately $150 in hackathon Meta credits, with no paid infrastructure assumed. Track actual token usage and avoid model calls when a reader changes a slider. Reuse saved analyses and seed the demonstration example locally. Account credit balance and post-event availability are not yet verified.

Deliver both a hosted URL and a local demonstration. The prepared example remains usable without a model request; live import and contextual questions clearly report missing configuration or provider failure. A public demo with a shared API key must bound usage and protect access to analysis responses without requiring product user accounts.

Open source is the intended trajectory. The project license remains to be selected. Track paper/example permissions and third-party attribution when preparing redistributable demo content.

## Explicit exclusions

No claim of automatically reproducing every paper or every published experiment. Verified reproductions of supported experiments remain in scope. Also excluded: model training, scanned-document OCR, real-time collaboration, mobile-native apps, arbitrary generated code, broad web discovery, social features, billing and cloud account synchronization.

## Acceptance criteria

1. A reader opens an example and can inspect the article and manipulate an inline figure without setup.
2. A changed parameter produces a real, deterministic change in a supported computation, and reset restores the initial state.
3. A paper from a different algorithm family can reuse the figure contract; unsupported computation produces an honest schematic fallback.
4. Every added figure and generated explanation has a usable source anchor; original text remains distinguishable.
5. A reproduction label is backed by defined checks; illustrative traces and synthetic data are explicitly identified.
6. A real PDF/arXiv import runs through extraction, Meta analysis and validation, with recoverable failure states.
7. Reloading during a model job restores its reference and retrieves its status rather than silently starting over.
8. A shared small snapshot restores the same compatible input, seed, parameters and engine version in another browser.
9. A contextual question uses the selected passage/figure and current state, with traceable references.
10. The core demonstration works locally and on the hosted URL, with a prepared fallback and an English demo narrative.

## Solo implementation order

1. Replace the superseded scaffold with a running Next.js shell and the agreed source/figure/engine contracts.
2. Build one faithful reading example with an inline interactive figure, deterministic computation and source references.
3. Add a second algorithm family to exercise generic renderers; implement honest unsupported-method fallbacks.
4. Add PDF/arXiv ingestion and official Meta background analysis, then verify output and resume/cancel behavior.
5. Add browser persistence, figure snapshots and contextual questions; keep expensive analyses bounded.
6. Validate scientific invariants, import failure paths and shared snapshots; deploy and rehearse the demonstration.

Steps are ordered priorities, not a delivery-date estimate. There is no additional scope-approval gate: accepted choices authorize implementation, while unresolved paper selection and schedule can be settled alongside independent work.
