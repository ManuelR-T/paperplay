# Adding a source, renderer and execution family

The M5 extension is continuous optimization: small symmetric positive definite (SPD) quadratics. It adds `matrix` input, `matrix` and `plot` figures, and two trusted engines without adding algorithm names to the generic reader or renderers. Existing graph/array contracts and schema-version-1 snapshots remain valid. The new variants are an additive schema extension; an older application must reject unsupported variants instead of pretending to understand them.

## Concrete extension: gradient descent and momentum

The source is Gabriel Goh, [Why Momentum Really Works](https://distill.pub/2017/momentum/), Distill, 4 April 2017, [DOI 10.23915/distill.00006](https://doi.org/10.23915/distill.00006). Its “Citations and Reuse” section explicitly licenses original text and diagrams under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), while excluding reused third-party figures. The fixture `data/numeric-paper.ts` includes selected original equations and a short sentence with attribution. It does not copy original visualizations, third-party figures, implementation code or experiments. Its reference 1 is a logical HTML location, never a physical PDF page.

The selected equations define a convex quadratic, its gradient update and the heavy-ball momentum recurrence. Our implementation evaluates those recurrences on small synthetic SPD systems. It does not reproduce the article's polynomial-regression or image-colorization experiments, neural-network training, or a general convergence proof. Matrix and plot labels identify synthetic inputs and actual computed residual samples.

## Extension seam

1. Declare an input variant and finite bounds in `shared/schema.ts`. The matrix extension is `{kind:'matrix',matrix:number[][],rhs:number[],initial:number[]}` with dimensions 1–8, a square matrix, matching vectors and coefficients bounded by ±1,000,000. An empty initial vector means zero. Source anchors, figure controls, binding/version validation and snapshots remain shared.
2. Declare capabilities in `engineRegistry`, metadata in `engineMetadata`, and an explicit implementation in the `runEngine` dispatch table. `lib/engines/numeric.ts` owns the numerical mechanism; the reader receives only a generic trace and registry metadata.
3. Supply parameter declarations and initialize every bound parameter from registry defaults. Gradient descent has `operationLimit`, `iterations` and `stepSize`. Heavy-ball adds `momentum`. Compatible comparisons filter shared parameters by each engine's declarations and use defaults for parameters absent from the selected method.
4. Return contiguous trace indexes, monotonic operation counts, explicit stop status, declared metrics and a schema-valid state. Numeric state is `{kind:'matrix',values,residual,iteration,history}`. History preserves the actual residual of every observed iterate, including iteration zero. The trace validator checks vector lengths, contiguous history and current residual consistency.
5. Add a renderer over input/state instead of algorithm IDs. `NumericView` provides a focusable matrix heatmap, exact numeric cells and vector table, or a residual plot with a numeric-table alternative. Its plot contains only actual observed samples. Zero residuals use a declared display floor for the logarithmic axis.
6. Add a source fixture and an entry in `preparedExperimentPresets`. `createPreparedFigures` builds a matrix mechanism figure, compatible comparison and computed convergence plot using the same source-anchor and snapshot contracts. `createConvergenceFigure` is reusable for another matrix source.
7. Extend the bounded Meta capability/schema contract and scientific source-scope checks. Numeric proposals require matrix/RHS/initial fields (empty when irrelevant), a matching supported recurrence, SPD data and stable bounded execution. An unknown method or invalid numeric proposal degrades to conceptual steps; it never receives fabricated measured convergence.
8. Write independent reference cases, not copies of the implementation. Include source/version, finite-domain, operation-limit and cancellation checks and snapshot round trips. Add stronger fidelity labels only when their precise claims have recorded evidence.

## Numerical bounds and interpretation

`iterations` is an integer from 1 through 200. `stepSize` ranges from 0.001 through 1, in increments of 0.001; momentum ranges from 0 through 0.99. The input is checked for symmetry and numerical positive definiteness using a Cholesky factorization. Matrices with a pivot at or below `max(1,maxAbs(A)) × 10⁻¹²` are rejected rather than promising robust behavior for nearly singular systems.

A conservative row-sum bound on maximum curvature must satisfy `αL < 2` for gradient descent or `αL < 2(1+β)` for momentum. This is a sufficient teaching restriction, not an exact eigenvalue calculation; it can reject settings that a more precise spectral analysis would allow. The check and SPD requirement are explicit errors, not silently corrected inputs.

Each update counts `n² + 3n` arithmetic units for a dense product plus vector updates; initialization is not included in this update counter. A separate matrix-product count includes initialization. These deterministic local counts are not floating-point benchmarks or comparable units to graph/sorting metrics. The declared comparison group prevents such cross-family comparisons.

Residual is `‖Ax−b‖₂`; the stopping tolerance is 10⁻⁸. A `completed` trace means the configured finite iteration trajectory completed or tolerance was reached, not that convergence necessarily occurred. The result includes `converged` and a summary distinguishing those cases. Cancellation and operation ceilings retain only observed states with `cancelled`/`limit-reached` status. Floating-point overflow is rejected.

## Verification evidence

`npx tsx --test tests/numeric.test.ts` checks every gradient-descent iterate against an independent diagonal closed form, both methods against a hand-solved non-diagonal 2×2 system, and momentum against its original recurrence. Beta zero exactly matches the gradient-descent states. Other cases reject nonsymmetric/indefinite/singular matrices, invalid dimensions, nonfinite inputs, unstable step sizes and iteration counts above 200. Cancellation, numeric-history validation, shared comparison/snapshot contracts and grounded Meta-planning/question recomputation are exercised without paid model calls.
