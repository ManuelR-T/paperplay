# Bounded discrete algorithms and changing collections (PP-104)

The `discrete-collections@1.0.0` approved capability adds a `discrete-trace` representation, alongside the unchanged legacy graph/sort/optimization engines. Its two named application-owned algorithms are FIFO Kahn topological ordering and union by size with full path compression. Requests choose typed graphs or a finite make/union/find command sequence; they cannot install conditions, loops, imported algorithm code or a new engine. The separately isolated generated-artifact path retains its own admission requirements.

The implementation and explanatory pseudocode are project-owned. [Primary research and dependency evaluation](discrete-adapter-research.md) distinguish algorithm descriptions from third-party code rights: the inspected Princeton reference code is GPL and was not copied or ported. The example cards are explicitly authored educational material, link their references and make no original-paper quotation, experiment, timing or complexity-proof claim.

## Semantics and intermediate states

Kahn starts with declared-order zero-indegree vertices in a FIFO. Newly ready vertices follow declared outgoing-edge order. Frames expose the original graph, queue, output, residual indegrees, current expansion and processed-edge IDs. Self-loops are accepted as possible cycles; duplicate ordered edges and missing endpoints are rejected. A completed ordering respects every edge. An exhausted queue with unreturned vertices reports a **blocked remainder**: downstream vertices can be blocked without belonging to a cycle. A resource stop during an expansion never becomes a cycle outcome.

Union-find starts empty. A `make` introduces a unique stable element ID; a `union` joins the smaller root below the larger, with earlier creation winning an equal-size tie; `find` follows parents iteratively and fully compresses its traversed nonroots. Only root sizes are authoritative. Frames expose the exact parent map, root sizes, component count, active/completed commands and historical find answers. A historical answer retains the representative at its query time; later unions can change that representative. Duplicate labels remain separate elements. Deletion, rollback, arbitrary agents and concurrent operations are outside this adapter.

Each immutable frame carries its contiguous step, event, declared pseudocode IDs, relevant source entity IDs, collection state and cumulative counters. Source-anchor references bind the explanatory layer to its exact source version. Explanatory prose does not execute a conditional branch. The UI keeps the authored pseudocode, source and inputs readable even if execution is unavailable.

## Resource and operation model

Requests are at most 256 KiB: 64 elements/vertices, 128 directed graph edges or 256 commands. Limits independently cap 20,000 declared primitive operations, 512 retained frames, 16,384 retained scalar/reference cells and 3 MiB of UTF-8 result bytes. The recorder reserves 4 KiB for result framing/diagnostics and counts request/frame bytes with a TextEncoder. Readers may request smaller limits. Frame count and retained-cell limits can stop otherwise valid inputs; the application does not discard frames and call the result a complete trace.

A frame stages its next state and counter deltas, checks budgets, and only then commits the mutation and snapshot together. Stops retain the exact last valid prefix. A command with retained microsteps is still unfinished until its completion event. No new merge or query answer is fabricated to fill an interrupted trace.

The operation counter sums named charges: edge initialization reads, edge removals, queue pushes/pops, parent reads/writes, root-size comparisons, successful merges, singleton makes and modeled condition tests. Parent reads charge a root test; root equality and initial/newly-ready predicates are explicitly charged. These are declared teaching primitives, not a CPU instruction count. Loop administration, state copies, validation, rendering and serialization have separate finite input/output/time bounds. In particular, snapshot/FIFO copying means this trace host is not a measured linear-time implementation or a demonstration of amortized complexity.

Browser computation uses a disposable application-owned worker, at most two concurrent jobs, a three-second default algorithm deadline and a 30-second host ceiling. Cancellation/timeout/stale or malformed replies terminate the worker. Missing browser-worker support fails visibly without a main-thread fallback. The host revalidates the exact request, event-specific counter deltas, atomic collection transitions, partition/answer meaning, source identities and termination after transfer; received JSON grants no scientific verification.

## Linked interaction and recovery

Frame inspection uses the existing semantic-navigation contract: scope `discrete`, authored-step mode, null frame ID, unit `frame` and the retained frame index. Entity IDs refer to original graph nodes/edges or currently created union-find elements, not queue positions or current roots. Changing frames replaces time and entity channels atomically. Rewinding before an element's make removes that selection; changing a representative preserves the element ID. Coherent undo can restore an earlier frame and its valid selection together.

Saved navigation is validated against the actual admitted trace before presentation, in addition to the request-level syntax checks. A future element at an earlier frame or a step beyond a retained prefix cannot silently replay. Graph edge identities remain inspectable after processing. Local edits cancel obsolete work and rebind input revisions; a failed edit/run preserves the previous valid trace with its original request and a visible retained-result label.

Editable node/edge lists and make/union/find commands, keyboard previous/next/range playback, exact structure tables, pseudocode highlighting, operation metrics and trace downloads are available locally. A portable data study additionally retains source, exact request and navigation, and reopens through **Files & source → Open figure or study**. No local playback, edit, cancellation or import starts inference.

## Verification

Independent checks enumerate all 512 directed graphs on three vertices, including self-loops, against a permutation-order oracle. A separate BFS connectivity oracle checks union-find command prefixes; constructed deep forests test full compression and creation-order ties. Exhaustive operation/frame cuts of bounded examples check atomic prefixes. Forged-output regressions cover invented merges/find roots, zeroed operation charges, missing completed-query answers and an acyclic graph falsely reported as blocked.

Additional integration tests cover generic registry execution, exact-input substitution, portable studies, source anchors, current-frame selection/undo, worker protocol and cleanup, Unicode byte retention, preconditions and resource recovery. These are finite implementation checks, not a theorem about arbitrary graph sizes, paper pseudocode or scientific fidelity. The recorded full-suite and native-browser evidence is in [discrete-browser.json](../data/discrete-browser.json). Paid inference, the held-out scientific corpus, human evaluation and release provisioning remain separate.
