# Add a scientific capability through existing public interfaces

The weak-acid example adds a fourth domain, chemistry, using a trusted bounded calculation and the existing source-guide, checked-table, statistical-chart and semantic-selection formats. It adds **no discipline switch, reader branch, planner prompt, generated SDK method or automatic inference call**. The numerical model is chemical equilibrium, not the existing reaction-chain time integrator renamed.

## Run the example on a clean installation

The checked-in [weak-acid fixture](../data/weak-acid-example.json) opens through the existing importer. To regenerate or change it, use the repository's pinned Node version and normal dependency installation. No provider key or network access is required by this fixture command:

```sh
npm run example:weak-acid -- \
  --output=/tmp/weak-acid-study.json \
  --experience=/tmp/weak-acid-experience.json \
  --request=/tmp/weak-acid-request.json \
  --report=/tmp/weak-acid-engineering-report.json
```

Output files are created exclusively: an existing file is retained and produces an error. Without `--output`, standard output contains the data-study JSON. The CLI never reads provider configuration or credentials.

Open `/tmp/weak-acid-study.json` through the existing **Data study** file import, or `/tmp/weak-acid-experience.json` through the existing **Experience** import. The first is `paperplay-data-study` version2. The second is the existing scientific-experience format, with the small source excerpt and checked illustrative asset explicitly included, but no scientific-validation report or execution authority. Both reopen locally using current generic interfaces.

Inspect the concentration chart, select an authored scenario, inspect the accessible table, and use the source-return action. The table contains water-only and two hand-constructed algebraic reference cases as well as a synthetic concentration sweep. Species and balance residuals are available as numbers; neither color nor animation is needed to read the results. All series are illustrative and have no sample counts, fitted inference, error bars, significance claims or scientific verification badges.

For a local rerun, edit the emitted request JSON (for example, change an admitted synthetic concentration), retain the exact source binding/model units, then use a new output filename:

```sh
npm run example:weak-acid -- \
  --input=/tmp/edited-weak-acid-request.json \
  --output=/tmp/weak-acid-edited-study.json
```

This is an explicit CLI recalculation. Reopening, selecting chart points, inspecting values and reading the imported file do not call the chemistry solver or a provider. The chart groups positive-concentration scenarios with the first positive scenario's exact authored `Ka_c`; other constant groups remain visible in the table. With only water cases, the unavailable logarithmic concentration chart is omitted, and the table/source guide remain available.

## Public extension module

`lib/extensions/weak-acid.ts` exports:

- `WEAK_ACID_EXTENSION_MANIFEST`: immutable application-owned metadata describing version, entrypoint, units, bounds, view/data kinds and unsupported cases. Importing a JSON copy of this manifest cannot install a function or grant access.
- `weakAcidScenarioSchema`, `weakAcidRequestSchema`, `weakAcidResultSchema` and inferred types. The request uses the namespace `paperplay-extension-weak-acid`, schemaVersion1 and moduleVersion1.0.0; it does not add a new reader/planner discriminant.
- `createWeakAcidRequest(source, scenarios, limits?)`: constructs a unit-explicit request with source ID/version/fingerprint. Scenarios have stable IDs and explicit authored labels, total concentration and conditional concentration constant.
- `solveWeakAcid(request, {source?, signal?, now?})`: trusted, deterministic finite host calculation. Pass the actual `source` when producing a bound study, as the example does, to check its exact fingerprint; an omitted source does not independently authenticate the request's declared source fields. `now` is a trusted test clock, never serialized into the request. The input is cloned by strict parsing before asynchronous hashing.
- `checkWeakAcidResult(result, expectedRequest, {signal?})`: separate bounded charge-balance bisection and recomputation of returned values/balances. Returns an engineering report only, never a scientific-validation WeakSet receipt. A parsed or self-hashed imported result does not become trusted execution or original scientific evidence.

`lib/extensions/weak-acid-example.ts` exports `createWeakAcidSource()`, `defaultWeakAcidScenarios()` and `createWeakAcidExample({request?, signal?})`. The latter returns `{source, request, result, referenceChecks, assets, plan, dataStudy, experience}`. Incomplete solves/reference checks do not become complete assets: the helper refuses to emit the teaching study. Direct solver callers retain the finite incomplete result and its null-valued unresolved rows.

The module seals the resulting illustrative table with `sealScientificAsset`. It validates its current standard plan using `validateRepresentationPlan`, uses `representationInputRevision` for chart entity navigation, serializes with `serializeDataStudy`, and bundles with `createScientificExperience`. `parseDataStudy`, `parseScientificExperience`, `buildRepresentation` and `executeRepresentation` are unchanged. Tests exercise these actual import/execute interfaces with checked assets and `evidence.verified=false`.

