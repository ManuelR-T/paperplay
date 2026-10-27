# Formative reader evaluation — prepared, awaiting participants

Status: 0 participants and 0 observed sessions. The owner confirmed that no testers are available. GitHub #24 remains open; this protocol and the working application do not satisfy its real-participant criterion. No recruitment messages were sent.

## Question and participants

Can a reader identify an assumption, predict an outcome, and find the source evidence more easily using an augmented article? Recruit 3–5 consenting students or engineers who can read basic code/math. Record only an anonymous ID and broad self-reported familiarity; do not collect names, emails or recordings by default. Explain that the product is being evaluated, not the person, that answers can be wrong, and that participation can stop at any time. Recruitment and sessions are manual work when readers become available.

## Session procedure, fixed before the first participant

1. Explain the task and request consent to keep anonymous written observations. Use the same browser/viewport and a fixed source/app revision where possible.
2. Assign source-only then augmented, alternating order across successive participants. Use paired tasks from the same family to reduce direct answer recall; record the actual order. This is a small formative comparison, not a randomized effectiveness trial.
3. Ask the reader to predict the result before changing inputs, explain why, and point to source evidence. Then let them explore freely. Do not coach them toward the expected answer; record any assistance.
4. Measure elapsed task time from the explicit start to the reader's answer or declared stop. Separately record time to locate the relevant passage, interpretation errors, widget usefulness, inaccessible controls and source-return failures. Missing measurements remain null.
5. Ask what they believe was computed, illustrated or reported by the paper. Record any confusion in their own words and its exact source/widget state.
6. End with one question about the hardest moment and one proposed improvement. Export an anonymous record and create follow-up issues only for actual findings. Repeat a corrected task only when the participant agrees, recording it as a repeat.

## Frozen tasks and expected answers

| Family | Task | Expected reasoning/reference |
| --- | --- | --- |
| Shortest path | For the teaching graph with S→A=19, S→B=1, B→A=2 and A→T=1, predict the shortest S→T path. Find the source passage supporting relaxation. | Distance 4 through S→B→A→T; taking the currently smallest direct-to-target edge is not the algorithm. These are synthetic graph values, not paper measurements. |
| Quadratic optimization | For A=diag(1,4), b=(1,4), x₀=(2,−1), and α=0.2, predict one gradient step and locate the corresponding equation. | x₁=x₀−α(Ax₀−b)=(1.8,0.6). Explain which quantities are source notation versus chosen teaching values. |
| Bayesian update | Begin with Beta(2,2), observe six successes and two failures, and predict the posterior mean. Distinguish analytic density from sampled frequency. | Posterior Beta(8,4), mean 2/3. A finite seeded sample/interval estimate is not an exact reported study result. |
| Toy attention | Compare identical-query/key dot products before and after masking one key. Predict normalization and identify the weighted-value equation. | Unmasked weights sum to one; masked entries receive zero; a completely masked query is invalid rather than a fabricated zero-output success. Toy matrices are not learned embeddings or Transformer training. |

Prepare a paired variant by changing only explicit teaching inputs, with its independent expected answer recorded before the session. Give source-only readers the actual source reference and selected equations, not the widget's computed answer. Keep task text, input, seed, engine/widget version and order in each observation.

## Recording and interpretation

Use [reader-study-observations.json](reader-study-observations.json) as the empty real-session ledger. For each actual task append: anonymous participant ID, consent, condition/order, source/app version, task/input, elapsed/source-location seconds or null, answer, expected answer, assistance, observed confusion, source evidence found, computed/illustrative distinction and suggested fix. Mark test fixtures separately and never append them to this ledger as participant evidence.

Review failures before looking for aggregate improvements. A wrong scientific interpretation, inaccessible essential control or lost source reference is a defect even if the animation was liked. Summarize actual counts and individual observations; avoid causal learning-gain claims, statistical significance or percentages without denominators. If recruitment remains unavailable, report the protocol and developer self-review separately and leave #24 open.
