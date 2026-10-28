# PP-093–097 generated artifact preparation

Primary documentation checked 28 October 2026. **Recommendation: specify artifacts now, keep generated execution disabled, and investigate QuickJS-in-WASM inside a disposable browser Worker as the first runtime candidate.** Generated code would produce bounded serialized drawing/control commands; only trusted code would render them. An iframe must not execute arbitrary generated DOM JavaScript. This note is design research, not an isolation validation or an implementation.

## Repository constraints and intended expansion

The inspected lockfile resolves Next 16.4.3, React/React DOM 19.3.1, Zod 4.6.7, TypeScript 7.0.2 and esbuild 0.28.2. esbuild is already exactly pinned. [package.json](../package.json), [package-lock.json](../package-lock.json). The existing [worker build](../scripts/build-engine-worker.mjs) and [worker factory](../lib/execution/client.ts) serve trusted application engines; they are not a destination for arbitrary artifact source.

[CONTRIBUTING.md](../CONTRIBUTING.md) currently says “Do not execute model-provided JavaScript.” The [architecture](scientific-architecture.md#generated-artifact-scope-expansion) records the owner's planned expansion while retaining isolation gates. PP-093 can define, validate, save and inspect inert source/contracts. Its requested working generated-artifact demonstration is not established merely by those contracts or a mocked result; record that portion as gated until PP-094/095/096 provide a validated path. No new dependency, application code, execution permission or paid inference is introduced by this research.

## Proposed minimal contract and SDK

These are proposed interfaces, not existing API names.

| Boundary | Small versioned interface |
| --- | --- |
| Artifact manifest | Kind (`declarative` or `generated-js`), schema/SDK version, source anchors and rights, entry point/source hash, input/state/event schema, requested capabilities, exact dependency lock, asset hashes, resource request and tests. |
| Build request | Manifest + immutable source/asset bytes + host-selected builder version/policy → content-addressed artifact and bounded diagnostics, or structured rejection. |
| Run request | Accepted artifact hash + immutable inputs + parameters + seed + host-approved limits → bounded frame/state/selection messages, or explicit unsupported/timeout/cancel/error. |
| SDK | Deterministic random source, finite-number helpers, plain data state, typed input events, bounded text/line/shape commands, declarative controls and semantic selection IDs. No arbitrary HTML, CSS, URLs, DOM objects, filesystem, network, host storage or inference calls. |
| Host-owned envelope | Attribution, scientific evidence, accepted capabilities, lifecycle controls, accessible fallback and validation reports. Artifact requests cannot upgrade these fields. |

Use existing trusted declarative adapters for the first kind; generated JavaScript remains source **data** until dispatched to the approved guest runtime. Both kinds return the same scene/control result schema. The SDK is a usability interface; the interpreter/bridge enforces the authority boundary. A generated source comment claiming verification, or a passing generated test, cannot establish scientific fidelity.

Suggested variable-length fixture: an ordered chain of stable-ID points with append/remove/reorder/drag operations, length 1–32, and a recomputed polyline length. This exercises growing/shrinking structured state beyond fixed state registers without claiming unbounded collections. Cover empty/maximum rejection, deletion of a selected point, duplicate IDs, invalid coordinates, replay and two simultaneous instances. Its coordinates and measurements are explicitly illustrative unless supplied calibrated quantities. The declarative bridge can display a fixed chain; the generated-kind contract represents the event reducer that changes its length.

## Runtime candidates and limits

| Candidate | Assessment from primary sources |
| --- | --- |
| Native generated JS in an iframe | Sandbox flags can force an opaque origin and restrict navigation/popups; granting both scripts and same-origin to same-origin content can defeat the sandbox. Useful defense around trusted rendering, insufficient as the proposed arbitrary-code runtime. [HTML iframe specification](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox). |
| Native generated JS in a browser Worker | Dedicated execution and `terminate()` help cancellation, but a worker still has its available browser APIs. The Worker interface supplies no configurable per-worker heap limit. Do not interpret off-main-thread execution as a hard process-memory boundary. [Worker interface and termination](https://html.spec.whatwg.org/multipage/workers.html#the-worker-interface). |
| QuickJS/WASM in a trusted Worker | Separate guest language environment, allocator/stack controls and interrupt callback fit a bounded SDK; no host functions are exposed by default. Preferred feasibility spike, subject to bridge, interpreter and browser adversarial checks. [Official binding documentation](https://github.com/justjake/quickjs-emscripten#usage). |
| `node:vm` / Node Worker | `node:vm` is explicitly unsuitable for untrusted code. Node Worker `resourceLimits` omit external data such as ArrayBuffers and do not prevent process-wide OOM. Neither belongs inside the application server as an isolation substitute. [VM](https://nodejs.org/api/vm.html), [Worker resource limits](https://nodejs.org/api/worker_threads.html#new-workerfilename-options). |
| Disposable server builder/runtime | Separate process/environment with an enforced OS resource/network policy can support compilation or a future alternative. Docker defaults have no resource constraints; memory/CPU configuration and host prerequisites matter. Ordinary containers are not by themselves the selected security boundary. [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/). |

## QuickJS feasibility and package choice

The npm registry checked on this date reports **0.32.0** for `quickjs-emscripten`, `quickjs-emscripten-core`, `@jitl/quickjs-wasmfile-release-sync` and `@jitl/quickjs-singlefile-browser-release-sync`; each declares MIT. The main package exports ESM/CJS and types at `.`, plus `./variants` and `./package.json`. Its dependencies include four WASM variants; the smaller candidate is **core + one selected sync variant**, all exactly pinned if adopted. [Published main manifest](https://registry.npmjs.org/quickjs-emscripten/0.32.0), [core](https://registry.npmjs.org/quickjs-emscripten-core/0.32.0), [browser single-file variant](https://registry.npmjs.org/@jitl/quickjs-singlefile-browser-release-sync/0.32.0).

The browser single-file variant embeds WASM in an ESModule. The separate-WASM variant additionally exports `./wasm` and environment-specific module loaders; bundler export conditions and asset paths must be tested. Prefer the browser single-file **sync** variant for the first no-runtime-fetch prototype; avoid Asyncify complexity until required. The project documents different vendored engine versions by variant, so the latest upstream QuickJS release must not be assumed to be the engine inside a package. [Official variant documentation](https://github.com/justjake/quickjs-emscripten/blob/main/doc/quickjs-emscripten-core/README.md).

`newQuickJSWASMModuleFromVariant`, `newRuntime`, `setMemoryLimit`, `setMaxStackSize` and `setInterruptHandler` are documented building blocks. Use a fresh runtime, preferably a fresh WASM module and Worker per artifact session; deny module loading except any explicitly embedded SDK module. Register only bounded SDK functions. Guest `fetch`, storage and DOM must remain absent rather than exposed and then monkey-patched away. Dispose all handles/contexts/runtimes on every success/error path; promise jobs require explicit scheduling and budgeting. [Binding API and lifetime documentation](https://github.com/justjake/quickjs-emscripten), [runtime implementation](https://raw.githubusercontent.com/justjake/quickjs-emscripten/main/packages/quickjs-emscripten-core/src/runtime.ts).

Upstream QuickJS documents runtime allocation limits, maximum stack size and a regularly called interrupt handler for timeouts. These bound **guest-engine resources**, not the total browser process, WASM baseline, JS wrapper, renderer, copied buffers or an arbitrary host callback. Put deadlines on compilation/evaluation/events/jobs; add an independent owner-thread watchdog that terminates the Worker. Do not assume the execution interrupt alone bounds source parsing. Keep callbacks short and input/output serialization bounded: guest getters, custom JSON hooks, deep nesting and error formatting are hostile workloads too. [QuickJS memory/interrupt APIs](https://bellard.org/quickjs/quickjs.html#Memory-handling).

WASM memory configuration is a separate concern: Emscripten allows supplied `WebAssembly.Memory`, but its configuration must match the compiled module. Do not assert a custom linear-memory maximum works with the published variant without a build/instantiation test. Guest allocator limits remain useful even when total memory needs separately measured headroom. [Emscripten Module configuration](https://emscripten.org/docs/api_reference/module.html#Module.wasmMemory).

Preserve binding and vendored-engine MIT notices; verify transitive licenses and exact resolved WASM bytes before adoption. [Binding license](https://raw.githubusercontent.com/justjake/quickjs-emscripten/main/LICENSE), [upstream QuickJS license](https://bellard.org/quickjs/#licensing). No package was installed for this research.

## Proposed trust boundaries

1. The host validates source/manifests as data and approves a capability/asset intersection. It retains private papers, tokens, notes and inference authority.
2. A trusted Worker bootstrap loads only pinned interpreter bytes. Artifact source is interpreted inside QuickJS, never imported/evaluated by browser JavaScript, Next.js, React, the existing engine worker or the app server.
3. The guest receives only approved copied inputs/events. It returns serialized state and SDK commands. Reject invalid, oversized, nonfinite, duplicate-ID or unknown-opcode output before rendering. Never execute returned functions/markup or dereference returned URLs.
4. A trusted renderer draws validated commands. If wrapped in a separate-origin sandboxed iframe, that document contains only reviewed renderer code; generated code never obtains its DOM. Host stop/error/attribution controls remain outside it.
5. Stop/error discards pending frames, closes channels and terminates the Worker. Reopen replays accepted hashes/inputs without generation. This behavior requires real measurements before it is a claim.

An opaque-origin frame commonly serializes its origin as `null`; `null` is not a unique instance identity. A handshake should bind the expected WindowProxy, a fresh instance/session token and a dedicated MessagePort; validate schema, sequence, byte count and rate thereafter. To an opaque receiver, a wildcard target may be necessary during initial transfer, so send no privileged data on an unauthenticated broadcast. A port grants only the actions its host handler implements. [HTML messaging security and channels](https://html.spec.whatwg.org/multipage/web-messaging.html).

## CSP and deployment gotchas

- `srcdoc`, `about:blank` and local-scheme documents inherit copied policies; a child meta policy cannot loosen a restrictive parent policy. An inherited `'self'` is not evidence of isolation merely because the frame's origin is opaque.
- `sandbox` and `frame-ancestors` cannot be supplied effectively through a meta policy. Use enforced response headers; Report-Only does not enforce restrictions.
- `worker-src` governs worker creation, not all subsequent worker behavior. HTTP worker policy containers come from their response; local/blob cases can inherit. Explicitly test both paths.
- WASM compilation may require `script-src 'wasm-unsafe-eval'`; this does **not** permit browser JavaScript `eval`/`Function`. Grant it only to the trusted interpreter environment, not globally as an easy fix.

These are specified behaviors, not a tested production header configuration. [CSP3 policy delivery/inheritance and directives](https://www.w3.org/TR/CSP3/), [HTML policy-container rules](https://html.spec.whatwg.org/multipage/browsers.html#policy-containers).

Use a cookieless isolated serving origin, explicit approved ancestor(s), no credentialed resource paths and no runtime CDN dependency. For the trusted Worker, investigate an enforced policy denying connections and nested workers while permitting only its known bootstrap/interpreter delivery. Embedded WASM can remove a bootstrap network exception. Test Next production/standalone asset URLs, CSP and browser export selection; Node's successful import is insufficient. Keep host/source DOM credentials out of guest inputs regardless of headers. Network tests must include fetch, sockets, imports, images/styles, navigation, forms, popups, downloads, service/shared/nested workers, redirects and local/data/blob URLs; `connect-src` alone is not a universal no-network proof.

For a disposable server comparison, `--network none` leaves only loopback; network namespaces, mounts, credentials and supervisor limits still require review. gVisor's application-kernel approach is a candidate stronger boundary, not a guarantee of compatibility or safety here. Do not mount the project, secret environment or container-engine socket; use fixed read-only tool inputs and disposable output. [Docker none driver](https://docs.docker.com/engine/network/drivers/none/), [gVisor architecture](https://gvisor.dev/docs/).

## Build and acceptance plan

Start with a single bounded JS source file, no external dependencies, fixed SDK version and no user build command/plugin. Existing esbuild can transform strings without filesystem access; bundling instead resolves imports and can execute **host plugins**. Supply only reviewed resolver code over a virtual allowlist. Reject unresolved/dynamic dependencies rather than treating `external` as rejection, since it preserves runtime imports. Pin toolchain/options, source maps and assets; hash normalized manifest plus exact source/dependencies/output, and compare repeat builds. [esbuild API](https://esbuild.github.io/api/), [plugin execution surface](https://esbuild.github.io/plugins/). Parsing/building untrusted source still belongs in the isolated PP-095 compiler, not the application process.

Provisional spike budgets, **not measured guarantees**: 64 KiB source, 32 MiB QuickJS heap, 256 KiB guest stack, 250 ms guest work per event, 1 s owner watchdog, 32 points, 512 drawing commands, 64 KiB serialized state/frame, 30 frames/s and one active guest initially. Interpreter baseline/build memory and total browser headroom need separate measurements; do not claim “32 MiB total memory.” Tune or reject these numbers using the variable-length fixture and hostile workloads, not visual success alone. For deterministic replay, constrain clock/random intrinsics and promise-job scheduling, record event order, and compare outputs with declared numeric tolerances; supplying an SDK seed alone does not establish determinism.

| Gate | Evidence still required |
| --- | --- |
| PP-094 isolation | Infinite loops/recursion/allocations, huge strings/typed arrays, promise storms, malformed/oversized outputs, bridge flooding, all network paths, host DOM/cookies/storage probes, cancellation and two-instance separation. Capture actual supported browsers, latency and residual limitations. |
| PP-095 build | Disposable compiler limits, import/path/hook rejection, repeated byte identity, cancellation cleanup, bounded diagnostics and license/hash inventory. No arbitrary package installation. |
| PP-096 host | Real-browser guest interaction, responsive host stop/fallback, validated commands and simultaneous sessions; no code evaluation in renderer. |
| PP-097 generation | Only after prior gates: explicit authorized generation with bounded attempts/tokens/time, structured build/test feedback and preserved failures. Tests/build/render success stay distinct from scientific verification. |

If a required network, resource, cancellation or authority boundary cannot be demonstrated, return an inert source preview or trusted declarative explanation and leave generated execution disabled. An alternative runtime or narrower capability set is a future design decision, not permission to bypass a failed gate.
