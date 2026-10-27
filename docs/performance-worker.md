# Background engine execution — PP-042

The reader sends serializable computations to a disposable browser Web Worker rather than executing supported engines on the UI thread. Server-side source validation and contextual-question recomputation remain synchronous, bounded server work. Worker execution makes no inference request.

## Interface

`useEngineRun`, `useEngineComparison` and `useEngineExecution` in `components/use-engine-execution.ts` accept the versioned input consumed by `lib/execution/protocol.ts`. They expose actual lifecycle status, a validated result, an error, cancellation and explicit restart. There are no invented percentage updates. A new input, seed, parameter set or comparison selection terminates the previous worker. Results are hidden immediately when the request identity changes, before the next React effect runs; sequence guards reject obsolete asynchronous completions.

For a comparison with different settings per method, pass `options.parametersByEngine`, keyed by selected engine ID. Shared settings are filtered to each registered capability, then explicit per-method overrides are applied. Unknown methods/parameters are rejected. A direct/worker regression checks distinct gradient-descent and heavy-ball step sizes and momentum without collapsing them into one shared parameter set.

`executeInWorker(input, { signal, onProgress })` is the lower-level interface. One worker is created from the precompiled `/engine.worker.mjs` asset, with the application/protocol version in its URL and `type: 'module'`. `scripts/build-engine-worker.mjs` bundles trusted code as browser ESM on install, development startup and every local/hosted build. This avoids Next/Turbopack copying an uncompiled TypeScript URL as an ordinary asset. Run `npm run worker:build` after changing an engine during an already-running development session. Cancellation calls `terminate()`, interrupting computation rather than merely hiding its answer. No blocking UI-thread fallback is started when workers fail or are unavailable; the original paper remains readable and a useful error is shown.

## Bounds and trust

The version-1 protocol accepts at most 256 KiB of serialized input, declared engine/input kinds, at most four distinct compatible methods and bounded registered parameters. Existing input contracts cap graphs/arrays and small matrices. Engine operation limits remain at most 50,000; numeric iteration limits remain separately bounded. Result transfer is limited to 8 MiB, and the client terminates a run at 30 seconds wall-clock time. Oversized traces fail explicitly instead of being truncated into an apparent complete result.

The application-owned worker validates requests, runs the trusted engine registry, validates every trace state and checks the result's input/seed/engine/parameter identity. The client rechecks transfer size, protocol and engine version, run count and request identity. It does not parse thousands of numeric trace states a second time on the UI thread. No model-provided code is executed. A version mismatch, stale ID, failed transfer or invalid result activates no run.

## Measured baseline

`npx tsx scripts/benchmark-worker.ts` profiles 256 deterministic values with natural mergesort, seed `20261027`, operation limit 50,000 and 219 trace steps. The checked-in [raw timing report](performance-worker-results.json) contains five direct and five worker samples on Node 24.14.0:

| Measure | Direct median | Worker median |
| --- | ---: | ---: |
| Initial zero-delay event-loop timer | 14.74 ms | 1.72 ms |
| Maximum 2 ms heartbeat gap during the sample | 14.80 ms | 6.95 ms |
| End-to-end elapsed time | 14.69 ms | 189.28 ms |

The coldest direct sample delayed a timer by 36.61 ms. The worker is deliberately **not** presented as faster overall: this Node harness includes a new worker plus TSX-loader startup per run. Its advantage is keeping event-loop time available while computing. Browser timings depend on the browser, device, source size and bundled worker startup; these Node observations do not substitute for a browser interaction check. The root milestone report records the actual browser integration verification separately.

## Repeatable checks

`npx tsx --test tests/worker-execution.test.ts` passes seven tests, including execution of the actual generated browser ESM asset. A real `worker_threads` harness runs the same protocol/engine execution function and compares complete graph, array and numeric comparison results against direct execution. Other checks exercise termination, a newer run after cancellation, different per-method parameters, stale response IDs, version/transfer limits, timeout and unavailable-worker behavior. Timing results are observations, not brittle CI pass thresholds.

## Final browser measurement

The native T3 Chromium browser exercised the actual compiled production worker on the same deterministic 256-value input (seed 20261027, natural-mergesort, 50,000-operation limit). Across three alternating direct/worker runs, a pending zero-delay timer was delayed 24.2/18.9/15.8 ms by direct execution, versus 1.1/0.8/1.0 ms with the worker. Median delays were 18.9 ms and 1.0 ms; semantic results were identical. The benchmark imported only the trusted execution code through a temporary local module server, which was stopped afterward.

A separate complete React-view check updated the shared snapshot and completed the larger computation without errors. An 8 ms heartbeat observed 214 ticks over 1.8 seconds, with a largest gap of 58.6 ms. Background simulation avoids its synchronous computation stall; result transfer, validation and rendering still cost time. This does not establish a universal 60fps guarantee or reproduce a research paper's hardware timings. Recorded values: [browser-worker-profile.json](browser-worker-profile.json).
