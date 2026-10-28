# Shared local execution scheduling

PP-109 introduces one tab-local scheduler for trusted engine/widget/numerical/discrete/molecular workers and isolated artifact compilation/runtime workers. It does not install execution authority, change data/scientific admission, or authorize a provider request. An accepted server job remains separate from local CPU execution.

## Admission and cancellation

The default policy admits at most two active jobs, sixteen queued jobs, 160 MiB of logical active memory reservations, 16 MiB of active result reservations and 16 MiB of queued input. Trusted workers reserve 64 MiB; artifact workers reserve 68 MiB. Queue admission has a separate deadline, at most thirty seconds; existing tighter adapter execution watchdogs and result validators remain active. Queued tasks create no worker. Oversized requests fail before execution, and results are checked by actual UTF-8 byte length before delivery.

Reservations are accounting policy, not a measured or enforced cap on the browser process heap. QuickJS retains its own guest allocator/stack/operation limits; that guest limit is not a full host-worker memory bound. Result reservations concern in-flight delivery, not every frame retained by React, browser storage or other tabs. Finite input/domain/operation/output limits, worker count and termination remain the hard application controls.

A host-owned stop action cancels active local workers and queued requests. Batch cancellation must not start a waiting worker while stopping its neighbors. Per-owner supersession and visibility are available to explicit adapter hosts; automatic document visibility stops active local work and prevents hidden admission. Returning to the page does not create inference, an upload or a replacement remote job. Existing queued, already-requested local work can resume on visibility; a cancelled computation needs an explicit recomputation.

Workers terminate on stop, failure or deadline, and late callbacks cannot restore a cancelled result or compiler receipt. Local source text, notes and the last valid supported-view result remain separate from scheduling. Legacy same-input recomputation retains its last completed trace on cancellation; a changed-input trace is never silently shown as the new result. Unavailable browser adapters do not start blocking main-thread execution. Existing explicit trusted Node execution paths are distinct server utilities, not browser fallbacks.

## Reproducibility

The scheduler records scheduling counts and bounded task identities. Exact input, seed, algorithm/solver/PRNG/runtime versions and result provenance stay with the adapter's checked request/result and existing experiment snapshots. Scheduler handles, callbacks and compiler/scientific capabilities are not portable data.

- Deterministic finite sorting/discrete transforms repeat within their recorded implementation and input domain; this is not a cross-platform bitwise theorem.
- Seeded stochastic simulations and generated SDK streams require their exact seed, sequence/random policy and runtime. Reusing a seed does not create an independent replication. Transcendental arithmetic can still differ across environments.
- Adaptive/floating-point numerical outputs require recorded environment and numerical tolerances. A cached exact output can be replayed as recorded data; fresh recomputation is not a hardware-independence guarantee.

Scientific reports remain governed by their own source/input/output/checker binding. Neither admission nor deterministic replay grants experimental validity.

## External jobs

The broker client has no autonomous polling loop. Prepare/start requires its existing explicit reviewed action and consent; status/list/collect/cancel are explicit bounded requests. Backgrounding or stopping local CPU tasks does not cancel, duplicate or replace an accepted/uncertain server job. The local scheduler never wraps remote creation in a retry callback. Infrastructure bootstrap verification retains its independent bounded download/hash path before a compiler/runtime worker requests CPU admission.

## Verification

`/execution-lab` runs an explicit authored workload through real engine, ODE, discrete, SSA, compiler and QuickJS workers. Its report records browser/environment, observed active/queue/reservation peaks, result bytes, a main-thread heartbeat and replay comparisons. Timeout and allocation-failure probes are labeled fault simulations; they do not exhaust browser memory. The local notes field remains editable during the workload and after stop. This fixture never requests Meta inference or retrieves a paper.

Deterministic scheduler tests cover queue/resource limits, fairness, cancellation, visibility, supersession and cleanup; generated bridge tests retain private compiler receipts and allocator limits. Native observations are engineering evidence, not human-reader study results or responsiveness guarantees for other devices. Actual measurements and known limits are recorded in the corresponding `data/execution-*` artifacts.

The recorded Chromium workload completed nine tasks through ten actual disposable workers in 486.8 ms, with at most two workers active and seven queued. Logical memory reservations peaked at 138,412,032 bytes; in-flight result reservations reached 16 MiB. Thirty heartbeat samples had a maximum observed gap of 30.7 ms at a nominal 16 ms interval. All four recorded same-input replay pairs matched their semantic hashes. See `data/execution-native-stress.json` for exact environment and outcomes. These are observations, not device-independent thresholds.

Separate labeled native-browser fault injections held two worker stand-ins with seven queued requests. Notes stayed editable, global stop terminated both and created no queued worker, and the previous completed report remained visible. A controlled document-visibility event aborted active local work, paused the queue, and resumed only already-requested local jobs on return. Stop then cleared those jobs. Native visibility and Worker implementations were restored. This verifies application recovery behavior rather than measuring real process OOM or OS background scheduling.