A new domain can follow this pattern without changing a central discipline map: specify a narrow request, produce a supported checked data kind, bind an existing view, and keep source/evidence declarations explicit. A new executable adapter is optional. If genuinely needed, register reviewed application code through `createCapabilityRegistry` with a versioned descriptor, resource limits, facility requirements and a supported view contract. A registry descriptor is not a sandbox, and an imported manifest never installs executable code.

## Chemical scope and units

The declared model is one uncharged monoprotic acid HA plus water, homogeneous equilibrium at 298.15 K, with no salt, counterions, added base, buffers, extra equilibria or activity corrections. Concentrations are in **mol/L**. `Ka_c` is an authored conditional concentration parameter in mol/L. `Kw_c=1e-14 (mol/L)^2` is a fixed rounded teaching parameter; it is not the dimensionless molal-standard-state IAPWS water constant.

The concentration-based acidity index is `-log10(h/(1 mol/L))`. It is dimensionless, but **is not measured activity-defined pH**. Neither activity coefficients nor molarity-to-molality conversion is supplied. Numerical convergence does not remove this physical approximation or establish uncertainty in a chemical prediction.

The authored balance model is `u+a=C_T`, `h=a+o`, `h o=Kw_c`, and `h a=Ka_c u`. Its physical root satisfies `h-Kw_c/h-C_T Ka_c/(Ka_c+h)=0`, equivalently the declared cubic. The trusted solver preserves the physical bracket between `sqrt(Kw_c)` and `C_T+sqrt(Kw_c)`, attempts a safeguarded cubic Newton step and bisects when unsafe. Stable product/ratio formulas recover species without subtracting nearly equal concentrations. The separately labeled quadratic comparison omits water and is not substituted for the full model. Its water-only logarithm is undefined and stored as null, not zero.

Admission limits are64 scenarios, `0<=C_T<=0.1mol/L`, `1e-12<=Ka_c<=1e-2mol/L`,128 iterations per row,8192 compound root trials overall,1s wall ceiling and256KiB request/result limits. One trial evaluates the cubic, its derivative and charge residual; this counter is not a total count of JavaScript instructions or floating-point operations. Root termination uses bracket width `<=1e-18mol/L+1e-12*max(|lower|,|upper|)` or an exactly zero floating-point charge residual. These are numerical engineering tolerances, not experimental uncertainties or a physical-ideality guarantee at high concentration.

Unsupported constants/units, temperature, mixture types and oversized inputs are rejected explicitly. Budget/iteration exhaustion and cancellation return finite incomplete statuses; unresolved concentrations remain null, and later scenarios are not silently counted as solved. There is no arbitrary chemistry language, imported RHS, code evaluation or network provider. The synchronous small calculation uses cooperative polling; no browser-process heap cap or independent Worker interruption is claimed for this CLI-first extension.

## Source, rights and independent references

The source card retains the exact five-word quote “Ionization constant (dimensionless) of water” from page 2, section 1 nomenclature of the [official IAPWS R11-24 release](https://iapws.org/technical-guidance/release/Ionization.download). The actual 7-page PDF inspected 28 October 2026 had 788267 bytes and SHA256 `7e0dc09f7ed9e1927c904d44644a9f6664440d0e5e1f58799e683bcb341a278c`. Its cover permits republication with attribution to IAPWS. No full PDF is bundled. Logical source-card page 1 is explicitly distinguished from original printed page 2.

That quotation supports only the dimensionless-constant/standard-state distinction. The monoprotic-acid equations, concentration approximation, constants, sweep and examples are separate application-authored content. They are neither extracted IAPWS numerical results nor observations. Current direct Gold Book endpoints were inaccessible during research, so no invented downloaded Gold Book source is shipped. The [primary-source research note](weak-acid-extension-research.md) records pH/activity terminology and access limits.

`tests/weak-acid-extension.test.ts` includes independently hand-constructed rational species/root references, a separate charge-balance bisection across the declared range, source/input mutation checks, forged completed values with zero claimed residuals, incorrect units/physical domains, cancellation/work limits, existing importer/adapter round trips and a network-disabled CLI subprocess. The rational dilute case explicitly exercises water contribution. Numerical reference reports do not authenticate an original experiment or restore scientific receipt authority after export/import.

## Trusted and generated roles

The solver, strict model schemas, balance checks, asset sealing, result-to-view binding and source mapping are reviewed application code. A generated widget still receives only its declared checked data and isolated drawing/control SDK. It cannot import this host module, invoke its solver, add a chemical species or reaction, install dependencies, change trust policies or issue verification receipts. Adding chemistry does not expand Muse's privileges.

Native-browser layout/accessibility and source-return observations belong to the implementation's recorded QA, not to the manifest. Keep those reports separate from chemical-model validation, report failures without evidence promotion, and retain the original source or a named unsupported fallback whenever the requested model is outside this finite scope.
