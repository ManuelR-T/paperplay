# Approved representation capabilities (PP-085)

`lib/representations/registry.ts` resolves exact capability IDs/versions to trusted application handlers. It provides discovery, behavior/data/interaction selection, environment/resource gaps and execution through the existing representation lifecycle. Scientific discipline names do not select an engine.

## Installed adapters

| Adapter | Real behavior | Required facility |
| --- | --- | --- |
| `widget-v2@2.1.0` | Existing ten widget families and bounded custom recurrence, with unchanged engines and inline typed inputs | Trusted computation; injected worker computation in browsers |
| `source-guide@1.0.0` | Quoted source and explanatory steps | None |
| `asset-inspector@1.0.0` | Checked local values and provenance for six asset types | Asset integrity checking |
| `quantity-inspector@1.0.0` | Quantity preflight and explicit unit conversion | None |

Each descriptor records view kinds, roles, behaviors, accepted data, interactions, facilities, permissions, input/output budgets and evidence policy. Views may explicitly pin an approved adapter; old plans retain their defaults. No closest-version or unrelated algorithm fallback occurs. A missing engine leaves a structured gap and the original plan available for export; a source guide is an explicit conceptual alternative.

`createCapabilityRegistry` accepts executable handlers only from trusted application code. A model-supplied descriptor cannot install an adapter. Registry listings are copies; mutation cannot alter installed definitions. Handlers share the plan/build/execute interface, with cancellation propagation and result validation. New scientific engines can implement existing view contracts; a genuinely new rendering kind requires deliberate schema and renderer work.

The registry is not an isolation boundary. No generated-code or network adapters are installed. Runtime duration fields describe adapter budgets; trusted widget workers enforce their own execution policy. The later execution scheduler and generated-code isolation issues must enforce hard shared runtime/memory limits before untrusted execution is enabled. A successful adapter run never grants scientific verification.

## Discovery

`GET /api/representation-capabilities` returns public metadata and the current widget catalog, without handlers, credentials, private source inputs or inference. Optional `behavior`, `data`, `interaction`, `bytes` and `evidence` filters return matching candidates plus unmet capability, environment, resource or evidence requirements. Unknown filters and invalid values are rejected. This is a read-only discovery endpoint, not an execution endpoint.

The existing Muse widget capability response advertises this endpoint while explicitly retaining `paperplay-widget` proposals. Generic representation generation is not yet enabled; later planning issues integrate it without silently widening paid prompts today.

## Verification

On 28 October 2026, `npm run check` passed TypeScript, 249 tests and the production build. Deterministic tests exercise real registered execution, exact versions, missing workers, offline network requirements, input budgets, metadata-only rejection, malformed output, evidence gaps and catalog consistency. Native Chromium checks cover public discovery, source-guide selection, an unavailable ODE capability, reproduction evidence gaps and existing quantity/widget previews at 320 CSS pixels. No paid inference or scientific reproduction was performed.

## PP-100 dynamics extension

`ode-rk4@1.0.0` provides trusted, bounded registered differential models and a one-shot hybrid transition through the same lifecycle. Its `dynamics` view uses physical-time selection, explicit units/tolerances and a disposable worker. Behavior discovery advertises `ode-integration`, `hybrid-transition` and `linked-trajectories`; it does not advertise arbitrary ODE/PDE execution. See [the dynamics adapter](dynamics-adapter.md) for model, error and resource limits. Historical verification above records the earlier registry state; current integration adds independent numerical and cancellation checks.
