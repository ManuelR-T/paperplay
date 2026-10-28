# PP108 independent reference checks

Verified 2026-10-28. This records reference scope for project-authored deterministic tests, not expert review, paper reproduction, or evidence from participants. No held-out corpus material, published experimental data, or external model calls are used. The test fixtures and calculations below are authored for this project; no third-party implementation is copied.

| Check | Primary reference and inspected locator | What the reference supports | Deliberate limits |
| --- | --- | --- | --- |
| Shortest distances | Paul E. Black, NIST DADS, [Bellman–Ford algorithm](https://xlinux.nist.gov/dads/HTML/bellmanford.html), Definition (modified 2019); page directly inspected | Source distance zero, other distances infinity, then V−1 edge-relaxation passes. This gives a reference without a heap or settled-vertex logic. | The admitted application input has nonnegative weights. Neither priority-tree invariants nor an Isabelle theorem is checked. |
| Stable ordering | Python Software Foundation, [Sorting HOWTO: Sort Stability and Complex Sorts](https://docs.python.org/3/howto/sorting.html#sort-stability-and-complex-sorts), and Decorate-Sort-Undecorate; sections directly inspected | Equal-key records retain input order; ordering by key and original index gives an independent expected sequence. | No Python runtime dependency; no independent proof of Powersort scheduling, merge costs, or experimental performance. |
| Quadratic updates | Gabriel Goh (2017), [Why Momentum Really Works](https://distill.pub/2017/momentum/), introductory momentum equations and First Steps: Gradient Descent; article body directly inspected | Gradient Ax−b for the stated quadratic, gradient descent, and the two-stage momentum recurrence. | Finite synthetic iterates only; no acceleration theorem, original image experiment, or benchmark reproduction. |
| Decay and reaction chain | NIST DLMF [Eq. 4.7.8](https://dlmf.nist.gov/4.7.E8), exponential derivative; equation directly inspected | Differentiating exp(at) verifies the authored constant-rate solutions. | The biochemical chain formula below is a project derivation, not a formula attributed to a NIST experiment or a paper dataset. |

Bellman bibliographic metadata: Richard Bellman, “On a routing problem,” *Quarterly of Applied Mathematics* **16** (1958), 87–90, [DOI 10.1090/qam/102435](https://doi.org/10.1090/qam/102435). The publisher-owned AMS issue index search record lists this exact title, author, pages and DOI. The direct publisher article fetch returned HTTP 403 during this audit, so its full text was **not inspected**. The implemented algorithm definition is supported by the directly inspected NIST entry, rather than a claim to have inspected Bellman's original proof. This distinction matters for admission metadata.

## Independent authored values

The directed graph has edges s→a=19, s→b=1, b→a=2, a→t=1, b→t=20, plus disconnected u. Its distances are s=0, b=1, a=3, t=4, u unreachable, by direct path enumeration. A forged t=5 remains finite and structurally accepted but fails the independent distance check.

For input keys [2,1,2,1], stable original indices are [1,3,0,2]. Swapping the first pair still produces sorted keys and a permutation; it specifically violates stability. Both sorting engines are exercised.

For A=diag(1,4), b=(1,4), x₀=(4,−3), α=0.2, gradient-descent coordinates at update n are (1+3·0.8ⁿ, 1−4·0.2ⁿ). The second update is (2.92,0.84). Momentum β=0.6, with initial momentum zero, gives first update (3.4,0.2), second (2.56,2.76). Tests forge a different step size or omit momentum, recomputing all retained residual/history fields consistently. Even decreasing quadratic objective and correct residual arithmetic do not imply the declared recurrence was followed.

For elapsed time τ, decay is x=x₀ exp(−kτ). With x₀=4 and k=1, x(log 2)=2. A separate units case uses 4 mmol, 60/min and 1000·log(2) ms, expecting **0.002 mol** at canonical time log(2) s. Expected values do not call the production conversion function.

For the closed chain A′=−k₁A, B′=k₁A−k₂B, C′=k₂B:

- A=A₀ exp(−k₁τ).
- If k₁≠k₂, B=B₀ exp(−k₂τ)+k₁A₀[exp(−k₁τ)−exp(−k₂τ)]/(k₂−k₁).
- If k₁=k₂=k, B=(B₀+kA₀τ)exp(−kτ).
- C=A₀+B₀+C₀−A−B.

These formulas can be checked by differentiation, initial conditions and total conservation, independently of the production RHS and RK4 solver. For initial (2,3,5), k₁=1, k₂=2, τ=log 2, the answer is (1,1.25,7.75). For equal unit rates it is (1,1.5+log 2,7.5−log 2). Tests also approach equal rates from both sides. The forged trajectory slows A and redistributes the lost amount while preserving positivity and total 10; the analytic reference rejects it despite those invariants passing.

## Admission and interpretation

`tests/validation-independent-reference.test.ts` actually calls both `validateTrace` and `validateExecutionResult` on each wrong legacy fixture, and `validateDynamicsResult` on each wrong ODE fixture, before checking scientific failure. Successful structural admission is asserted, not inferred from a compatible TypeScript shape. Correct authored runs exercise all six legacy engines and both admitted analytic ODE models.

The weak checks in adversarial tests (finite distance, sorted values/permutation, decreasing objective, positivity/conservation) are authored stand-ins demonstrating insufficient evidence. They are **not** claims that generated model code was compiled, that a model's self-tests ran, or that these pure checker calls mint trusted receipts. Fresh execution and host-private authority are covered by the separate validation module tests. Numeric agreement certifies only the stated bounded model/reference and tolerances. Unsupported models and incomplete results require honest unavailable/failure handling; neither importing a report nor passing compilation establishes scientific validity.

No paper text, figures, or implementation source is redistributed here. Metadata, links, mathematical expressions and original test data suffice. Referenced publication rights remain separate from project-authored tests; no general reuse license is inferred for the Bellman paper.
