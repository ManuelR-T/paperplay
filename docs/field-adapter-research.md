# PP-102: bounded physical fields and conservation examples

Research/proposal, 2026-10-28, for [PP-102 / #57](https://github.com/ManuelR-T/paperplay/issues/57). This is implementation preparation, not an implemented or independently certified solver. The ledger requires a reviewed narrow 1D/2D model class, explicit boundary conditions/discretization/units, analytic or independent references, linked field/probe/time selection, and bounded recovery for unstable or unsupported settings. No held-out research-paper content or fixtures were used.

## Recommended initial model

Start with a scalar constant-coefficient diffusion/heat equation on a uniform orthogonal grid:

`∂u/∂t = α Δu`, with finite `α ≥ 0`.

Support 1D periodic and zero-flux boundaries, and a 2D rectangle periodic in both directions. Make the boundary condition a required enum; do not silently assign a default or claim that periodic boundaries describe a finite insulated plate. An initial 2D zero-flux extension is reasonable only if its edge/corner stencils and references are included explicitly. Defer imposed-temperature Dirichlet, Robin, mixed boundaries, variable coefficients, nonlinear diffusion, anisotropic tensors, sources, irregular meshes and coupled fields.

Stanford's heat-equation notes derive diffusion from a conservation balance and distinguish Dirichlet, Neumann and periodic conditions. Their thermal derivation requires density and heat capacity to interpret temperature integrals as heat. A temperature field alone does not provide a heat budget in joules. [Stanford Math 220B, heat equation, §§2.1–2.2](https://web.stanford.edu/class/math220b/handouts/HEATEQN.pdf)

| Candidate | Numerical/physical considerations | Recommendation |
| --- | --- | --- |
| Constant diffusion | Scalar field; transparent face-flux conservation; exact decaying Fourier modes; explicit time step shrinks quadratically as the grid is refined. | Implement first, with visible limitations and small grids. |
| Constant 1D advection `u_t+a u_x=0` | Exact periodic translation is an excellent independent reference. A sign-correct upwind flux needs both positive and negative velocity cases; first-order upwind adds numerical diffusion. | A later separately named transport capability. The governing equation and exact propagating initial state are explained by [Clawpack's authors](https://www.clawpack.org/riemann_book/html/Advection.html). |
| Wave equation `u_tt=c² Δu` | Requires displacement and velocity, a consistent first time step, and appropriate boundary handling. A conserved discrete energy differs from simply monitoring the continuum expression on arbitrary samples. | Defer until the field/time/probe contract is sound. For the standard 1D explicit wave stencil, `c Δt/Δx ≤ 1`; CFL is not a general sufficient condition for every scheme. [Heath and VanderZee, University of Illinois](https://heath.cs.illinois.edu/iem/pde/wavecfl/). |

Do not expose an arbitrary PDE-expression field or imported RHS callback. The first implementation should choose a trusted model, initial-profile family and boundary enum, with finite typed parameters. No inference, external numerical service or new dependency is necessary for the proposed stencil and analytic references.

## Grid and scheme semantics

Use **cell averages**, indexed `i=0…Nx−1`, with faces at `x0+i Δx` and centers at `x0+(i+1/2)Δx`, where `Δx=Lx/Nx`; require positive finite lengths and initially at least four cells per active axis. In 2D use row-major `[Ny,Nx]`, `index=j*Nx+i`. The domain length is `N*spacing`, not `(N−1)*spacing`; a periodic grid has no duplicated endpoint. FiPy documents its cell-centered finite-volume variables as control-volume averages and derives updates from face fluxes. [NIST FiPy finite-volume discretization](https://pages.nist.gov/fipy/en/latest/numerical/discret.html)

For constant `α`, forward Euler with centered face gradients gives

`U_i^{n+1} = U_i^n + μx (U_{i−1}^n − 2U_i^n + U_{i+1}^n)`,

with `μx=α Δt/Δx²`. The 2D stencil adds the corresponding `μy` term. Always use separate old/new buffers: updating in place changes the method and loses the stated symmetry/conservation behavior.

For periodic boundaries, wrap neighbor indices on the distinct cells. For a 1D insulated boundary, set the exterior normal flux to zero: equivalently the left ghost average equals the first cell and the right ghost average equals the last cell. This is not a fixed-value boundary. NIST documents zero-flux and fixed-value boundary conditions separately. [NIST FiPy boundary conditions](https://pages.nist.gov/fipy/en/latest/USAGE.html#boundary-conditions)

The NIST explicit 1D diffusion example states `Δt ≤ Δx²/(2α)`. [NIST FiPy explicit diffusion example](https://pages.nist.gov/fipy/en/latest/generated/examples.diffusion.mesh1D.html)

For the proposed rectangular stencil, the following consequences are derived directly from its coefficients:

- Require `μx ≤ 1/2` in 1D and `μx+μy ≤ 1/2` in 2D. These are diffusion Fourier-number restrictions, distinct from the hyperbolic wave/advection CFL number. A displayed default safety factor such as 0.9 is an application choice.
- Under that restriction, each new cell is a convex combination of previous neighbors. The discrete maximum principle bounds new values by previous extrema and preserves nonnegativity, up to declared floating-point allowances.
- Summing periodic or zero-flux face contributions cancels internal fluxes. The cell-volume-weighted sum, hence the uniform-grid mean, should remain constant to rounding error.
- The centered spatial stencil is second-order and forward Euler first-order in time on sufficiently smooth solutions. Small time steps improve time error, not spatial resolution. Stable does not mean accurate.

Handle `α=0` as an unchanged-field case without dividing by zero to compute a stability limit. Reject an explicitly requested unstable time step before updating any cells. Alternatively offer a separate explicit “choose stable time step” action and record the chosen value; do not silently change an imported request. Check the actual rounded time increment, not just the requested decimal step: PP100 already exposed the failure where a very large time origin rounds a requested small step upward. Permit a shorter final remainder only as a documented policy and recompute its Fourier number.

NIST also demonstrates implicit diffusion precisely because explicit time steps become expensive. Choosing the explicit scheme for bounded teaching grids does not imply that it is suitable for large or stiff scientific simulations. [NIST diffusion example, explicit/implicit comparison](https://pages.nist.gov/fipy/en/latest/generated/examples.diffusion.mesh1D.html)

## Independent references and numerical checks

Use authored mathematical fields rather than original-paper examples. The oracles below use zero domain-face origins and are derived independently by differentiation/integration of analytic modes. Test expectations must not import the production Laplacian, boundary helper or time-update function.

Let `sinc(z)=sin(z)/z`, with value one at zero. Comparing a cell-average solver with a pointwise cosine at a cell center introduces a different error; account for the analytic average explicitly.

| Reference | Independent expectation |
| --- | --- |
| Constant field | Any supported boundary, any `α≥0`: every value stays exactly the initial constant in ideal arithmetic. Include `α=0` with a nonconstant field; all cells remain unchanged. |
| Periodic 1D cosine | `u=T0+A exp(−α k²t) cos(kx)`, `k=2π/L`. Exact cell average: `T0+A sinc(k Δx/2) exp(−α k²t) cos(k xc)`. Mean is `T0`; extrema contract. |
| Insulated 1D cosine | The same form with `k=π/L` satisfies zero normal derivative at both ends of `[0,L]`. Compare exact cell averages and the conserved mean. This specifically exercises the distinct no-flux edge stencil. |
| Periodic 2D rectangular mode | `u=T0+A exp(−α(kx²+ky²)t) cos(kx x)cos(ky y)`, `kx=2π/Lx`, `ky=2π/Ly`. The exact cell-average amplitude contains **both** sinc factors. Use unequal `Lx,Ly` and unequal cell counts to expose transposition or spacing errors. |
| Exact discrete mode | For periodic 1D, the stencil eigenvalue gives amplitude multiplier `g=1−4μx sin²(k Δx/2)` per full step; in 2D subtract the analogous y term. Compare an independently computed `g^n` with the solver for an integer number of equal steps. This verifies the implemented discrete scheme separately from its continuum truncation error. |
| Hand-checkable local update | Periodic 1D, four cells `[0,1,0,0]`, `μ=1/4`: the exact next cell-average vector is `[1/4,1/2,1/4,0]`. Its sum remains one. Use rational expected values, not a second loop over the same stencil. |
| Instability rejection | Alternating periodic data with `μ>1/2` has discrete amplification `1−4μ` of magnitude greater than one. Reject that request; do not run it and clip negative values or rescale the result into a plausible palette. |

The separated-mode construction follows the eigenfunction approach in [Stanford's primary teaching notes](https://web.stanford.edu/class/math220b/handouts/HEATEQN.pdf); the tabulated specializations and exact discrete multipliers are project-authored derivations.

Use separate tests for time refinement at fixed fine spatial resolution, spatial refinement with time error controlled, and combined refinement at constant stable `Δt/Δx²`. In the last case both leading errors scale like `Δx²`, so halving spacing should approach a factor-four error reduction above roundoff, not necessarily equal four on every grid. Report absolute/L2/L∞ differences against the named analytic cell-average reference; do not rename a grid-difference estimate a certified error bound. Conservation checks need a summation tolerance scaled to field magnitude, cell count and update count rather than an unexplained universal epsilon.

## Units, physical interpretation and admissible data

Normalize length and time through the existing quantity conversion utilities. Thermal examples can evolve absolute Kelvin, with temperature **differences** in the stencil and error tolerances; displaying Celsius needs the existing explicit absolute-temperature conversion. Negative Celsius is not negative absolute temperature. Reject below-zero-Kelvin initial temperatures and incompatible scalar units before allocating the grid.

Diffusivity has dimensions length²/time. The present unit catalog lacks a dedicated `m²/s` identifier. As in PP100's rate contract, a typed `{value,lengthUnit,timeUnit}` coefficient can normalize as `value*lengthScale²/timeScale` and display its physical role honestly; do not pretend it is a velocity or acceleration. A versioned catalog addition is an alternative if needed.

For temperature without specified density, heat capacity and physical thickness/cross-section, report **mean temperature** or a clearly labeled weighted scalar integral, not “energy conserved in joules.” For a concentration field, area/line integrals likewise need a thickness/cross-section before becoming a total amount. The scalar-diffusion model does not infer material constants, instrument calibration, uncertainty, tissue physics or experimental validity.

The first solver should reject missing/null cells. The existing spatial renderer preserves missingness, but that does not define a PDE boundary or obstacle rule at missing cells. Masks, holes and irregular geometry need an explicit later model; do not fill missing cells with zero or silently treat them as insulated.

## Existing code to reuse and boundaries to extend

- `shared/scientific-assets.ts` supports checksum-bound row-major tensors with at most 32,768 scalar values. `lib/assets/local.ts` seals immutable checked assets and retains provenance; derive displayed field assets through that path rather than declaring unverified imported tensors trusted.
- `shared/spatial-views.ts`, `shared/spatial-coordinates.ts` and `lib/spatial/model.ts` already handle calibration, physical coordinate frames, pixel/cell-center regions, finite geometry, bounded summaries and scalar units. A cell-centered field must set calibrated origin to the first **center**, with spacing `Δx,Δy`, rather than the domain face origin.
- `components/spatial-view.tsx` can render a checked two-dimensional tensor, preserve exact underlying values and inspect regions. A 1D field may use a labeled one-row raster plus a line plot; its synthetic display-row axis must not imply a second physical simulation dimension.
- Spatial viewing currently consumes one snapshot and does not implement time stepping or probe histories. Its active component key includes the asset checksum, so supplying each new snapshot as a new asset can remount local view state. Preserve selection/viewport through an outer stable grid identity or factor out a reusable raster surface; do not assume animation support already exists.
- `shared/semantic-selections.ts` already distinguishes physical time from authored steps and has physical-frame region selection. Tie a probe to the exact grid/cell or physical coordinate, and time to stored snapshot seconds. The field, selected-cell values and probe trace must use one result. Scrubbing a stored time should not run a new solver. If linking an intermediate time, disclose nearest stored time; no fabricated temporal interpolation.
- Register a separately versioned trusted field capability through the representation registry and a typed worker protocol. Reuse PP100's disposable-worker cancellation/stale-job checks and exact request/result binding. A generated widget may consume an explicitly bound result later; model-generated code is not the field engine.

Include equation/model ID, initial profile, boundary conditions, domain face origin/extent, cell-average convention, shape/order, coefficient units, chosen time step, actual final time, scheme version, stability number, snapshot schedule and limits in the reproducible result identity. Changing any of these invalidates corresponding computed results. Grid geometry changes must also invalidate or explicitly rebind probes/regions.

## Proposed budgets and recovery

A practical initial policy is at most 128 cells in 1D or 64×64 in 2D, at most 64 retained snapshots, and **at most 32,768 retained field scalars across all snapshots**. Thus 64×64 permits eight full snapshots, not sixty-four. Also cap total cell updates, step count, probe-history values, output bytes and wall time independently; for example, 10 million cell updates, 20,000 steps, a result below 3 MiB, and a disposable-worker deadline at most 30 seconds. These are unmeasured application-policy proposals, not claims that every largest combination will be fast.

Validate products and caps before allocation, count all actual updates, use two working buffers, and retain only the declared snapshot schedule. Exceeding a step/work/output budget returns a visible incomplete status and valid prefix; it must not claim the requested final time. Unsupported equations or boundaries, unstable settings, nonfinite coefficients/states, lost coordinate precision and impossible snapshot budgets stop explicitly. Cancellation terminates CPU work; older jobs cannot replace a newer result. Keep the source button, original request and prior valid field visible, labeling its older parameters.

Native checks should cover keyboard probe/time selection, small screens and enlarged text, simultaneous physical selection in field/trace, exact-value tables, cancellation, malformed/oversized requests, unstable settings and recovery after a parameter edit. Passing these authored analytic and invariant checks establishes a bounded scheme for the named model/boundary class; it does not establish a universal PDE solver or original-paper reproduction.
