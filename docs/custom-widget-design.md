# Meta-designed teaching widgets

Catalog 2.1.0 adds `kind: custom` inside the existing version-2 widget envelope. A custom widget is a new declarative state model and drawing, not a new trusted application engine. Meta first prefers an existing specialized form. When those forms cannot express the selected mechanism, it can propose a program with a specific `catalogGap`, source quote, mapping, parameters, recurrence, metrics and scene. The reader inspects and explicitly accepts it through the existing proposal workflow. Repairs, settings diffs, local undo and export use the same contracts.

## Extension interfaces

1. `getWidgetDesignCapabilities()` in `lib/widgets/design-capabilities.ts` provides the actual catalog, templates, expression grammar, runtime semantics and bounds. Both the Meta prompt and `GET /api/widget-capabilities` consume this hook. The discovery response contains no source, provider credentials or job capability.
2. `customWidgetRuntime` in `lib/widgets/custom-runtime.ts` exposes `version`, `validate`, `execute` and `describe`. The browser calls the same evaluator in the existing cancellable worker; the server evaluates the initial complete bounded trajectory before accepting a proposal. Another runtime version requires an application implementation and compatibility decision, not a model-supplied script.
3. `CustomWidgetReview` in `lib/enrichment/contracts.ts` is an optional trusted application policy hook, injected through `createEnrichmentHandlers({reviewCustom, ...})`. It receives frozen candidate/source copies. Throwing rejects that candidate while preserving other grounded proposals. It cannot grant scientific verification through the widget format.
4. `CustomScene` renders only the runtime's evaluated primitives. New visual primitives require a schema, evaluator/renderer implementation, manifest update and checks. The paper reader itself needs no algorithm-name branch.

Example additional application policy:

```ts
createEnrichmentHandlers({
  getConfig: serverMetaConfig,
  reviewCustom: (candidate, context) => {
    if (candidate.steps > 40) throw Error('This installation requires a smaller reviewed teaching model.');
    // Inspect candidate.mapping and context.quote; never rewrite the source.
  },
});
```

## Program semantics

- Initializers see parameters only. Every register update sees the same **previous** register values and previous `step`. There are no same-step dependencies or hidden evaluation order. To express `wNext = w - alpha*zNext`, substitute the `zNext` expression into the update for `w`.
- Current-state metrics are computed after the simultaneous update. Scene and optional plot expressions can also reference those metrics. All names are unique; `step` is reserved.
- Up to 8 dimensionless parameters, 8 registers, 8 metrics, 120 updates and 24 marks. The complete program has at most 768 AST terms and 80,000 allowed evaluations; each expression retains the existing depth/node limits. Values must be finite with absolute value at most 1e9. Canvas coordinates are bounded to ±10,000; radii/extents are nonnegative and at most 2,000.
- Arithmetic uses the declared AST operators. There is no `eval`, dynamic function construction, generated React/HTML/SVG markup, package loading, filesystem or network access. Shape types are circle, rectangle, line and text; paints are palette tokens.
- Each frame has named numerical metrics and accessible scene-element values. The camera fits all recorded frames once, so stepping does not move the axes or hide a point outside the original reference rectangle. Keyboard controls can select a mark and seek a frame. Parameter edits replace stale computation; reset and portable snapshots retain the exact program/source/runtime version.
- Unit strings on metrics are descriptions. Runtime v1 computes dimensionless arithmetic and does not certify dimensional consistency, physical stability, algorithm fidelity or scientific validity. A matching source quote proves location, not correctness of the generated model.

The compiled result is deterministic for a given program. The envelope retains its seed for compatibility; runtime v1 provides no random primitive. There is no recursive model repair loop. Unsupported or invalid designs are rejected per proposal; the previous valid widget and original source remain available.

## Compatibility

Widget envelope version 2 and legacy engine/source/snapshot version 1 remain unchanged. Existing catalog-2.0 enrichment caches open under the additive 2.1 catalog without rewriting their original records on load. Unknown future catalog/runtime versions fail explicitly. The widget worker URL carries catalog version 2.1.0 so an older worker cannot silently handle a custom program.

## Verification

`tests/custom-widgets.test.ts` independently checks simultaneous recurrence values, common-frame geometry, numerical/domain/budget failures, arbitrary-code/unknown-runtime rejection, immutable review hooks and per-proposal rejection, compatibility and exact snapshot state. The existing actual bundled-worker suite now includes the custom runtime.

One explicit official Meta check generated a custom scalar momentum model from Goh's selected recurrence, rather than a prepared oscillator fixture: **1 creation, 5,564 input / 3,000 output / 8,564 total reported tokens**. [Retained generated design](custom-design-live-check.json). It uses the required substituted new-momentum expression in the position update. A separate recurrence oracle checks all 21 frames under three parameter configurations. This validates that frozen scalar example, not arbitrary future generated programs or the original article's experiments.

`npm run check:custom-design` makes no inference. `-- --live` explicitly allows one creation and retains a private checkpoint; completed or accepted work is reused, and uncertain submission is not replaced automatically. Routine tests/CI never run paid checks. There are no reader-study participants in this evidence.

The final provider-free suite has 192 passing tests, with strict TypeScript and the production Next build checked. At 320 CSS px, the actual Meta-authored widget passed targeted axe WCAG 2/2.1 A/AA checks in light, sepia and contrast themes (23 passes, zero violations per theme). These are developer checks, not assistive-technology certification. [Combined figure/design observations](original-figures-custom-design-qa.json).
