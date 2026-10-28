# Isolated reproducible source admission (PP-095)

The selected compiler prepares a **content-addressed source envelope**, not native executable code or serialized QuickJS bytecode. The artifact manifest and SDK remain unchanged; only a source that passes exact integrity, grammar and interpreter compilation checks gets an admission result. Product execution remains disabled until PP-096 hosting passes. [Primary-source research](artifact-compiler-research.md) and [captured Chromium measurements](../data/artifact-compiler-browser.json) record the design and actual limits.

## Pipeline and authority

1. The host validates the artifact/source version and required checked data through the existing build interface. It sends the compiler only generated source, its SHA-256, the manifest digest and SDK digest. The request adds no paper context, data assets, notes, provider keys, filesystem path or build command. Generated source may itself contain source-derived text and remains private artifact content.
2. A fresh dedicated compiler Worker receives one bounded request. Its enforced HTTP CSP denies connections and nested workers while allowing only its trusted bundled interpreter. The owner validates the instance and response/hash, supports cancellation and terminates the Worker on completion or its two-second watchdog.
3. The fixed, reviewed **Acorn 8.19.0 UMD source** is loaded as trusted compiler infrastructure inside a capped QuickJS/WASM runtime. The artifact text enters through a guest string handle, not wrapper-source interpolation. Acorn parses that string; the AST and policy walk stay inside the guest limits. Only a tiny status/position result crosses back.
4. A fresh context/runtime compiles the exact accepted script with explicit `type:'global'`, `strict:true`, `compileOnly:true`. The returned handle is disposed without execution. There is no call to `update`, pending-job scheduler or artifact-provided test during compilation.
5. A strict envelope records the exact source, manifest/SDK/parser/engine hashes, compiler/policy/grammar versions, effective resource policy and an empty external dependency set. Sorted-key canonical JSON with a versioned domain separator produces its SHA-256. Timestamps, durations and instance IDs are outside that identity.

The trusted project build script bundles the compiler infrastructure; generated source is never an esbuild entry, filesystem path, plugin or subprocess argument. The parser plugin reads only the fixed installed parser and checks its exact SHA-256. It also checks the selected interpreter-loader/WASM module's exact hash before building. Both dependency versions and licenses are locked in the repository.

## Accepted language and rejection policy

The first compiler admits one top-level synchronous nongenerator function named `update`, with exactly three simple identifier parameters. Comments, strings, templates and nested helper functions are supported. It rejects additional top-level executable statements, async/generator/module syntax, static/dynamic imports, `import.meta` and loader identifiers including Unicode-escaped `require`.

There are no package installs, arbitrary dependencies, hooks, build commands, filesystem resolver or remote imports. Entry filenames are fixed to `figure.js`. Manifest/request schemas reject undeclared fields and path/build expansion. Syntax admission is not scope analysis, a semantic proof or a complete sandbox; dynamically constructed guest code still has no host loader or authority at runtime. AST screening complements the independent interpreter/worker/output boundaries.

The model source limit is 64 KiB; compiler messages also have byte ceilings. ASTs cap at 8,192 nodes and depth 96. The compiler uses a 64 MiB maximum WASM memory, 32 MiB guest allocator and 512 KiB stack. A one-second interrupt budget covers guest work; the independent two-second owner watchdog also covers initialization and parser/compiler paths that may not poll interrupts. No total-browser-process memory limit or hard per-C-function interrupt latency is claimed.

Acorn, its AST and model strings are inside the restricted interpreter, rather than an unbounded native-Worker parser heap. The two compiler contexts are disposed sequentially, with no generated code execution. Every normal result/diagnostic path terminates its Worker, discarding transient state; no temporary project files or shared build service are created.

## Diagnostics, storage and UI

Diagnostics contain only a finite public code, generic message and optional numeric source position. They omit parser exception text, source snippets, identifiers, stack traces, private paper content and host paths. The source remains explicitly stored in its user-visible manifest and compiled envelope; that is separate from a diagnostic log. Build success remains `syntax-and-policy-only` with `scientificEvidence:'unverified'`.

**Prepare preview** runs this local compiler in the generated-figure preview. It supports cancellation and keeps source attribution accessible. Success reports preparation while execution remains unavailable. Wrong source versions, SDK/parser digests, malformed responses and unsupported browsers retain an explicit fallback. No inference, npm installation, server execution or scientific verification is triggered.

## Validation

`npm run check`: TypeScript, **303 tests** and production build. Tests cover repeat-envelope byte identity, hashes, compile-without-run bodies containing throw/infinite-loop, entry shape, imports/Unicode/nested templates, comments/strings, request/path/hook expansion, source injection, syntax/AST complexity, integrity, source-free diagnostics, response identity and cancellation cleanup. Test-process concurrency is capped at four; correctness probes allow a larger declared test budget while hostile deadline cases retain their short limits. This avoids mistaking CPU scheduling across many simultaneous interpreter tests for a correctness failure.

Native Chromium154/Linux produced identical hashes for two builds (135/142 ms in the recorded run). Throw/loop bodies compiled without running. Nested imports, invalid syntax and excessive AST depth were rejected; diagnostics did not contain the submitted private-name marker. Under concurrent local test/build load one syntax probe took 1,080 ms, retained in the report rather than presented as an SLA. Cancellation and a deliberately short watchdog both terminated at 10 ms; the host heartbeat advanced 38 times and zero workers remained. In the production Next preview, preparation and cancellation worked at 320 px, the compiler response carried the enforced CSP and no model calls occurred.

Remaining gates are the production execution bridge, generated-test/repair orchestration, portable artifact lifecycle and scientific checks. Compiler success alone enables none of them.
