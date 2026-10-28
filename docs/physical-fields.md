# Bounded diffusion fields (PP-102)

The `diffusion-field@1.0.0` capability selects a trusted constant-coefficient thermal diffusion model on a uniform cell-average grid. The initial boundary subset is 1D periodic or insulated/no-flux, and a 2D rectangle periodic in both directions. Imported JSON chooses the model, profile, geometry and explicit solver settings; it cannot provide a PDE expression or executable boundary rule.

The governing equation is `∂T/∂t = α ΔT`. The application-owned finite-volume spatial stencil uses centered face gradients and forward Euler in time, with separate old/new buffers. Grid values are cell averages, with domain faces at the declared origin and cell centers offset by half a cell. Periodic grids contain distinct cells without a duplicated endpoint. No-flux boundaries are not fixed-temperature boundaries.

## Stability and physical interpretation

The explicit diffusion restriction is `μx ≤ 1/2` in 1D or `μx + μy ≤ 1/2` in 2D, where `μ = α Δt/Δx²`. An unstable explicit setting must stop or require an explicit reader action to choose a stable step; it must not silently use a different imported request. The actual rounded step is checked. A shorter final remainder is a separately recorded execution policy, not a change of the requested main step.

Temperature is normalized to absolute Kelvin. Temperature differences in the stencil use difference semantics; a Celsius offset is never added to a temperature amplitude. Diffusivity is length squared per time, with explicit conversion through the existing unit catalog. A scalar temperature integral is not energy in joules without material density, heat capacity and appropriate geometry. The interface reports mean temperature and its drift.

Conservation, the discrete maximum principle and independent analytic cell-average references apply to this named scheme and boundary subset. Local grid/time refinement errors are not certified global error bounds, material validation or an original-paper reproduction. PDEs with other boundaries, variable coefficients, irregular meshes, masks/obstacles, sources, advection, waves and coupled fields require separately reviewed adapters.

## Linked field inspection

Stored snapshots, a grid-bound cell/region probe and its history share one result. Scrubbing stored time does not rerun the solver. Intermediate linked times select a labeled nearest snapshot rather than fabricate an interpolated solution. Changes to grid geometry invalidate the corresponding probe frame; parameter changes cannot let older jobs replace newer results.

Derived field snapshots use checksum-checked tensor assets and the existing spatial calibration/region modules. The stable grid identity preserves viewing state across snapshots, while original-image viewing retains its original byte/checksum remount policy. A 1D display row is explicitly an indexed display device; it is not a second physical simulation dimension.

Primary references, scheme derivations and independent oracle proposals are in [the field-adapter research](field-adapter-research.md). ## Resource ceilings and verification

Requests are at most 256 KiB and results at most 3 MiB. Grids have at most 128 cells in 1D or 64 × 64 in 2D. At most 64 snapshots and 32,768 retained field scalars are allowed jointly: a 64 × 64 grid can retain at most eight snapshots. Work is independently capped at 20,000 steps and ten million cell updates, with a default three-second wall budget and a 30-second host ceiling. At most two disposable field workers run concurrently. An interrupted step never commits a partially updated grid; performed cell updates are still counted. Actual final computation time and the last retained snapshot time may differ and are shown separately.

The scheme version is `temperature-fv-euler@1.0.0`. Snapshot indices select an unchanged anchored Euler trajectory. The target-step policy rounds a duration/step ratio within `32*eps*max(1,ratio)` of an integer to that integer; the final target time is exactly the requested end. Only the final remainder may be shorter. Normal clock comparisons account for elapsed-grid roundoff while excluding the absolute time origin. Declared stability metadata stays distinct from the actual rounded Fourier check performed at every step.

`npm run check` passed TypeScript, 501 deterministic tests and production build. Independent tests cover rational periodic/no-flux updates, analytic cell averages with sinc factors, separate discrete Fourier amplification, unequal 2D axes, time/spatial convergence, conservation/maximum principle, zero diffusivity, Celsius differences, decimal/final-remainder clocks, long grids, unstable rounded prefixes, budgets and worker failures. Final central-study opening/presentation/default-grid changes pass typecheck/build, 23 focused study tests and eight field representation/spatial tests.

Native Chromium evidence is recorded in [data/field-browser.json](../data/field-browser.json), with desktop and 320 px/200% screenshots. All three examples complete. Keyboard region/probe/time links, stable canvas/zoom/palette across scrubs, grid-frame invalidation, explicit unstable/oversized failures, active worker termination and a constant 300 K axis check pass without provider requests. A saved 64 × 32 study reopens from **Files & source → Open figure or study** with its exact source, request, selected probe and time; the current reading paper remains separate. The generic study importer uses its existing 512 KiB validator and preserves other widget/artifact import paths. No paid inference, held-out evaluation, human study or release work is part of this issue.
