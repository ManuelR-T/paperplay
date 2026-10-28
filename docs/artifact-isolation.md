# Generated-code isolation decision and measurements (PP-094)

Decision: continue with **generated JavaScript interpreted as data by a capped QuickJS/WASM guest inside a terminable dedicated Worker**, returning bounded SDK JSON to a trusted renderer. Keep product execution disabled until isolated compilation and the production bridge pass PP-095–096. Arbitrary native browser/Node execution and arbitrary packages are outside the selected scope.

This is a measured, narrow execution architecture, not a claim that an iframe, Worker, ordinary container or this spike alone is a complete sandbox. [Primary-source comparison](generated-artifact-research.md), [captured Chromium report](../data/artifact-isolation-browser.json) and [captured disposable-container report](../data/artifact-isolation-container.json) record the evidence and limits.

## Boundaries and alternatives

| Candidate | Decision and evidence |
| --- | --- |
| Separate-origin native iframe | Not selected for arbitrary generated code. Origin/sandbox flags restrict DOM authority, but there is no portable per-frame CPU/heap limit. CSP inheritance and navigation/network paths need separate treatment. No claim of hostile-loop interruption in a native iframe is made. |
| Dedicated Worker alone | Not an authority boundary: native worker APIs remain available and no portable configurable heap cap exists. Used only to host trusted interpreter code and provide an independent owner-thread watchdog. |
| Restricted QuickJS/WASM guest | Selected for bounded synchronous SDK programs. No host functions, DOM objects, module loader, network, timers, storage or inference are exposed. Promises, Date and Proxy intrinsics are omitted. Constructor-created JavaScript remains inside the guest and cannot reach host APIs. |
| Disposable server container | Actual comparison used an existing exact image ID, unprivileged user, no network, read-only root, no capabilities, no new privileges, PID/CPU/memory limits and a single read-only probe file. CPU watchdog and kernel OOM limits worked. Ordinary Docker still shares a kernel and gVisor was unavailable; no server native-code execution is approved. |

The local browser harness runs at `127.0.0.1:3002`, separate from the application origin `localhost:3001`. Guest source is never executed by browser JavaScript. The Worker bootstrap, SDK validation and command renderer are trusted code; artifact input/state are serialized copies. Attribution, stop and report controls stay outside guest output. Source/notes/tokens and cookie/storage fixtures remain in the host unless explicitly supplied as approved data. The guest has no primitive that reads them.

## Resource and network policy

The selected published interpreter **does accept a supplied `WebAssembly.Memory`**. The reference adapter uses an initial 16 MiB and a maximum 64 MiB. An independent test verifies that the module uses that same memory object and that growth beyond its maximum throws. The guest allocator and stack are additionally limited by the artifact policy (maximum 32 MiB heap, 512 KiB stack); evaluation/serialization has an interrupt deadline. The owner can terminate the Worker independently of guest cooperation.

These are WASM/guest limits, **not a hard cap on total browser-process memory**. Wrapper JS, parsed messages, rendered SVG and baseline interpreter code have separate budgets; production bridge/input/render limits are still required. No expensive host callbacks are registered. Generated getters and JSON hooks serialize inside the guest limits before host JSON parsing/validation. Async jobs, arbitrary host imports, DOM/CSS/HTML, guest WebGL/WebGPU and packages/native binaries are unsupported.

The harness Worker response enforces `default-src 'none'`, a narrow script policy with `wasm-unsafe-eval`, `connect-src 'none'` and `worker-src 'none'`. The trusted host serves only known scripts/fixture/case/report endpoints. Embedded interpreter WASM removes a runtime WASM fetch. Guest code cannot invoke browser fetch/socket/image/form/navigation/download/worker APIs in the first place. Returned unknown HTML/URL opcodes fail SDK validation before rendering.

## Actual browser results

Native Chromium 154 on Linux executed **33 distinct cases**. All ready/blocked expectations matched in the captured final run. Cases cover ambient authority and fixture-secret names, constructor access, numerical work, malformed syntax, external module loading, loops, recursion, object/typed-array/string allocations, pathological regular expressions, getters/toJSON, malformed/oversized output, promises, fetch/socket/beacon, parent DOM, cookies/storage, navigation/downloads, shared/service/nested workers, script/image/stylesheet loads, message floods, popup/navigation attempts and guest prototype pollution.

- The healthy numerical workload returned **332,833,500** and a generated dynamic-sequence frame rendered two trusted SVG marks.
- A cancelled hostile loop returned in **150 ms**; an independent watchdog killed one in **140 ms**. In a two-instance test a healthy sequence completed while the hostile instance was killed, with distinct instance IDs.
- The host heartbeat advanced **60 times** during the suite; no active workers remained. The host prototype was not polluted, host storage stayed intact and no exfiltration endpoint was requested. The separate Stop button also cancelled a running guest and cleared the worker set.
- Cookie/storage fixture values were never delivered to guest inputs. The results establish failure of the tested access paths; they do not prove the absence of every future interpreter/browser vulnerability.

An initial numerical probe failed because the SDK accidentally reused the drawing-coordinate ±1,000,000 bound for table numbers. The validator now accepts arbitrary finite table numbers while preserving drawing-coordinate limits; a reference test retains this correction. That failed engineering probe was not a scientific computation claim.

Reports retain browser/version, fixture/SDK/case/engine/worker digests, individual outcomes and measured times. Times are local measurements, not SLAs or cross-browser certification. The harness is not a production API and does not expose paid endpoints.

## Actual container comparison

The recorded image is pinned by full SHA-256 ID, with no pull, project directory, secret environment or engine socket mounted. The capability probe ran as UID 65534, could not write the root, did not see the host project/fixture secret, and could not reach the test address. Its own `/etc/passwd` remained readable, illustrating that a container still provides a native system environment.

The CPU workload was supervisor-killed after approximately 2.1 s. The allocation workload was kernel OOM-killed under the 64 MiB container budget. All named test containers were removed. This comparison is useful evidence for a future disposable service, not approval to run native generated code in the application process or ordinary container.

## Reproduce and remaining gates

Run `npx tsx scripts/artifact-isolation-server.ts`, open its printed loopback URL in the native preview, choose **Run isolation probes**, then download the report. The server builds only trusted Worker code into a disposable temporary directory; Ctrl-C closes it and removes that directory. No model calls or real credentials are needed. For the optional container comparison, supply an already installed full image ID to `npx tsx scripts/compare-artifact-container.ts sha256:…`; it never pulls images and removes its own containers.

`npm run check` passes TypeScript, **298 tests** and production build. Production prerequisites remain Worker/WebAssembly support, tested pinned interpreter delivery, appropriate enforced CSP on the Worker response, validated request/instance/rate/size limits, immutable declared data and host-owned stop/fallback. Only the measured Chromium platform is admitted by this spike. Unsupported browsers/platforms and failed checks must retain the inert/source-linked fallback. Isolated compiler reproducibility, production bridge lifecycle, generated tests and scientific evidence remain separate gates; this milestone enables no product execution.
