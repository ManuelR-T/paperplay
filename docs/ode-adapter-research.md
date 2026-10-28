# PP-100: bounded ODE and hybrid dynamics adapter

Research/proposal, 2026-10-28. No solver implementation or scientific verification is claimed here. This note supports issue [PP-100 / #55](https://github.com/ManuelR-T/paperplay/issues/55), whose acceptance requires independent decay, damped-oscillator, coupled-reaction and event-transition cases, explicit tolerances/units/failures, and cancellable local trajectories. These are authored engineering cases, separate from the held-out paper corpus.

## Recommended first supported class

Implement an application-owned, deterministic explicit RK4 integrator for small, smooth, non-stiff first-order initial-value systems, with a declared finite model registry and explicit one-shot threshold transitions. The initial registry can contain first-order decay, a damped linear oscillator expressed as two first-order equations, and an irreversible first-order reaction chain. A reusable solver accepts trusted application callbacks internally; imported JSON chooses a registered model and finite parameters, never supplies a JavaScript function, expression to evaluate, module name or import URL.

This is a deliberate initial support boundary. SciPy distinguishes explicit Runge–Kutta methods for non-stiff problems from implicit methods for stiff systems. A failure or excessive step count is not a proof of stiffness. PDEs, DAEs, delay equations, arbitrary user-defined vector fields, stochastic reactions, parameter fitting and validated interval integration remain outside this adapter. [SciPy `solve_ivp`, method selection](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html)

## Numerical method and honest accuracy reporting

The classical four-stage RK4 rule and coefficients are specified by NIST DLMF equations 3.7.18–19. NIST conditions its local fifth-order remainder on five continuous derivatives. Apply the rule componentwise to the vector state; do not apply a smooth-step accuracy claim across a jump. [NIST DLMF §3.7(v)](https://dlmf.nist.gov/3.7#v)

Recommended implementation policy: one full RK4 step and two half steps, retaining the two-half-step value. On a smooth segment, if the leading full-step error is `C h^5`, the combined half-step error is approximately `C h^5/16`; subtracting gives the **fine-value local error estimate** `abs(yHalf2-yFull)/15`. This factor is derived here from the order expansion, independently of any future production function. It estimates local truncation error; it neither bounds global trajectory error nor includes model error, measurement uncertainty or event-location uncertainty.

Use componentwise `atol_i + rtol * max(abs(y_i),abs(yNext_i))`, and require the largest normalized estimated component error to be at most one. Store `atol` in the component's declared units; `rtol` is dimensionless. SciPy documents combined absolute/relative local-error scales and component-dependent absolute tolerances. [SciPy tolerance contract](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html)

For a small first implementation, deterministic halving on rejection is sufficient; an optional deterministic doubling after a comfortably small error must remain bounded by declared `maxStep`. The solver identity must name this exact policy, rather than calling it RK45. Report accepted/rejected attempts, RHS evaluations, largest accepted normalized estimate and actual final time. If a minimum step, retry budget, output budget or floating-point time-advance check is exhausted, return an explicit incomplete result with the valid prefix. Do not return `completed` merely because some samples exist.

A useful independent stability regression follows directly by substituting `y'=λy` into the published RK4 coefficients: the amplification polynomial is `R(z)=1+z+z²/2+z³/6+z⁴/24`. In particular `R(-3)=11/8>1`, although the exact dissipative solution decays. Test this rational result independently of the integrator. When step doubling is enabled the accepted fine step uses two half-step factors, so admission/diagnostic checks must use the actual executed substep, not mistakenly treat the coarse diagnostic step as the accepted update. A local tolerance check is not a general stability certificate.

## Independent numerical references

The expected values below come from analytic identities, not from another invocation of the production RK4 code. Test helpers must not import the production RHS or its closed-form helper to construct expectations. Put the equations, initial data, units, reference derivation and numerical tolerances alongside each authored fixture.

| Case | Independent reference and concrete assertions |
| --- | --- |
| Exponential decay | `x'=-kx`, `x(0)=4`, `k=1 s⁻¹`; at `t=ln(2) s`, require `x≈2`. Include `k=0` and zero initial amount. The integrated law and half-life are given by [University of Texas chemistry teaching material](https://ch302.cm.utexas.edu/kinetics/int-rate/). The exact half-value avoids sharing a numerical exponential implementation with the solver. |
| Underdamped oscillator | `x'=v`, `v'=-2γv-ω0²x`, `γ=1 s⁻¹`, `ω0=√2 rad/s`, `x0=1 m`, `v0=0 m/s`. Here `ωd=1 rad/s`, `x(t)=e^-t(cos t+sin t)` and `v(t)=-2e^-t sin t`. At `t=π/2 s`, use the independently derived relation `v=-2x`, plus a separately evaluated analytic value. The characteristic roots and damping regimes are specified in [MIT lecture 4, equations 4–8](https://ocw.mit.edu/courses/res-8-009-introduction-to-oscillations-and-waves-summer-2017/mitres_8_009su17_lec4.pdf). Test undamped energy separately and damped energy dissipation with a numerical allowance. |
| Coupled reaction chain | Authored `A→B→C`, `A'=-A`, `B'=A-2B`, `C'=2B`, initial `(1,0,0) mol/L`, rates `(1,2) s⁻¹`. Integrating factors give `A=e^-t`, `B=e^-t-e^-2t`, `C=(1-e^-t)²`; at `t=ln(2) s`, the exact reference is `(1/2,1/4,1/4)`. Independently verify `A+B+C≈1`, nonnegative accepted concentrations and derivative conservation. First-order rate semantics are defined by [IUPAC](https://goldbook.iupac.org/terms/view/15713); the three-state specialization and oracle are derived here, not copied from the future implementation. |
| Threshold with reset and mode switch | Start `x'= -x`, `x0=1`, downward threshold `x=1/2`. The exact event time is `ln(2) s`. At the event reset to `x⁺=1` and switch once to `x'=-2x`. At `t=2 ln(2) s`, require `x≈1/4`; preserve both `x⁻=1/2` and `x⁺=1` in the event record. This is an authored piecewise analytic consequence of the decay reference, not an organism model. |

For smooth references, compare maximum component errors at several independently chosen times and verify a fourth-order refinement trend in a range above roundoff. A ratio near sixteen on halving is useful evidence, not an assertion that every finite grid must produce exactly sixteen. If adaptivity changes the grid, test order on an explicitly fixed-step kernel and tolerance behavior on the adaptive driver separately.

An optional independent development oracle for linear systems is `expm(A*t)y0`, using the separately implemented matrix-exponential algorithm in SciPy. Pin its version and store provenance if generating checked reference values; it need not become a browser dependency or routine CI requirement. [SciPy `linalg.expm`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.expm.html)

## Hybrid event policy

Declare event identity, state component, threshold with compatible units, crossing direction, terminal/reset action and trigger limit. Bracket a crossing within a smooth segment, refine it with bounded bisection and fresh integrations from the bracket's known initial state, record the pre-event value, apply the reset exactly once, then restart the next mode. Do not interpolate a line through a discontinuous reset.

Sign-change event detection can miss tangencies and multiple crossings within one step. Both SciPy and SUNDIALS explicitly document these limitations; direction filtering and a finite maximum step do not prove every event was found. [SciPy event contract](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html), [SUNDIALS rootfinding](https://sundials.readthedocs.io/en/v7.8.0/cvode/Mathematics_link.html#rootfinding)

Known-time discontinuities should split integration at that time. For state-dependent transitions, the old-mode RHS must remain meaningful over the bracket while locating the event, followed by a restart after the change. LLNL discusses stopping/reinitializing around discontinuities and the need for a smooth extension during root location. [LLNL SUNDIALS usage notes](https://computing.llnl.gov/projects/sundials/usage-notes)

Initially allow a single one-shot event per authored mode transition. Reject ambiguous simultaneous events or define a documented deterministic ordering; never silently pick one. Bound total events and root iterations, reject non-advancing repeated triggers, and return event time/bracket width separately from the state error estimate. A small root bracket does not certify the true event time when the numerical trajectory itself has error.

## Units and domains in this repository

`shared/scientific-quantities.ts` and `lib/quantities/convert.ts` already enforce finite quantities, compatible dimensions, shape/frame identity and explicit absolute-versus-difference temperature semantics. Reuse these checks before numerical work; do not add a second silent conversion table.

The current catalog includes `s`, time prefixes, `m`, `m/s`, and concentration units, but lacks explicit reciprocal-time and rad/s identifiers. `Hz` has inverse-time dimensions but denotes cyclic frequency. BIPM distinguishes frequency in Hz from angular frequency in rad/s, whose values differ by `2π`; unit dimension alone does not identify the quantity. [BIPM SI Brochure, derived-units discussion](https://www.bipm.org/en/publications/si-brochure/)

A minimal typed rate contract can use `{value, per:TimeUnit, role:'decay-rate'|'angular-frequency'}` and normalize by the converted time denominator, displaying `s⁻¹` or `rad/s` according to role. Alternatively add explicit catalog units with a versioned compatibility change. Do not label damping or reaction coefficients Hz just to fit the existing enum. Oscillator position and velocity need distinct state units and distinct `atol_i`; reaction concentrations need matching compatible units. Test equivalent seconds/milliseconds and mol/L/mmol/L inputs with converted absolute tolerances. Negative initial concentrations, negative decay rates and impossible intervals must fail before integration. Never clamp negative concentrations silently: reject/refine or return a domain diagnostic with the valid prefix.

## Concrete extension seam and bounded behavior

The current matrix engine in `lib/engines/numeric.ts` is an SPD optimization recurrence, not an ODE solver. Preserve its contract. The existing `AlgorithmInput` and trace unions cover graph/array/matrix; forcing time trajectories into the matrix case would obscure units, stopping reasons and events.

Suggested substantive extension:

1. Add typed dynamics model/request/result contracts, a trusted integration module and a `dynamics` representation view with an exact versioned `ode-rk4` capability. Extend the registry/lifecycle/output validation in `shared/representation-capabilities.ts`, `shared/representations.ts`, `lib/representations/adapters.ts` and `lib/representations/registry.ts`.
2. Add a discriminated dynamics branch to the trusted worker protocol, or a sibling worker client using the same lifecycle guarantees. `lib/execution/client.ts` already terminates a disposable worker on cancel, failure, completion and a bounded wall deadline; its protocol validates request/result identity and sizes. A synchronous main-thread loop checking `AbortSignal` cannot observe a newly delivered browser click while it blocks the event loop.
3. Bind every result to the exact model, initial state, normalized and displayed units, parameters, time interval, solver version, tolerances and event rules. PP099's cache principle applies; its generated-SDK session is not automatically a dynamics cache. No result reuse across different solver/tolerance/event inputs.
4. Return a finite status such as completed, terminal-event, cancelled, limit-reached, tolerance-not-met, invalid-domain or nonfinite; include actual final time and a valid-prefix trajectory where meaningful. A limit status must remain visible when plotting.
5. Plot linked time-series and phase-plane/state views from one computed result, with exact-value inspection and a source button. Parameter changes cancel older work; only the current job can replace the displayed result. Preserve the prior valid trajectory on failure and identify its older parameters.

Proposed initial ceilings, subject to measurement: eight state variables, 4,096 accepted steps, 8,192 attempts, 100,000 RHS evaluations including root work, 32 events, 32 bisections per event, 2,048 retained output rows, 32,768 retained scalar values, and output below the registry's 3 MiB ceiling. These are application policy proposals, not numerical-analysis recommendations. Enforce each independently; include rejected work in counters. Check `t+h>t`, every stage/output for finiteness, and terminate the worker on cancellation/deadline. Report actual counts so a native-browser test can verify the budget behavior.

Use explicitly authored fixtures with source/assumption labels. Passing independent mathematical cases establishes behavior for the named solver/model class; it does not establish parameter validity for a paper, reproduce experiments, certify arbitrary hybrid systems or verify scientific claims.
