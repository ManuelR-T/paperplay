# M4 — evaluation and delivery evidence

Checked 27 October 2026. Paperplay now has a working local production build, a deployed private Sites application with shared D1 storage, official Meta inference evidence and an English demonstration script. The final current-root check passed strict TypeScript, **134 tests** and the optimized production build. The isolated clean-source proof retains its earlier **133-test** snapshot rather than being rewritten as a later run.

This report records developer/team self-review and observed software behavior. No student study, independent accessibility audit or measured learning outcome occurred. The user explicitly chose to retain private access; judge invitations/access checks and authenticated portal acceptance remain external handoff items, not completed product tests.

## Evaluation — PP-034

The [frozen held-out baseline](evaluation-m4-baseline.json) and [review](evaluation-report.md) cover unfamiliar Theta*, timestamp-optimal Dijkstra and Attention papers using the actual production import/Meta/validation pipeline. The pre-M5 prompt, catalog, schema, source hashes and `source-v1` normalizer are recorded. Exactly three paid creations reported **35,603 tokens**.

- Full Theta* failed the context limit before inference. A separately disclosed first-three-page diagnostic produced three cited conceptual walkthroughs; it is not full-paper success.
- The full Dijkstra source yielded one relevant timestamp-optimality walkthrough. A proposed computed Dijkstra figure had a wrong source-block/quotation pairing and was rejected. No unseen computed Dijkstra success is claimed.
- Attention yielded three cited conceptual explanations, with no Transformer execution, training or original benchmark claim.

Grounded conceptual additions succeeded; automatic executable selection remained limited. The baseline also exposed generated prose describing controls absent from the renderer. The release adds a general prompt restriction, `rejectUnsupportedStepControls` for explicit editor/toggle/drag/slider promises in conceptual steps, validation of cached results, and an on-screen description of available interaction. This is a bounded guard, not proof that all generated prose is correct. The original baseline, rejected cases and partial scores remain unchanged; there was no quiet held-out retuning or fabricated new evaluation.

## Original experiment — PP-039

The [reproduction audit](reproduction-audit.md) and [machine-readable results](reproduction-merge-cost.json) pin the original author's Java artifact to commit `4418605e48a9598a7980e4c432ecc79cf11a38e1` and execute a bounded Figure 5 merge-cost experiment. Twelve sorting checks passed across the author implementations. The retained TimsortTrot/top-down mean merge-cost ratio implied **30.1299% overhead**, agreeing with the paper's approximate 30% observation within the explicitly described qualitative tolerance.

This reproduces a restricted merge-cost observation with author code. It does not reproduce the original hardware/runtime experiment, establish a browser speedup or upgrade the teaching-engine fidelity labels. Environment, input generation, exclusions and timing limitations are preserved in the audit.

## Production and distribution — PP-035 / PP-036

The [clean-install proof](clean-install-report.md) copied only authored source/configuration and permitted public assets into an isolated temporary directory, excluding credentials, runtime data, installed dependencies and generated workers. `npm ci`, strict TypeScript, 133 tests and production build passed. Generated PDF/engine assets loaded, health showed Meta unconfigured, and the actual numeric example completed without an analysis/question request. Matrix/plot checks at 320 px found no page overflow. The temporary server and proof browser tab were stopped/closed afterward.

The deployed application is [Paperplay on Sites](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site), **private with authentication**. The [hosted quota smoke](hosted-quota-smoke.json) records:

- HTTP 200 for frontend and trusted engine-worker asset; health identifies M5, Cloudflare Worker and D1.
- Analysis and question requests denied with HTTP 429 under the deliberate quota setup, with **zero new paid requests**.
- Real D1 short-link lifecycle: create 201, resolve 302, remove 200, subsequent access 410.

The [hosted live smoke](hosted-live-smoke.json) made exactly one genuine official Meta creation using `muse-spark-1.3`: **19,335 input + 2,707 output = 22,042 reported tokens**. The `source-v2` PDF had 18 physical pages and 229 source blocks; those blocks were preserved. Three cited conceptual step figures survived validation. A proposed Dijkstra graph configuration fell back with an explicit warning; this is not a successful automatically configured computed Dijkstra run.

A separate local native-browser import completed two figures with **19,335 input + 2,514 output = 21,849 reported tokens**. Across the three baseline creations, one hosted creation and this local creation, the current delivery work made **five creations and reported 79,494 tokens**. Earlier milestone probes/questions are separate historical evidence; this is not an all-time account total or a remaining-credit estimate.

