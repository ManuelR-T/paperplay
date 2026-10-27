# Versioned application contracts

`schema.ts` separates source material, generated figure descriptions, trusted engine capabilities, computed traces and persisted experiment state. No schema executes model-generated code.

Use the validation entry points at application boundaries, rather than only calling an individual Zod schema's `parse` method:

- `validateDocument(input)` validates original source blocks and anchors, including unique IDs, section references, page counts and normalized quote provenance.
- `validateFigure(input, source, trustedRegistry)` validates source references and graph data, then checks engine/version/renderer compatibility, parameter bounds and comparison groups/units. Illustrative figures cannot expose computed parameter controls.
- `validateTrace(input, trustedRegistry)` validates engine identity, input/state consistency, references, contiguous step indexes, monotonic operation counts and declared metric units.
- `validateSnapshot(input, source, trustedRegistry)` validates the persisted envelope and checks source and engine compatibility through the figure validator.

The contract version is the literal `CONTRACT_VERSION = 1`. Engine versions are independent semantic-version identifiers. Unknown fields and versions are rejected rather than silently stripped. The MVP contract supports graphs, numeric arrays, conceptual steps and compatible method comparisons; adding a new renderer requires an explicit contract change. Graph node roles, such as a selected start and target, reference nodes in the same input and do not change the generic figure envelope.

Generated figures contain no fidelity/verification field. `fidelityEvidenceSchema` is a separate application-side evidence-record shape. Parsing an evidence record does **not** establish its scientific truth or authorize an elevated fidelity label. The trusted policy in `lib/fidelity.ts` and reference-case checks are responsible for that decision; original experiment reproduction remains separately gated. Source quote matching establishes provenance only.

`fixtures.ts` contains synthetic structural examples for two families. The names `fixture.graph` and `fixture.array` describe test capabilities, not implemented execution engines or real research-paper reproductions. Trace invariants detect malformed playback data; they do not prove that a sorting or graph algorithm is correct. M1 must supply independent algorithm reference cases.

The small numeric-control contract deliberately has finite, explicit bounds and values. Graph/array datasets are bounded before rendering; unknown execution bindings cannot be activated. Source URLs allow only HTTP(S), and source text/math still needs safe rendering by the UI. A valid URL is not an unrestricted server-fetch permission.

Run the provider-free checks with:

```sh
npx tsx --test tests/contracts.test.ts
```

Generic graph inputs can represent negative weights and array inputs can be empty. These are structural contracts: each implemented engine must separately enforce its mathematical preconditions (for example, nonnegative weights for Dijkstra) rather than impose one algorithm’s constraints on every figure.

M1 implementations live in `lib/engines/`; optional graph distances/frontier and array original-identity/run/merge-range fields extend version 1 without invalidating M0 structural fixtures. See `docs/engines.md` for precise engine assumptions and counting conventions.
