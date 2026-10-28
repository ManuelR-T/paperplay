# Processes and state-machine explanations (PP-089)

A `process` node extends the composed-scene contract with declared compartments, entities, directed relationships and authored walkthrough steps. Network and state-machine modes use the same deterministic structural layout and renderer. There is no biology/physics/CS switch in the reader.

Relationships name their meaning: association, flow, causal, reaction or state transition. Each requires an exact declared anchor and explicit conditions under either source-reported interpretation or authored assumption. These are declarations, not verification. A drawn arrow never establishes causality. Optional first-order rate constants require nonnegative finite values in `Hz` and their own support/conditions; no other rate units or kinetic-law inference are accepted. Guards remain plain explanatory text and are never evaluated.

A walkthrough highlights named entities and relationships while retaining the full network and fixed coordinates. State-machine steps permit at most one active state. Compartments retain labels/descriptions and membership lists. Directed arrowheads, complete relationship/support tables, full object labels, source-return actions and the shared entity selection remain available on narrow screens. Background group rectangles are explicit layout roles, not inferred physical compartments or observed geometry.

All transitions in this format have literal origin `authored-walkthrough`. Imported files cannot promote them to computed events. Existing executable widgets continue to show their actual trusted engine traces separately; this node does not add a reaction solver or state-machine interpreter. Future computed process adapters must bind their actual run/evidence rather than rename these steps.

## Reader entry points

**Create a figure → Try a process walkthrough / Try a state machine** opens explicitly synthetic examples beside the selected source quote. The examples declare that they do not reconstruct the selected paper. `representationFromProcess` builds a single-passage plan; imported generic plans may bind multiple exact source anchors. The public composed capability advertises `process-network` and `state-machine-walkthrough`, not biological simulation or distributed-consensus execution.

## Verification

Deterministic tests cover both structural examples through the offline build/execution lifecycle, stable extents, explicit group roles, collision diagnostics, semantic frame/entity/source links, causal/rate support, unknown targets, bounds and rejection of fake computed origins. Arrow geometry handles coincident/self-loop endpoints without nonfinite values. The full check passes strict TypeScript, 269 tests and the production build.

Native Chromium verified both examples, active entities/edges, conditions/rates/guards, linked selection and focused source return. At 320 px and 200% text/expanded spacing, named-object buttons wrap fully; 560 px diagrams and 680 px tables scroll locally without widening the dialog. The actual Create action opens the state-machine example with zero model requests. Scientific inputs here are teaching declarations; no original-paper reproduction, paid inference or domain-expert approval is claimed.
