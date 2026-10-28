# PP-104: reviewed discrete algorithms and growing structures

Research/proposal, 2026-10-28, for [PP-104 / #59](https://github.com/ManuelR-T/paperplay/issues/59). The ledger requires **two algorithms beyond existing presets**, editable variable-length inputs, source/pseudocode-linked intermediate structures, declared operations/termination, independent reference/property checks, bounded recovery, and conceptual fallback. This note changes no executable code or fixtures. No frozen held-out paper was used.

## Recommended first two algorithms

Implement two named, trusted algorithms rather than a general collection bytecode or imported-condition interpreter:

| Algorithm | Editable input and visible structures | What it adds |
| --- | --- | --- |
| `kahn-topological` | A bounded directed graph; ready FIFO queue, output ordering, residual indegrees and processed-edge flags. | A graph algorithm with conditional queue insertion and an explicit cycle outcome, distinct from the current shortest-path engines. |
| `union-find-size-compression` | Initially empty or declared singleton elements, followed by bounded `make(id)`, `union(a,b)` and `find(a)` commands; parent forest, root sizes, component count and query answers. | Actual collection growth, maps, pointer changes and conditional merging. Elements retain identity when their representative or parent changes. |

A. B. Kahn's 1962 paper is the historical source for topological sorting of large networks; the publisher provides the citation/abstract, but its PDF endpoint returned 403 during this research. Do not claim inspection of that full article. [ACM publisher record](https://doi.org/10.1145/368996.369025)

The first-party Princeton `TopologicalX` reference explicitly describes a nonrecursive queue-based algorithm and implements residual-indegree removal; it states `O(V+E)` time and `O(V)` extra space excluding the graph. Use its algorithm description as a reference, not copied source. [Sedgewick and Wayne, official author repository](https://raw.githubusercontent.com/kevin-wayne/algs4/master/src/main/java/edu/princeton/cs/algs4/TopologicalX.java)

Cornell's course material defines make/find/union, a parent-forest representation and full path compression. Name the chosen balancing variant exactly: the recommendation here is **union by component size plus full path compression**, with deterministic creation-order tie breaking. Rank balancing and path halving are distinct variants and must not be labeled as this implementation. [Cornell ORIE union-find notes](https://people.orie.cornell.edu/prs233/orie-6125/data-structures/union-find.html), [Princeton's union-by-size study material](https://www.cs.princeton.edu/courses/archive/fall18/cos226/lectures/study/15UnionFind.html)

Tarjan's foundational analysis concerns set-union algorithms and their amortized bounds. A small instrumented teaching trace does not prove that theorem or constitute a benchmark of the original implementation. [Cornell's author-report record](https://hdl.handle.net/1813/5942)

Keep unsupported features explicit: no arbitrary graph algorithm, agent language, user-defined loop/condition, string expression, deletion from union-find, rollback connectivity, concurrency protocol or automatic source-code extraction. A different paper can still use a conceptual guide or the separately admitted generated-artifact path.

## Concrete semantics and edge cases

For Kahn, initially enqueue zero-indegree vertices in declared node order; append newly ready vertices in declared outgoing-edge order. Use an array with a head index or another bounded FIFO, avoiding an uncounted linear-time `shift()` implementation under an advertised linear-time algorithm. Empty graphs and isolated vertices are meaningful cases. Require directed edges and known endpoints. A first simple-graph version can reject duplicate ordered edge pairs while accepting a self-loop as a detectable cycle.

Emit events for initialization, enqueue, dequeue/output, edge processing, indegree change, newly-ready tests and termination. A completed DAG returns every vertex once and puts every edge's source before its target. Ready-order ties need not match every other implementation: Python documents insertion-order-sensitive valid topological orders and distinguishes cycle detection from processing tasks that are still unblocked. [Python `graphlib` documentation](https://docs.python.org/3/library/graphlib.html)

When the queue is exhausted with vertices remaining, report a cycle outcome only after all current edge processing has finished. The residual set can include vertices **downstream of a cycle**, not only cycle members. Label it “blocked remainder” unless a separately checked cycle witness is available. A budget-limited run with an empty queue during a partially processed vertex must not be reported as a detected cycle.

For union-find, reject repeated `make` IDs and references to elements not yet created. A successful make adds exactly one singleton. Union links roots according to size and decrements the component count only when the roots differ. Find follows parents to a root and may rewrite the traversed path; it must preserve membership and component count. A redundant union can still contain compression events from its preceding finds, so “no new merge” does not necessarily mean “no parent changes.” Use iterative traversal with an independent visit bound rather than unconstrained recursion.

A root is an algorithm-dependent representative, not the permanent identity of a component or element. Princeton's first-party UF API explicitly distinguishes element identity from set representative and describes a rank/halving implementation; that is useful semantic comparison, not the chosen size/full-compression source to port. [Official UF documentation/source](https://raw.githubusercontent.com/kevin-wayne/algs4/master/src/main/java/edu/princeton/cs/algs4/UF.java)

## Trace contract and source mapping

A minimal typed result should contain the exact request and algorithm/version/tie policy, execution status, algorithm outcome, completed-command count, an optional active command, cumulative metrics, immutable frames, and finite diagnostics. Each frame needs a contiguous step index, event kind, relevant element/edge/command IDs, declared pseudocode-line IDs, cumulative counters and a validated algorithm-specific collection state.

Use application-owned event kinds and pseudocode-line identities, such as `ready-test`, `remove-edge`, `find-root`, `compress-parent` and `link-roots`. The displayed prose may explain a branch but must not itself execute a condition. Source-anchor IDs must refer to the exact current paper/source version and validated quotes. A mapping to **authored explanatory pseudocode** is not a claim that the text is the paper's exact algorithm or that the engine reproduces its experiments.

Record valid state transitions atomically. Charge/check the operation and trace budgets before publishing a mutation. An interrupted command may retain valid microsteps, but must remain visibly unfinished and must not publish an invented query answer. A practical recorder can stage a bounded next state, validate its references/invariants and available output room, then append and commit it. A frame-cap exception after mutating the only state would otherwise lose the last reproducible prefix.

Keep graph input edges available as original entities with active/processed flags; their removal from the residual algorithm does not erase the source graph. Maps should serialize as bounded unique-key entry arrays or another explicit safe format. Internal `Map` objects or null-prototype dictionaries avoid interpreting IDs as inherited JavaScript properties. No object from an imported manifest can install an executable adapter.

Operation metrics are a declared model, not milliseconds or CPU instructions. Useful disjoint counters include queue enqueues/dequeues, edge initialization reads, edge removals, indegree writes, parent reads/writes, size comparisons and successful merges. Define exactly which primitive increments the total operation budget, including unsuccessful branch tests. Kahn inspects edges during initialization and removal; combining both passes and then asserting “edge visits equal E” would be incorrect. Trace copying, validation, layout and serialization need independent byte/time/work limits even if they are not charged as algorithm operations.

## Independent references and properties

Expected values must come from an independent checker or authored mathematical result, not another call to the production routine or its parent/indegree helper.

| Case | Independent oracle and required assertions |
| --- | --- |
| DAG ordering | Verify a permutation of all input IDs and `rank(u)<rank(v)` for every edge. For a tiny graph, enumerate all permutations and filter by edge constraints; compare membership in that valid set rather than a single arbitrary ordering. |
| Cycle outcome | For tiny graphs use permutation exhaustion or an independently authored DFS color checker. Include a self-loop, a two-node cycle, an isolated vertex and an outgoing tail from the cycle; the tail is blocked but is not itself a cycle member. |
| Kahn intermediate states | Recompute residual indegrees by counting the explicitly unprocessed input edges. Queue IDs must be unique, unprocessed and eligible; each edge is processed at most once. Distinguish a vertex currently being expanded from an expansion that has completed. |
| Union-find membership | For each completed command prefix, construct an undirected graph with every created element and the union edges so far. Independently enumerate connected components with a simple BFS and compare unordered member sets. This differs structurally from parent-pointer union-find. |
| Compression | A find must preserve the partition, root identity within the current component, component count and root sizes. After full compression, every traversed nonroot points directly to that root. Nonroot stored sizes are not authoritative component sizes. |
| Growth and redundant operations | Empty structure, singleton make, union of two singletons, repeated same-component union, find on a deep permitted forest, multiple disconnected sets, duplicate labels with distinct IDs, and unknown-element references. Only make grows the universe; only successful merges reduce component count. |
| Budget/termination | Tiny operation, frame, byte and entity caps must stop with a valid prefix; cancellation during a long inner traversal must not report a completed command. Output/request mismatch, malformed references and stale worker replies must be rejected. |

For an optional external development comparison, NetworkX documents a BFS-based connected-components implementation, and Python provides `TopologicalSorter`. Their APIs can inspire or verify separately generated development references without adding them to the browser or making routine CI depend on Python packages. [NetworkX connected-components documentation](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.components.connected_components.html)

Use authored small graphs and command sequences. Exhaustive enumeration of all simple directed graphs on three vertices is a feasible tiny-case check; call it tiny-case exhaustiveness, not coverage of arbitrary graphs. Deterministic larger property inputs can be generated from fixed seeds independently of the engine. Prefer invariant checks over brittle snapshots of every cosmetic description. Compare exact representative IDs only where the declared deterministic tie rule requires them.

## Stable identities and linked selection

Use explicit element IDs rather than queue positions, array indices, current roots or labels. A selected node should remain selected when it moves between queue/output/graph views. A selected union-find element should survive rerooting and compression; its component representative is displayed as a changing value. Two equal labels remain different entities.

Creation events introduce a new identity exactly once. Rewinding to before creation must clear or explicitly mark the element unavailable. Parent-edge relations have their own current existence: a compressed-away edge cannot remain silently selected. Input edits that remove an element or change topology require navigation rebinding; scrubbing between frames with the same entity set should not reset every surviving selection.

The existing `createSemanticSelectionStore` supports channel-scoped selection, validation, revisions and bounded undo. `shared/figure-selection.ts` supplies a useful structural precedent: revisions depend on the artifact plus currently available semantic IDs. A discrete trace needs its own exact current-frame validity rule, not a permissive “ID exists somewhere in the complete trace” check. Store source/pseudocode selection separately from the current collection position.

## Reuse the current architecture without pretending it already executes this

`lib/engines/index.ts` already registers heap/scan Dijkstra, Powersort/natural mergesort and two SPD optimization recurrences. Its recorder charges selected operations and snapshots typed states; array sorting retains original indices to distinguish equal keys and stages merges in a temporary buffer. Reuse those design patterns and existing graph/array presentation where the contracts really match.

The legacy `AlgorithmInput`, trace-state and engine-result unions in `shared/schema.ts` are graph/array/matrix-specific. Their strict graph state lacks residual indegrees/output lists, and their array identities refer to original input positions rather than newly created elements. Adding a new engine ID alone does not provide a growing parent forest or a generic collection trace.

A sibling `discrete-trace` representation capability with a typed two-model request/result is a practical seam. It can reuse registry admission, source-anchor validation, worker lifecycle and selection infrastructure while preserving old engine formats. This need not become a general event DSL or replacement for every existing trace. Bind output to the exact input order, command sequence, model/version, tie rule, trace policy and resource limits; input order affects deterministic ready-queue ties.

`shared/process-networks.ts`, `lib/representations/process-guide.ts` and `shared/composed-scene.ts` currently describe **authored walkthroughs**. Process steps activate existing entities/relationships; scene frames update existing mark IDs. They do not execute Kahn/union-find or create arbitrary new nodes during a frame. Reuse layout/annotations and the source-linked conceptual fallback, keeping computed trace events distinct from authored steps. Their bounds (including 24 walkthrough frames and 256 expanded scene marks) are not automatically the new trace's bounds.

Reviewed trusted algorithms should run through an application-owned disposable worker, following the existing numerical/field clients. Browser cancellation must terminate CPU work, not just stop animation; synchronous `AbortSignal` polling on the main thread cannot observe a click while blocking it. The isolated generated-artifact route remains separate: it still requires its own exact manifest, capability/asset checks and nonpersistable compilation receipt. A readable pseudocode guide remains available when the requested algorithm has no admitted executable implementation.

## Initial resource policy and evidence boundary

Proposed initial ceilings: 64 elements/vertices, 128 graph edges, 256 commands, 20,000 charged operations, 512 trace events, 16,384 retained collection/reference cells across snapshots, a 256 KiB request, a 3 MiB result and a disposable-worker wall deadline at most 30 seconds. These are application-policy proposals requiring measurement, not claims that every combination completes. Check product/byte limits before growing collections or retaining frames. Initialization, validation, state copies and serialization must remain bounded too.

Full immutable snapshots are adequate for this small slice when their total retained-size budget is enforced. Do not quietly drop frames and still claim a complete source-step trace. A later checkpoint/delta format would need separate versioned replay validation and does not have to be invented now. Operation exhaustion, output exhaustion, cancellation, unsupported instructions and invalid references retain the last valid prefix and source guide; they never start replacement paid work.

Source rights and code rights stay separate. The inspected Princeton Java files identify GPL-3.0-or-later licensing in their headers; do not mechanically port/copy them into ISC project code without an explicit license decision. Cite the mathematical algorithms and write project-owned implementations, explanations and tests. [Official repository license](https://raw.githubusercontent.com/kevin-wayne/algs4/master/LICENSE). Link papers and retain only short necessary verified anchors or authored explanations; neither free access nor a citation licenses bundling an entire article. No original paper, third-party implementation or dataset is added by this research.

Passing these reference and invariant cases supports the named finite teaching implementations and their trace mechanics. It does not verify an arbitrary paper's pseudocode, prove a complexity theorem, reproduce original benchmarks or make the generated-widget system a universal algorithm engine.
