# Bounded differential and hybrid dynamics (PP-100)

The approved `ode-rk4@1.0.0` capability adds a `dynamics` representation to the existing source-linked reader. Imported JSON selects application-owned models and finite settings; it cannot install an RHS function, evaluate an expression, import a package or change worker privileges. The same representation lifecycle, exact source anchors, data-study export and evidence policy apply. A completed calculation never establishes scientific reproduction.

The initial class is small, smooth, non-stiff first-order initial-value systems with registered first-order decay, a damped linear oscillator, an irreversible three-state reaction chain and a one-shot threshold-decay transition. PDEs, DAEs, delay equations, stochastic reactions, arbitrary vector fields, parameter fitting and validated interval integration are outside this adapter.

## Numerical policy

Classical RK4 compares one full step with two half steps and retains the fine solution. The fine local truncation estimate is `abs(fine-coarse)/15`, normalized componentwise by `atol_i + rtol * max(abs(old_i),abs(next_i))`. Absolute tolerances have the corresponding state unit; relative tolerance is dimensionless. Local estimates exclude global, model, measurement and event-location errors. They are not confidence intervals or certified bounds.

Threshold events are located within a smooth old-mode segment, followed by a reset and restart. The trajectory and event record preserve values before and after the jump; a plot must not connect those two values as a continuous path. Sign-change detection can miss tangencies or multiple crossings within a step. A narrow numerical root bracket does not certify the exact physical event time.

## Execution and interaction

A disposable trusted browser worker performs numerical work and is terminated on cancellation or a wall deadline. Browser execution has no blocking main-thread fallback and makes no provider request. Only the current run may replace the displayed result. Failed/incomplete runs must retain their stopping reason and actual final time. A prior successful trajectory may remain visible with its older settings identified.

The request binds model, initial values, units, rates, interval, solver/tolerances and event rules. Decay/damping/reaction rates use reciprocal time and angular frequency uses radians per time; neither is silently relabeled as cyclic frequency in Hz. Existing quantity conversion supplies explicit time, length, velocity and concentration conversion.

Reference derivations, method selection, event limitations and primary sources are in [the research note](ode-adapter-research.md). The independent authored engineering fixtures are separate from the frozen held-out paper corpus. They exercise numerical behavior for this named model class, not the reproduction of a source paper’s experiment.

## Resource ceilings

Requests are at most 64 KiB; results at most 3 MiB. The contract permits up to eight states (the installed models use one to three), 4,096 accepted steps, 8,192 attempts, 100,000 RHS evaluations including root refinement, 2,048 retained rows, 32 event iterations per declared event, and 30 seconds per worker. The initial model registry supports one event, regardless of the general event-count ceiling of 32. Each request may lower these ceilings. At most two dynamics workers run concurrently. The default wall budget is three seconds, with host startup/transfer allowance capped at the global 30-second deadline.

`attempts` includes a final interrupted trial; `acceptedSteps` and `rejectedSteps` count completed decisions. An incomplete result may consequently have one undecided attempt. Resource stops preserve the valid prefix. Stages leaving a nonnegative domain are retried with a smaller step; concentrations are never silently clamped. The RK4 linear stability check applies to the executed half step, and is a model-specific guard rather than a general stiffness diagnosis.

For threshold location, the recorded pre-reset scalar is projected to the declared threshold inside the refined numerical bracket. The root bracket width is reported separately. The largest accepted normalized estimate includes successful root subsolves for a committed event; discarded trials and uncommitted root searches do not become accepted-state evidence.

## Verification

TypeScript, 433 deterministic tests and the production build pass. The native Chromium walkthrough is recorded in [data/dynamics-browser.json](../data/dynamics-browser.json), with desktop and 320 px/200% screenshots. All four models complete; parameter editing, keyboard-linked values, readable invalid-input feedback, an incomplete step-limited run, pending-work cancellation and an exact shown-trajectory download were exercised without provider requests. Seven instrumented real workers terminated, leaving zero active. Desktop plots fit the dialog; mobile plots/tables scroll inside bounded regions. Active worker termination and stale responses are additionally exercised by client tests. Deterministic tests cover exact half-life and coupled-reaction rational values, the independently differentiated damped-oscillator solution, conservation, fourth-order refinement, unit equivalence, event/reset/terminal behavior, resource prefixes, cancellation and worker cleanup. Portable study tests retain exact source/settings and physical-time selections, reject substituted results and retain the application-owned evidence policy. No paid inference, held-out evaluation, human review or release work is involved in this adapter.
