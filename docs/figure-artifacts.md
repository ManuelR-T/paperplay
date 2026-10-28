# Figure artifacts and SDK (PP-093)

This deliberately expands the old “never execute model JavaScript” scope in [CONTRIBUTING.md](../CONTRIBUTING.md), with an explicit boundary: PP-093 initially kept generated source inert. PP-094 isolation, PP-095 compilation and the [PP-096 production bridge](figure-runtime.md) now admit only validated synchronous SDK figures after a fresh local compile. It is never evaluated by JavaScript in the host, an ordinary worker, Node or an iframe. No generation endpoint or paid action is added here.

## Two implementations, one lifecycle

`buildFigureArtifact` and `runFigureArtifact` accept both kinds of versioned `paperplay-figure-artifact` v1:

| Kind | Build | Run |
| --- | --- | --- |
| Declarative | Validate original representation/source and checked asset bindings | Delegate to existing approved representation lifecycle without altering v2 widgets |
| Generated | Validate bounded source manifest, exact source/SDK hashes, interface/resource/capability declarations | Return `disabled` unless trusted host code explicitly supplies an execution adapter; the current product supplies only the fresh-compile-gated PP-096 adapter |

Both return structured recoverable outcomes; source version and hashes are rechecked at run time. Manifest fields cannot supply executable adapters, privileges, approval or verified evidence. Declarative trust means an approved grammar/adapter, not scientific validity. Generated code remains `untrusted-source` and `unverified` even when a reference interaction runs successfully.

The internal test adapter executes the generated implementation in a restricted QuickJS/WASM guest with no host functions or module loader. It demonstrates the interface and SDK, not completed browser/process isolation. It has guest heap/stack limits and an interrupt deadline; PP-094 must test the additional browser watchdog, compilation, message, total-memory and rendering boundaries before product execution. There is no `eval`, `Function` or Node `vm` of generated source in the application JavaScript environment.

## Manifest and SDK

The manifest carries exact source document/version and quotation anchors, authorship, rights, assumptions, one entry `figure.js`/named `update`, pinned SDK dependency/hash/license, capability requests, typed input/state fields, checksum-bound checked assets, tests, provenance and resource ceilings. Sources cap at 64 KiB; complete manifests at 384 KiB. The source is a script defining `function update(input, previousState, event)`, not an npm package or arbitrary build command. Source/SDK integrity validation is not the isolated compilation step planned in PP-095.

SDK 1.0.0 is a small frozen guest-side helper object. It constructs JSON frames, circles, lines, rectangles, labels, buttons and sliders. Frames include a numerical/text table and plain state. Capabilities are finite (`draw-2d`, `controls`, `source-return`, `entity-selection`); there are no HTML/CSS/URL/DOM/network/filesystem/inference handles. The host validates output bytes, state bytes, marks, controls, finite coordinates, source IDs, table shape and slider domains. Returned JSON can never promote evidence or authorize another capability.

Declared array interfaces carry explicit length limits. State and input are serialized into the guest, not exposed as references to application objects. Output serialization occurs inside the guest deadline/heap policy so hostile getters or JSON hooks do not execute in host JavaScript. Interpreter errors are sanitized; private input and source text are not copied into diagnostics.

## Working reference fixture

`lib/artifacts/fixtures/dynamic-sequence.ts` contains inert generated JavaScript using the SDK. Its event reducer adds/removes/resets a sequence of zero to 32 stable-ID items, regenerates circles/labels and exposes every current item in a table. Removing an item preserves the remaining IDs. This growing/shrinking structured state is absent from the old fixed-register custom runtime. The fixture is project-authored teaching content, not a research result or a model-generated success claim.

The reference tests run declarative and generated implementations through the same lifecycle, supply only the restricted-interpreter test adapter, and verify sequence lengths 0→1→2→1 and the surviving ID. Without that trusted adapter the same generated artifact returns `disabled`. The PP-093 preview was inert. The PP-096 preview now accepts exact checked data and opens only the approved isolated bridge; source reading and declarative figures remain usable.

## Dependencies and evidence

Exactly pinned `quickjs-emscripten-core@0.32.0` and `@jitl/quickjs-singlefile-browser-release-sync@0.32.0` are MIT licensed; notices include their FFI dependency. The selected variant embeds WASM, avoiding a runtime WASM fetch in the reference adapter. It is loaded only by the separate compiler/runtime Workers, not the reader JavaScript environment. [Primary-source research and unresolved gates](generated-artifact-research.md) explains why this is preferable to exposing native browser JavaScript, while preserving its limitations.

`npm run check` covers TypeScript, 295 tests and production build. New reference checks cover the two implementations, dynamic state, integrity/SDK locks, source mismatch, strict privilege/evidence fields, output and interface budgets, missing ambient APIs, loop interruption and cancellation. Native-browser verification checks disabled product behavior, attribution and inert manifest download. No complete sandbox, scientific verification or model generation is claimed at this milestone.
