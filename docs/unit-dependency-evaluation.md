# PP-084 unit dependency evaluation

Reviewed 28 October 2026. Scope: local, provider-free quantity contracts and bounded SI conversion; no universal symbolic algebra.

## Decision

Use a small, explicit, reviewed unit catalog behind a conversion adapter for the first implementation. Keep versioned plain JSON contracts owned by Paperplay. This recommendation is an engineering judgment: neither a general mathematics dependency nor a unit-only library removes the need for application rules about temperature points, coordinate frames, field layouts and uncertainty. Reconsider a pinned dependency when actual required unit coverage or numerical operations exceed this bounded catalog.

## Scientific rules

The SI retains seven base units and treats them as dimensionally independent: metre, kilogram, second, ampere, kelvin, mole and candela. Represent dimensions as named exponents rather than inferring them from labels. Equal dimensions are necessary for conversion/addition, but do not establish identical scientific meaning (a quantity kind remains useful metadata). [BIPM SI overview](https://www.bipm.org/en/measurement-units/), [SI Brochure, current edition](https://www.bipm.org/en/web/guest/publications/si-brochure).

Celsius temperatures obey `T/K = t/°C + 273.15`; intervals of one Celsius degree and one kelvin have equal magnitude. Therefore convert temperature points with an offset and temperature differences with scale only. Recommended operation policy: point minus point returns a difference; point plus/minus difference returns a point; difference plus difference returns a difference; reject point plus point and implicit multiplication of points. The arithmetic policy is our explicit contract choice, motivated by the distinct SI point/interval semantics. [BIPM SI Brochure, temperature discussion](https://www.bipm.org/utils/common/pdf/si-brochure/SI-Brochure-9.pdf), [NIST SI relationships](https://www.nist.gov/publications/si-base-units-relationships-poster).

## Options checked

| Option | Evidence and consequence |
| --- | --- |
| Pin broad `mathjs` | Provides units, dimension comparison, SI conversion and matrix arithmetic. Its unit grammar differs from its expression grammar, so it should not replace the existing widget AST. Its documentation warns about surprising Celsius/Fahrenheit arithmetic; temperature point/difference rules still belong in our adapter. [Unit API](https://mathjs.org/docs/datatypes/units.html). |
| Restrict a `mathjs` build | Supports dependency collections and tree shaking, but polymorphic functions can pull in several data types. No project-specific bundle size has been measured. [Custom bundling](https://mathjs.org/docs/custom_bundling.html). |
| Persist library objects | `Unit` has JSON serialization, while reconstruction uses library-specific revivers; special numeric values require care. Prefer validated application JSON and reconstruct adapter values transiently. [Serialization](https://mathjs.org/docs/core/serialization.html). |
| Expose a broad parser | Official guidance flags security/resource risks and functions that should be restricted. A published parser vulnerability affecting versions before 15.2.0 reinforces the need to verify and pin a reviewed release if adopted; avoiding the parser avoids that particular interface, not every possible dependency risk. [Security guide](https://mathjs.org/docs/expressions/security.html), [maintainer advisory GHSA-5v89-rwgr-qj6g](https://github.com/josdejong/mathjs/security/advisories/GHSA-5v89-rwgr-qj6g). |
| Pin narrower `unitmath` | Supports immutable conversions/arithmetic, dimensional compatibility and custom definitions with built-ins disabled. Its unit grammar allows one slash and ignores parentheses; this is another reason to keep input as explicit unit IDs. It remains a plausible future conversion backend, not a replacement for Paperplay quantity/coordinate contracts. [Official README](https://github.com/ericman314/UnitMath). |
| Explicit catalog/adapter | Finite conversion rules are easy to review against SI references; unsupported units fail visibly. Costs: Paperplay owns catalog correctness, test coverage and future additions. No arbitrary unit-expression parser, symbolic simplifier or dynamic registration is needed. |

The inspected upstream mathjs development manifest reports 15.2.0, Apache-2.0, ESM/CJS exports and TypeScript declarations; that inspection is not a claim that it is the latest published npm release or has been validated against this project's toolchain. UnitMath's inspected manifest reports 1.1.1 and Apache-2.0 with TypeScript declarations. [mathjs manifest](https://raw.githubusercontent.com/josdejong/mathjs/develop/package.json), [UnitMath manifest](https://github.com/ericman314/UnitMath/blob/master/package.json).

## Bounded implementation and extension seam

- Define a documented finite catalog of SI bases, selected prefixes and required derived units; store each unit's stable ID, dimension exponents, scale and optional temperature-point offset. Reject unknown unit IDs and incompatible dimensions. Use `base = value * scale + offset` for points and omit offset for differences.
- Keep scalar, vector, matrix and field shape/layout explicit. Convert every value component consistently; validate rectangular matrices and field component counts. Coordinate axis order, axis direction, frame identity, origin and handedness are separate metadata. Unit conversion alone must never imply a frame transform.
- Preserve uncertainty as explicit metadata with its interpretation and provenance. A standard deviation or absolute error scales by the absolute conversion scale without a temperature offset; relative uncertainty and confidence bounds need their own declared interpretation. Do not claim general uncertainty propagation or infer independence/covariance.
- Keep the existing evaluator's `[length, time, mass]` ordering, bounded AST, fractional dimensions from square roots, integer unitful-power restriction, domain checks and operation budgets. Its current source is [lib/widgets/expression.ts](../lib/widgets/expression.ts). Extend via a deliberate adapter rather than silently changing existing expression semantics.
- Keep catalog lookup, dimensional comparison and conversion behind small functions. A later pinned library can implement those functions while persisted quantity IDs and shape/coordinate/uncertainty contracts stay stable. Evaluate compatibility, affine temperatures, serialization round trips, parser exclusion and actual production bundle impact before adoption.

Limits: a finite catalog does not cover all scientific units; dimensional compatibility does not prove physical validity; numeric conversion uses ordinary floating-point precision. This layer does not establish geodetic transformations, tensor basis transformations, field interpolation, symbolic equivalence or statistical propagation. Those need explicit future capabilities and evidence.
