# Paperplay — submission draft

**Reviewable draft only. Nothing has been submitted or sent.** The accepted participant must confirm the current form, track, eligibility, media requirements and final deadline in the [official submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). See [verified and unverified event requirements](hackathon-requirements.md).

## Project

**Name:** Paperplay

**Suggested track:** Indie Developer — solo project. The participant's accepted track/account state has not been independently verified.

**One-line description:** Read a research paper with source-linked interactive figures, real bounded simulations and contextual explanations from Meta.

## Project description

Research papers often explain an algorithm through dense text, equations and a few static figures. Paperplay keeps the source in view and adds interactive figures beside the passages they explain.

Readers can change a synthetic input, step through a supported computation, compare compatible methods, and return to the original passage. Graph algorithms, adaptive sorting and numerical optimization use shared source, figure and snapshot contracts. Matrix cells and residual plots expose actual supplied or computed values.

The official Meta Model API proposes figures and source locations for imported PDFs and versioned arXiv articles. Paperplay validates the returned structure, quotations, page or HTML references, bounded parameters and registered engines. Unsupported mechanisms receive a labeled conceptual explanation. A wrong quotation or source reference does not become an executable figure.

Contextual questions include the selected passage and current figure settings. The server recomputes supported synthetic runs and checks answer citations. Reading settings and completed analyses are saved in the browser. Public example links restore compatible experiments; local-paper bundles include source text or a PDF only when explicitly selected.

The application uses durable request/token allowances and preserves accepted background-job references across reloads. Prepared papers and saved results remain readable when new inference is disabled. Model explanations are interpretations, and a matching citation does not establish scientific correctness.

## Meta integration

- Official Meta endpoint: `https://api.meta.ai/v1`.
- Verified model used during development: `muse-spark-1.3`, configurable server-side.
- Roles: source-grounded figure selection/placement and contextual answers.
- Computation: trusted local/worker TypeScript engines; no model-generated code execution.
- Evidence: [held-out evaluation](evaluation-report.md), [M2 live import checks](m2-report.md), [M3 contextual-question checks](m3-report.md), and [actual hosted Meta import](hosted-live-smoke.json): one creation, 22,042 reported tokens, three validated conceptual figures.

The OpenAI-compatible client package is a protocol client in this integration; these calls go to Meta's configured endpoint.

## What the demonstration shows

The actual local-production recording shows the reading interface, graph computation/comparison, matrix and convergence view, explicit experiment export, and a genuine saved Meta result. Its saved result comes from the observed 21,849-token local import; recording reused it without making another model request. The video is silent with English captions, not a narrated live hosted import. The [English script](demo-script.md) is an optional longer oral presentation (about two to three minutes); it is not the 70-second recording transcript or a verified portal limit.

## Scientific and product limitations

The teaching engines use small synthetic inputs. They do not reproduce arbitrary paper experiments, formal proofs, Transformer training or hardware timings. The [restricted original merge-cost replay](reproduction-audit.md) uses the author's pinned Java artifact and is separate evidence; it does not upgrade browser figures to original-experiment reproductions.

PDF reading order, math and diagram recovery remain bounded and visibly qualified. Very long sources can exceed the analysis context limit. The held-out baseline includes partial results and rejected proposals; it is developer self-review, not a participant study. There are no product accounts, cloud library synchronization or scanned-PDF OCR.

## Links and required assets

The final release URL will come from Railway, which the user chose to configure only at release time. It does not exist yet. The current private Sites URL below is a historical demonstration; replace it with the verified Railway URL and access instructions when ready. No current Site access control should be assumed to transfer to Railway.

Complete these fields only after verification:

| Field | Draft state |
| --- | --- |
| Hosted demo | [Deployed private application](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site), verified with D1 and real Meta inference. The user explicitly chose private access. Authorized judge invitations and access verification remain manual; this is not a public demo. |
| Source repository | `https://github.com/ManuelR-T/paperplay` — repository access and final source publication must be checked; a local working tree is not proof of publication. |
| Demo video | [Captioned MP4](../artifacts/paperplay-demo.mp4), 70.052 seconds, H.264 2560×1600, 2,990,048 bytes; silent, with burned English captions. [SRT](../artifacts/paperplay-demo.srt) and [capture metadata](../artifacts/demo-recording.json) retained. Upload and authenticated form acceptance remain pending. |
| Screenshots | [Reading](../artifacts/reading.png), [graph](../artifacts/graph.png), [matrix](../artifacts/matrix.png), [export](../artifacts/export.png), [saved Meta result](../artifacts/meta.png). |
| Release/version | Package `1.1.0`; final root check passed strict TypeScript, 134 tests and production build. See [acceptance evidence](acceptance-matrix.md) for limits and final handoff gates. |
| Team | One developer; enter the participant's actual profile details in the portal. |

## Before the participant submits

Check judge access to the deployed application and repository, confirm the video's actual contents and form limits, retain paper/dependency attribution, review the final scientific claims, and enter the participant's real account/team details. Do not submit this draft automatically or imply that a local test or private URL already satisfies portal access requirements.
