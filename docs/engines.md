# M1 execution engines

These TypeScript engines run in the browser, use deterministic inputs and produce bounded traces. They do not call Meta, execute generated code, or reproduce hardware timing results. Synthetic inputs are not the papers’ experimental datasets.

## Public interface

Import from `lib/engines/index.ts`:

- `engineRegistry`: trusted `EngineCapability[]`, including IDs, versions, parameter bounds, compatible comparison groups and metric definitions.
- `engineMetadata`: display names, source-method scope, limitations and reference-case IDs. This is application-owned evidence metadata, not a scientific proof or model claim.
- `createDefaultInput('graph' | 'array', seed = 42)`: deterministic synthetic inputs.
- `runEngine(id, input, { seed?, parameters?, operationLimit?, signal? })`: returns `{ engineId, name, trace, result, summary }` and does not mutate the caller’s input.
- `runComparison(ids, input, options)`: runs two to four distinct compatible engines on the same input and seed, returning `{ runs, commonMetrics }`. Incomplete runs are rejected rather than presented as completed benchmarks.
- `nodePower(startA, endA, startB, endB, n)`: independently testable half-open interval translation of the Powersort node-power rule.

The registry IDs are `dijkstra-heap`, `dijkstra-scan`, `powersort`, and `natural-mergesort`, all version `1.0.0`. Their common numeric parameter is `operationLimit` (1–50,000, default 10,000). Unknown parameters, malformed input, unsupported engine IDs and incompatible comparison groups fail explicitly.

## Graph methods

Both graph engines compute all reachable shortest distances with a specified `nodeRoles.start` and nonnegative weights. They support directed and undirected inputs. Unreachable distances are `null` in JSON and should be displayed as infinity/unreachable, never as a computed finite value.

The heap variant uses a binary min-heap with stale-entry removal. The baseline scans unsettled vertices linearly. Ties are resolved in input node order. Both count selection-comparator calls, attempted edge relaxations and settled vertices. These counts define the displayed metrics; they are not timing or an assumed cross-implementation speedup.

These engines illustrate the shortest-distance application in Lammich/Nipkow, not the paper’s functional priority-search-tree data structure or Isabelle verification. They therefore remain simplified relative to that paper. [Publisher source](https://doi.org/10.4230/LIPIcs.ITP.2019.23).

## Adaptive stable sorting

Powersort implements the scheduling mechanism of Munro/Wild Algorithm 2: natural-run discovery, stable reversal of strictly descending runs, node powers from adjacent-run midpoints, the increasing-power pending-run stack and final adjacent merges. This is a zero-based, half-open interval translation with an ordinary stable merge buffer. The baseline discovers identical runs but merges them left to right. The minimal-run/insertion-sort cutoff and Java performance optimizations from the runtime study are omitted. [Paper, Algorithm 2 and §2.2](https://arxiv.org/html/1805.04154v1), [publisher edition](https://doi.org/10.4230/LIPIcs.ESA.2018.63).

Equal keys retain original-index identity. Metrics are key comparisons during run discovery and merging, merge cost (the sum of merged lengths) and completed merge count. Reversal moves contribute to the operation budget but not the paper’s merge-cost metric.

Reference tests cover the paper figure’s run-midpoint powers `3,2,1,2,4` for lengths `5,3,3,14,1,2`; a nontrivial merge-order case with lengths `3,2,5,2`; and independent recursive Cartesian-tree scheduling across generated cases. Sorted output, permutation preservation and stability are separately checked against a decorated-key reference oracle. These establish the checked mechanism scope, not an original experiment reproduction.

## Trace safety and cancellation

An accepted input is structurally bounded by the shared contracts. Engines additionally enforce mathematical preconditions. Each run checks its budget and optional signal during work, and records `completed`, `cancelled` or `limit-reached`. Traces cap at 9,000 recorded states. Results from an interrupted run are partial and must not receive a completed/reproduction label.

Execution is synchronous and bounded; an already-aborted signal is observed, but browser UI events cannot interrupt a synchronous run until the event loop regains control. A Web Worker bridge for larger workloads remains PP-042. The current input limits and budgets are intended for small teaching examples.

Array trace extensions (`originalIndices`, `mergeRange`, `runs`) and graph extensions (`distances`, `frontierNodeIds`) are optional and backwards compatible with M0 structural fixtures. All produced traces pass the shared validator.

## Verification

```sh
npx tsx --test tests/engines.test.ts
```

Independent checks include Bellman–Ford distances over changing graph topology/weights, settled-distance monotonicity, zero/tie/disconnected/singleton cases, negative-weight rejection, stable reference sorting, exact merge order, cancellation/limits, parameter bounds and identical comparison inputs. No paid API calls are needed.
