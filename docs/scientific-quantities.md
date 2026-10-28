# Quantities, dimensions and coordinates (PP-084)

The implementation follows the [primary-source dependency evaluation](unit-dependency-evaluation.md): a finite SI catalog with plain versioned JSON, a small conversion/binding interface, no general expression parser or new dependency. Unsupported unit IDs remain explicit errors; scientific meaning is not inferred from a unit label.

## Contracts and conversions

`shared/scientific-quantities.ts` defines version-1 scalar, vector, rectangular matrix and field quantities with catalog version `1.0.0`. Every value is finite, each quantity has one declared unit, and quantities are bounded to 32,768 components. Fields use declared axis order with the last axis varying fastest. Heterogeneous-unit vectors, symbolic unit algebra and arbitrary unit strings are not part of this interface.

The catalog covers seven SI base dimensions in `[length, mass, time, current, temperature, amount, luminous intensity]` order, selected prefixes, volume, concentration and selected derived units. Stable ASCII unit IDs have readable symbols. The existing widget evaluator's three-dimension `[length, time, mass]` semantics and dimensionless custom models remain unchanged.

`convertQuantity` converts values with matching dimensions and retains shape. Standard uncertainties scale as differences, without an affine offset; interval endpoints follow the declared quantity semantics. Uncertainty must have the same component count as the quantity. This does not infer covariance, independence, confidence level or scientific validity. Combining uncertain quantities requires an explicit model and is refused by the basic arithmetic helper.

Absolute temperatures and temperature differences are distinct. Celsius points convert with 273.15; differences use scale only. Point-minus-point returns a difference, point-plus/minus-difference returns a point, point-plus-point is rejected, and absolute values below zero kelvin fail. Index coordinates cannot become physical length through unit conversion; a calibration is required.

`bindScientificQuantity` is the preflight interface for view/solver adapters: exact kind/shape, declared frame, compatible dimensions, explicit temperature interpretation and matching field coordinates. It returns converted values only after the checks. Numerical solvers are separate subsequent issues; dimensional compatibility alone does not authorize a solver or prove a model.

## Coordinates

Field coordinates identify a frame, coordinate convention, axis order, origin, positive spacing, sampling direction and handedness. Converting coordinate units preserves frame/direction and does not rotate, reverse data, resample or perform a geodetic/tensor-basis transformation. Adapter binding requires compatible frame/axes and can normalize an equivalent coordinate description into the requested units.

Coordinate comparison uses a small floating-point tolerance, additionally bounded to one billionth of local grid spacing. A large coordinate origin cannot mask a meaningful grid displacement through an overly loose relative comparison. Cases beyond floating-point resolution require an explicit alternative representation/capability.

## Reader-facing paths

A representation can declare a measured quantity and a `quantity-inspector@1.0.0` view with its expected shape/unit/frame. Missing measurements produce a named data gap. Incompatible dimensions, shapes or coordinates fail before execution. Preview/export retain original values and requested conversions, and display units and supplied uncertainty. Per-quantity provenance remains unverified unless an application-owned independent check establishes its precise scope.

The local data-import preview also provides **Declare or convert column units** for numeric columns. Declaring unspecified units leaves values exactly unchanged and records a reader assumption. Converting already specified units changes values, retains missing cells and the original file digest, and records a new manifest checksum and transformation. Temperature interpretation must be explicit. Checksum-bound required input is not edited silently.

**Download data asset** preserves derived data, unit declarations and transformations. Large representation exports may reference this separate file; retaining only an earlier raw CSV would not preserve a later conversion. No source data, notes or original snapshot semantics are rewritten, and these interactions make no inference request.

## Verification and limits

Tests use independent SI examples, affine temperatures and differences, compatible/incompatible addition, shape preconditions, standard/interval uncertainty, field frame/direction/origin checks, large-coordinate displacement, exact identity conversions and portable converted-data/quantity round trips. Existing expression and widget reference suites remain part of the full check.

Ordinary floating-point precision applies. The layer is a bounded quantity/coordinate contract, not universal dimensional analysis, covariance propagation, field interpolation or a scientific reproduction certificate.

Verified 28 October 2026: strict TypeScript, 243 tests and production build passed. Native Chromium at 320 px showed the Celsius/Kelvin quantity and standard uncertainty, declared a CSV column as cm with values unchanged, converted cm to m, rejected m-to-seconds while retaining valid data, and reopened the downloaded converted asset with its nulls and transformation history. No paid inference was used.
