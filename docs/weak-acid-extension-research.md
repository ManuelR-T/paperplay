# Bounded weak-acid equilibrium extension: research and proposed contract

Research date: 28 October 2026. Historical PP115 design research; the implemented module and exact limits are documented in [the extension kit](scientific-extension-kit.md). No executable extension, scientific validation receipt or experimental reproduction is claimed. No existing held-out evaluation outcome was used to design this example. Only this documentation file is added while PP113 remains frozen.

## Primary sources, admission and rights

1. [IUPAC Gold Book: pH, P04524](https://goldbook.iupac.org/terms/view/P04524), DOI `10.1351/goldbook.P04524`, online edition 5.0.0 (2025). The owner-published indexed term defines pH using dimensionless hydrogen-ion activity on a molality standard-state basis. A concentration logarithm is therefore a model approximation, not the definition of measured pH. Single-ion activity is also a conventional quantity: a computed concentration is not a traceable electrode measurement. Direct HTML/JSON retrieval returned HTTP403 during this research; do not claim a downloaded full term or bundle a fabricated source passage. The primary indexed definition was inspected; source-body admission for a downloadable Gold Book fixture remains a separate check.

2. [IUPAC Gold Book: acid dissociation constant, 15441](https://goldbook.iupac.org/terms/view/15441/html), DOI `10.1351/goldbook.15441`. Its indexed owner-published note distinguishes a standard-state-normalized dimensionless constant from a concentration expression with dimensions when standard concentration is omitted, and identifies the ionic-strength limitation when activity coefficients are neglected. Direct retrieval likewise returned HTTP403. The displayed unit header must not override the note: this extension should explicitly name its own concentration constant `Ka_c`, rather than silently treating a bare number as both thermodynamic and concentration-based.

3. [IUPAC Gold Book: autoprotolysis constant, A00532](https://goldbook.iupac.org/terms/view/A00532), DOI `10.1351/goldbook.A00532`. The indexed primary definition describes an activity product and identifies concentration products as approximations. The familiar rounded water value is a teaching convention at a specified temperature, not an all-temperature law. Direct retrieval was blocked. Individual Gold Book terms advertise CC BY-SA4.0 in the indexed plain-text record; inspect the exact retrieved term license before redistributing a saved excerpt. A bibliographic link does not grant collection-wide republication rights.

4. [IAPWS R11-24, Revised Release on the Ionization Constant of H₂O (2024), actual official PDF](https://iapws.org/technical-guidance/release/Ionization.download), [release record](https://iapws.org/technical-guidance/release/Ionization). The actual seven-page PDF was inspected. Page2 names a **dimensionless** water constant with molal reference state; page3 states its temperature/density formulation. This rules out labeling a fixed molarity-product parameter as the IAPWS implementation. The cover permits republication with attribution. A short faithful future source anchor is: “Ionization constant (dimensionless) of water”, page2, nomenclature. This supports the standard-state warning, not a claim that IAPWS specifies the weak-acid example or its synthetic constants. The extension will not implement the temperature/density formulation or claim its precision.

5. [IUPAC pH Recommendations2002 publisher record](https://publications.iupac.org/pac/74/11/2169/index.html), DOI `10.1351/pac200274112169`; [coauthor institution NIST bibliographic record](https://www.nist.gov/publications/measurement-ph-definition-standards-and-procedures-iupac-recommendations-2002). The NIST record was directly inspected and confirms the publication identity. The IUPAC PDF returned403; an indexed abstract is not evidence that its complete measurement protocol was downloaded. This is supporting terminology/metrology context, not experimental data for the fixture.

The future fixture should retain one short admitted original source anchor and separately mark the equations below, numerical scenarios and interpretive prompts as application-authored teaching content. No pH observations, titration readings, named-acid constants or experimental uncertainties are extracted from these sources. Source prose and numerical output must have different provenance. Links and attribution are sufficient for the research note; a distributable source fixture needs exact downloaded bytes/hash and its own rights record.

## Narrow scientific model

New domain: aqueous chemical equilibrium and conservation. This is not the existing kinetic reaction-chain ODE under a different name.

Assume one uncharged monoprotic acid HA in initially unbuffered water, complete mixing, fixed temperature298.15K, no added counterions/salt/base, no other equilibria, and equilibrium reached. Ignore activity coefficients and use a declared molarity model. This omission is visible even when the numerical solver converges.

Inputs are `C_T` (total acid, mol/L), `Ka_c` (conditional concentration dissociation parameter, mol/L) and `Kw_c` (water concentration-product parameter, (mol/L)²). Fix `Kw_c=1e-14 (mol/L)²` as a **rounded authored teaching parameter**, not a certified water measurement or an IAPWS evaluation. Choose generic synthetic `Ka_c` values, not an experimentally attributed acetate constant. Set a reference concentration `c°=1mol/L` explicitly.

Let `h=[H+]`, `o=[OH-]`, `a=[A-]`, `u=[HA]`. The authored concentration-model equations are:

- acid conservation: `u+a=C_T`;
- electroneutrality: `h=a+o`;
- water product: `h o=Kw_c`;
- acid dissociation: `h a=Ka_c u`.

Thus `a=C_T Ka_c/(Ka_c+h)`, `o=Kw_c/h`, and the unique physical root solves

`F(h)=h-Kw_c/h-C_T Ka_c/(Ka_c+h)=0`.

Multiplication gives the equivalent cubic

`h³+Ka_c h²-(Kw_c+Ka_c C_T)h-Ka_c Kw_c=0`.

These formulas are an application-authored derivation from the explicitly stated balance model, not quotations, extracted equations or evidence that an original experiment was rerun.

Report `pH_c=-log10(h/c°)` as **concentration-based acidity index (ideal-model approximation)**. The argument of the logarithm is dimensionless. Do not label it simply measured pH, or present a molarity/molarity-standard-state approximation as the molality-based IUPAC definition. If standard-state-normalized ideal constants are displayed, explicitly show `Ka_ideal=Ka_c/c°` and `Kw_ideal=Kw_c/(c°)²`; they remain ideal-model quantities. No activity-coefficient correction, molarity-to-molality conversion or precision pH calibration is performed.

## Bounded solver and numerical policy

Proposed admitted range: `0<=C_T<=0.1mol/L`, `1e-12<=Ka_c<=1e-2mol/L`, fixed positive `Kw_c` above and fixed temperature298.15K. These are engineering/model bounds, **not a guarantee of physical ideality** at the upper concentration. Reject nonfinite inputs, incompatible units, thermodynamic-activity constants passed as concentration constants, other temperatures, other solvents, charged/polyprotic acids, salt/buffer/titration mixtures and claimed measured pH. Retain the original source plus a named unsupported reason.

For the water-inclusive model, `F'(h)=1+Kw_c/h²+C_T Ka_c/(Ka_c+h)²>0`. A physical root is bracketed by `[sqrt(Kw_c), C_T+sqrt(Kw_c)]`; `C_T=0` has the exact water-only root. The bracket follows directly from the stated balances and is independent of an arbitrary initial Newton guess.

Implement safeguarded Newton or another explicitly bracket-preserving cubic-root calculation, with a strict bisection fallback for an unsafe Newton proposal. Do not use general complex Cardano expressions without addressing cancellation and root selection. Suggested engineering limits:64 scenario rows,128 root iterations per row,8192 scalar root evaluations overall,256KiB serialized request/result each, caller cancellation polled in every loop and a1s total wall ceiling. Publish actual convergence/budget status per scenario; incomplete rows are not successful equilibria. Root tolerance could be `absTol=1e-16mol/L` plus `relTol=1e-10`, accompanied by independently recomputed balance residuals. These are solver tolerances, not uncertainty in chemical predictions.

The useful quadratic approximation deliberately neglects water and solves `h²+Ka_c h-Ka_c C_T=0`. Its stable positive expression is `2Ka_c C_T/(Ka_c+sqrt(Ka_c²+4Ka_c C_T))`. Show it only as a named approximation for comparison; at extreme dilution its failure is educational. Never replace the full-model root silently, and never call `sqrt(Ka_c C_T)` exact: that additionally assumes weak fractional dissociation.

## Independent reference checks

Production and reference should not share a root routine, convergence decision or precomputed implementation output. Test a separately authored bisection of charge balance using a bracket and conservative iteration count, versus the production cubic solver. Independently recompute all four balances from returned concentrations. Check bracket membership, positivity, conservation and residual scales; a small cubic residual alone is inadequate near tiny concentrations.

Two hand-constructed rational oracles avoid computing expected roots with the production solver:

| Scenario | Inputs (molarity basis) | Independent expected values |
| --- | --- | --- |
| Water only | `C_T=0`, any admitted positive `Ka_c`, `Kw_c=1e-14` | `h=o=1e-7`, `a=u=0`, `pH_c=7` |
| Acid-dominated rational root | `Ka_c=1e-5`, `C_T=0.0010999989`, same `Kw_c` | `h=1e-4`, `o=1e-10`, `a=0.0000999999`, `u=0.000999999`, `pH_c=4` |
| Dilute water-sensitive rational root | `Ka_c=1e-7`, `C_T=4.5e-7`, same `Kw_c` | `h=2e-7`, `o=5e-8`, `a=1.5e-7`, `u=3e-7`, `pH_c=7-log10(2)` |

The rational scenarios were authored by satisfying the balances algebraically, not copied from laboratory readings. Add adversarial wrong roots/negative species, swapped mol/L and dimensionless constants, unit rescaling, species-total perturbations, cancellation, exhausted iterations and changed source/input hashes. Compare multiple concentrations across the water-sensitive transition. With fixed `Ka_c`, the implicit derivative gives `dh/dC_T>0`; test monotonicity as a supplementary property, not a substitute for the rational references. A successful numerical check establishes this declared finite model only.

## Public module seams and extension kit

Proposed small module: `shared/weak-acid.ts` (strict request/result schemas and policy), `lib/chemistry/weak-acid.ts` (trusted bounded calculation plus exact-result validation), `lib/representations/weak-acid-example.ts` (fixture/source/asset/plan binding), and one provider-free CLI that emits existing importable artifacts. Names are proposals pending implementation authorization.

A request should contain version, source ID/version/fingerprint, explicit model/constant conventions, scenario IDs, units and limits. Results include the exact request identity, actual row status/iterations, concentrations, acidity index, balance diagnostics and model limitations. A local computation receipt, if added, belongs to trusted code and is never scientific authority for a parsed JSON result. Unsupported requests return an inspectable finite rejection, not another engine.

Reuse the current public interfaces:

- `sealScientificAsset` / `validateScientificAsset` / `hasCheckedAssetIntegrity` from `lib/assets/local.ts`; table rows have stable scenario IDs, explicit units and `provenance.origin='illustrative'`. Store generated teaching values as authored calculations, never source-extracted observations.
- `validateRepresentationPlan` from `shared/representations.ts`; `buildRepresentation` / `executeRepresentation` from `lib/representations/lifecycle.ts`. Bind exact source anchors and checked result-table checksum.
- Existing `asset`, `statistical-chart`, `source-guide` and `composed-scene` view kinds. A scatter/line chart may compare full-model acidity indices and named approximations; mark series `illustrative`, with no OLS fit, uncertainty bars or observation counts. The accessible table exposes concentrations and residuals independently of color/animation.
- Existing `createCapabilityRegistry` (`lib/representations/registry.ts`) if a new executable capability is genuinely needed. A manifest cannot register a function or install a package. Prefer producing a checked table through the trusted module and rendering current views, which proves a fourth-domain extension without changing reader/planner switches. Document the optional executable-adapter seam separately.
- Existing coverage/fallback and experience/library export/import APIs preserve the source/evidence distinction and source-return action. The fixture CLI should write the current standard representation/experience files accepted by existing import controls; no new chemistry navigation branch or special reader button is required.

Manifest documentation should identify schema/version, entrypoints, declared behavior, supported asset/view kinds, units, input/output/work budgets, rights/attribution, independent tests, unsupported cases and trust boundary. The application-owned solver/validation/sealing are trusted reviewed code. A model may propose bounded inputs or isolated explanatory graphics; it cannot add acid species, change the equilibrium equations, register callbacks, install packages, grant source provenance or issue scientific-validation receipts.

A clean-install walkthrough should run the fixture CLI with no provider configuration, import the emitted standard artifact through the existing interface, compare the water-only and dilute scenarios, inspect table values, return to the exact source, change an authored concentration and rerun locally if that action is supported. Test malformed/version/units/budget rejection, source removal and reimport. Native-browser accessibility/layout measurements and any actual reference report remain required implementation evidence; this research note does not manufacture them.
