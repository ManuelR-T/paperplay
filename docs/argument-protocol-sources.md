# PP-092 argument and protocol source admission

Checked 28 October 2026 against [the frozen corpus](../data/scientific-corpus.json) and [its source brief](scientific-corpus-sources.md). P2, B1 and the optional B4 alternative are all **development** papers. No held-out source is used. Steps below are authored paraphrases or explicitly marked algebraic examples, not source quotations or independently reviewed scientific conclusions. No experiment, inference run or expert review was performed.

## P2 — theoretical argument

J. S. Bell (1964), **On the Einstein Podolsky Rosen paradox**, DOI `10.1103/PhysicsPhysiqueFizika.1.195`. [Publisher metadata/rights](https://journals.aps.org/ppf/abstract/10.1103/PhysicsPhysiqueFizika.1.195); [inspected original article scan](https://csiflabs.cs.ucdavis.edu/~gusfield/Bell-paper.pdf). The CERN copy currently challenges access; it was not used to assert new locators.

Verified locators: **§II, pp. 195–196, equations (1)–(3); §IV, pp. 197–198, equations (12)–(15)**. Original p. 198 was visually checked because text extraction omits mathematical symbols.

One quotation, **18 whitespace-delimited words**, §IV, printed p. 199, immediately before §V:

> Thus, the quantum mechanical expectation value cannot be represented, either accurately or arbitrarily closely, in the form (2).

Authored argument structure:

| Step | Content and source locator |
| --- | --- |
| Assumptions | Settings are unit vectors; outcomes `A(a,λ), B(b,λ)` are ±1. The remote setting is excluded; the normalized distribution `ρ(λ)` is shared across settings. §II (1)–(2), §IV (12). |
| Prediction | `P(a,b)=∫ρ A(a,λ)B(b,λ)dλ`; the singlet prediction is `−a·b`. §II (2)–(3). |
| Constraint | Perfect equal-setting anticorrelation gives `B(a,λ)=−A(a,λ)` almost everywhere. §IV (13)–(14). |
| Bound | `1+P(b,c) ≥ abs(P(a,b)−P(a,c))`. §IV (15). |
| Authored example | Coplanar settings at 0°, 60°, 120° give quantum-prediction values `Pab=−1/2, Pac=+1/2, Pbc=−1/2`; the bound would require `1/2≥1`. This substitution is our explanatory calculation. |

Scope: this walkthrough covers the ideal exact-correlation argument. The stronger approximation argument following (15) needs separate steps. It is neither CHSH nor a detector experiment; no loophole closure or signaling claim follows from the illustrative calculation.

Rights: publisher marks the article free to read and © 1964 Physics Publishing Co.; **no broad republication license established**. Use metadata, links, this bounded excerpt and clearly authored explanation; do not bundle the scan or copied figures.

## B1 — incomplete experimental-protocol reconstruction

A. L. Hodgkin and A. F. Huxley (1952), **A quantitative description of membrane current and its application to conduction and excitation in nerve**, DOI `10.1113/jphysiol.1952.sp004764`. [Publisher](https://onlinelibrary.wiley.com/doi/pdf/10.1113/jphysiol.1952.sp004764); [inspected original published scan](https://web.njit.edu/~matveev/Courses/M430_635_F15/HodgkinHuxley_JPhysiol-1952.pdf). Use the 1952 edition, excluding the 2019 supplement.

Verified locators: **p. 518, Part III opening; p. 519, membrane-current comparison; Figure 11 and caption, p. 521**. Figure 11 was visually checked at PDF page 24, counting the scan's two cover pages.

One quotation, **18 whitespace-delimited words**, Figure 11 caption, printed p. 521:

> Right-hand column: observed time course of membrane currents during voltage clamp. Axon 31 at 4° C; compensated feedback.

Authored stages, deliberately incomplete:

| Stage | Supported content |
| --- | --- |
| Conditions | Identify axon 31, 4 °C and compensated feedback from Figure 11. |
| Intervention/observation | Voltage-clamp conditions and membrane-current time courses are paired in the figure's right column. |
| Comparison | Calculate separate model currents from equation (26) and subsidiaries; compare with observations. p. 519 / Figure 11. |
| Interpretation | Preserve each trace's voltage and changing time/current scales; never label calculated left-column curves observed. |

This is **not a complete laboratory SOP**. Part III explicitly refers to voltage-clamp records in earlier papers. B1 alone does not supply a stand-alone preparation, solution recipe, electrode/feedback construction, calibration, acquisition timing, repeat schedule or acceptance criteria. Those fields must remain missing; do not fill them with plausible laboratory instructions. Its numerical integration procedure, pp. 523–524, is a computational method, not the omitted wet-lab protocol.

Rights: no general reuse license established; the inspected scan carries reproduction restrictions. Keep the short excerpt and links; no figure pixels or full paper are admitted by this note.

## B4 — openly licensed computational-method alternative

John Jumper and coauthors (full author roster in [the corpus](../data/scientific-corpus.json)), **Highly accurate protein structure prediction with AlphaFold** (2021), DOI `10.1038/s41586-021-03819-2`, version of record 18 August 2021. [Primary publisher source](https://www.nature.com/articles/s41586-021-03819-2).

Verified publisher-indexed body locators: **Methods → Inference regimen**, first paragraph; **Methods → Inputs and data sources**; **Data availability** and **Code availability**. Direct page access can challenge browsers; the original publisher's indexed method text was inspected.

One quotation, **19 whitespace-delimited words**, first paragraph of Inference regimen:

> We inference the five trained models and use the predicted confidence score to select the best model per target.

Authored stages: prepare sequence/MSA/template inputs; declare the specific configuration and database versions; run the trained models; select by predicted confidence; distinguish database search and structural relaxation from neural-network inference. Keep the CASP14 ensemble configuration distinct from the later non-ensemble configuration described in that section. Missing local inputs: model parameters, exact executable version, databases, target sequence and adequate compute. Their omission here does not mean they were unavailable publicly.

The article is explicitly **CC BY 4.0**: attributed reproduction/adaptation is allowed, with a license link and change notice; third-party exceptions require separate checks. Code, weights and database licenses are separate. This is a computational inference protocol, **not** a wet-lab structure-determination experiment or a CASP reproduction. [Publisher rights and methods](https://www.nature.com/articles/s41586-021-03819-2), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Authoring recommendation

Use Bell for the argument fixture. Use HH for an explicitly **partial experimental-protocol explanation** that exposes missing details. If the product needs a richer licensed procedural fixture, add B4 under a computational-method label; do not silently substitute it for a fully specified laboratory protocol. Keep every quote, paraphrased step, assumed input, missing requirement and calculated example distinguishable. These admissions establish source grounding, not scientific verification or expert approval.