The final optional Node image `sha256:192b3681d92cc979e89bd413d3a01019dedafb7ad25f0dede25dc1abb170d557` was actually built and started on port 3007. Health identified M5 with Meta unconfigured; HTML, PDF worker and engine worker returned HTTP 200. The smoke container was stopped afterward. This is one-host container evidence, not distributed capacity proof. [Deployment](deployment.md) and [operations](operations.md) describe the distinct Node SQLite/Redis and hosted D1 paths.

## Interaction and readability — PP-033

Earlier [readability observations](m1-report.md#readability-follow-up) record larger supporting text, darkened contrast and scoped desktop/mobile checks. Current production numeric matrix/plot views were checked at 320 px without document-wide overflow. Exact matrix values and numeric residual samples provide alternatives to visual-only charts. Final native-browser keyboard checks confirmed the visible skip link focuses `MAIN#paper-content`, Enter advances a numeric step from 1 to 2, Tab reaches restart, and dialog Escape returns focus to Import paper. A `matchMedia` API simulation of reduced-motion preference, installed before numeric mount, disabled all three Play controls while leaving next-step navigation enabled and keyboard-usable. This exercises application preference handling; it is not native OS reduced-motion emulation. Automated axe checks found 34 passing checks / zero violations for the steady UI and 23 / zero for the modal. See the [scoped accessibility report](accessibility-report.md); no complete accessibility certification is implied.

The [actual browser worker profile](browser-worker-profile.json) found equal semantic results and median pending-timer delays of 18.9 ms direct versus 1.0 ms worker on the pinned larger sorting example. A complete React rendering check also completed without errors; its largest observed heartbeat gap was 58.6 ms. These observations support moving simulation work off the UI thread, while retaining rendering/transfer costs. They do not promise 60fps or reproduce paper hardware timings.

## Documentation, demonstration and closure — PP-037 / PP-038

The [English script](demo-script.md) demonstrates a meaningful graph weight change, actual compatible-method comparison, source return, genuine Meta enrichment or explicitly labeled saved reuse, matrix/residual views and controlled sharing. Its two-to-three-minute target is editorial and provides an optional longer oral presentation. The actual [demo MP4](../artifacts/paperplay-demo.mp4) exists: H.264, 2560×1600, 70.052 seconds and 2,990,048 bytes, with burned English captions and no audio track. [English SRT](../artifacts/paperplay-demo.srt), [raw recording](../artifacts/paperplay-demo-raw.mp4) and [capture metadata](../artifacts/demo-recording.json) are retained. The metadata timeline estimate refers to the capture cues; the final encoded duration was checked independently. Five real captures show [reading](../artifacts/reading.png), [graph](../artifacts/graph.png), [matrix](../artifacts/matrix.png), [export](../artifacts/export.png) and [saved Meta output](../artifacts/meta.png).

The recording uses the actual localhost production UI. Its Meta segment reopens the genuinely observed 21,849-token local analysis as a saved result, with no new model creation for the recording. It does not claim voice narration, a live hosted import or authenticated portal format acceptance.

The [submission draft](submission-draft.md) is review material only. The official authenticated portal's actual fields/media limits have not been verified and nothing was submitted. The user explicitly chose to keep the Site private. Intended judges require authorized invitations and an actual access check before the URL is used for judging. A valid short link does not bypass hosting authentication.

The [acceptance matrix](acceptance-matrix.md) maps all ten agreed criteria and PP-033–045 to concrete evidence, preserving remaining limits. [Contributing](../CONTRIBUTING.md), [security](../SECURITY.md), dependency attribution, engine-extension, deployment and operations guides support continuation by another developer. Post-credit mode disables new paid creation by explicit switch or timestamp while retaining source/saved results and accepted-job recovery with valid credentials.

The product, private deployment and recorded assets are demonstrable. PP-037 and PP-038 remain implemented and awaiting external acceptance: authenticated portal/media requirements and invited-judge access must be checked, and no submission has occurred. Private access is the confirmed delivery choice, not an unresolved request to publish publicly.

## Cold-browser and failure rehearsal

The actual optimized production UI was opened at a fresh localhost origin with no saved browser data. A real operator-disabled import returned HTTP 503 while retaining all extracted source text. A second attempt received an explicitly simulated provider-unavailable HTTP 503 in the browser; it made zero real provider requests, announced the error and retained the readable source. The prepared graph then reopened and its worker produced Step 1 / 14. This is a rehearsal, not a claim that Meta suffered an outage. See [failure-rehearsal.json](failure-rehearsal.json).
