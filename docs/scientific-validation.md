# Independent scientific behavior checks

PP-108 adds explicit, source/input-bound validation reports. Rendering, successful compilation, model-written tests and passing engineering checks do not grant scientific verification. The application selects fixed independent checkers and tolerances; neither imported JSON nor generated code can install a checker or mint a live validation receipt.

A reader can check the current computed figure locally. The action runs its exact input, seed and approved engine in a fresh disposable background worker, verifies the returned structure, compares its semantic output identity with the displayed result, and applies the independently implemented references. There is no inference request, data upload or blocking execution fallback. Cancellation and unavailable workers leave the source and last valid figure intact.

## Checked scope

| Engine family | Independent reference | What this does not certify |
| --- | --- | --- |
| Dijkstra heap / scan | Bellman–Ford relaxation and shortest-distance invariants | The publication's functional priority search tree, Isabelle proof or full algorithmic complexity |
| Powersort / natural merge | Stable key/index ordering and permutation/stability properties | Powersort's merge scheduling theorem or original runtime benchmarks |
| Gradient descent / heavy ball | Separately authored finite quadratic recurrence, objective and residual comparisons | General convergence, acceleration or the original article's experiments |
| Differential decay / two-rate reaction chain | Analytic exponential solutions, positivity and conservation | Experimental measurements, unregistered equations or general ODE accuracy |

Checks state their exact reference, scope, input-domain assumptions, measured and expected values, units and fixed absolute/relative tolerances. Missing references, incomplete results and checker-domain/resource limits remain unavailable. A successful report is limited to its recorded properties and inputs. No original experiment reproduction is claimed.

## Identity and authority

Portable reports record the normalized source fingerprint, scientific request, actual output, selected checked assets and engine/checker/oracle/policy identities. Scientific edits invalidate a current report; view navigation does not change the scientific result. The old report remains inspectable rather than disappearing. Implementation reference-case labels are explicitly separate from current-run checking.

Only the application-owned current invocation receives a private live receipt. Export and import retain report history, references and numerical details; serialized data cannot restore authority. Reopened reports require a new explicit local check for current verification. User-supplied assertions and model-generated tests remain supplemental declarations.

## Verification and limits

Independent reference tests deliberately perturb valid output shapes: wrong shortest distances, swapped equal-key identities, incorrect recurrence values and plausible positive reaction trajectories. These fixtures compile and pass structural transport admission but fail an independent scientific check. Native-browser evidence records actual local checks, scientific edit invalidation, navigation, cancellation and export/reopen behavior. These are engineering checks, not observations from recruited readers or domain experts.

Native reports for the authored decay and reaction-chain examples are preserved in `data/validation-decay-native-report.json` and `data/validation-reaction-native-report.json`. They retain exact comparison values and hashes, and remain portable declarations. [Independent reference derivations and admission evidence](scientific-validation-references.md) distinguish inspected primary sources from bibliographic metadata.
