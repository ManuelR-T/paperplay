# Paperplay — English demo script

Editorial target: about 2 minutes. This is a presentation choice, **not a verified portal video limit**. Check [current event requirements](hackathon-requirements.md) in the accepted participant's account before recording the final submission. This file is a rehearsal script; it does not claim a video has already been recorded.

**The one idea the video must land:** a paper nobody has illustrated becomes something you can play with, automatically, and Meta decided what to build.

## Before recording

- **Use one browser profile for every take.** Figures are saved in that browser. A fresh profile or a new address (another port, another host) has none and starts new paid Meta requests. Check spend with `npm run usage:summary`.
- **Pre-generate and review the hero paper** (*Curvature & momentum*) in that profile. Read every figure against its passage: labels, equations, which way the parameters push things. If one is wrong or ugly, use **Restart illustrations** and review again. Record only figures you have checked.
- **Pick the fresh arXiv paper on the day** (published in the last 24–48 h, so no one could have prepared it). The arrival animation only plays for a first generation, so record that segment on a paper you have *not* opened in the recording profile. Do the dry run on a different, similar paper (about 5 Meta requests each).
- Hard-refresh the app before recording. Hide the browser bookmarks bar; use 1440×900 or larger; zoom 110% if text is small on video.
- Turn on focus mode for the reading shots (header **Focus**): it hides the contents rail and the reader bar.

## Script and actions

| Time | Screen action | Spoken text |
| --- | --- | --- |
| 0:00–0:10 | *Hook.* Hero paper, momentum passage: a dense recurrence equation in plain text. Hold two seconds. Then cut to the same passage with its figure open. | "This is how research papers explain momentum. And this is the same passage in Paperplay." |
| 0:10–0:35 | Drag the **β** slider on *Momentum as accumulated velocity*: 0 → 0.5 → 0.9. The faint full path reshapes live; press **Play** once at β = 0.5. | "β is the momentum. At zero, the ball crawls along the flat valley. Around 0.5 it shoots straight to the minimum. Push it to 0.9 and it overshoots and spirals. That's the whole paper, in one slider." |
| 0:35–1:05 | Find a paper → paste the fresh arXiv link → the reader opens. Speed the wait up in editing **and label it** ("×8"). Show the progress pill in the reader bar, then figures arriving beside their passages (green ring, passage glow, "New figure" pill). | "Now a paper that came out yesterday. Nobody has prepared it. Meta reads the whole paper, picks the few passages that need an interaction, and builds them. Watch them land next to the text they explain." |
| 1:05–1:30 | Open one new figure. Change one input; click **Source passage ↑** to jump back to the quote. | "Every figure is anchored to an exact quotation. One click takes you back to the source, so the explanation never drifts from what the authors actually wrote." |
| 1:30–1:50 | *Under the hood.* Show a custom figure's label ("Custom teaching model") and its **Figure options → details**. | "Meta chooses between configuring a figure from our bank and writing a brand-new interactive model. That model runs sandboxed, and is checked against the source before you ever see it. Added figures are labelled as teaching models, not results." |
| 1:50–2:00 | Back to the hero figure, β slider mid-drag. Logo. | "Paperplay turns the hardest part of a research paper into an experiment you can play with." |

If shortening, keep the slider moment (0:10–0:35) and the live arrival (0:35–1:05); they carry the impact, Meta-tooling and demo criteria.

## Honesty rules for the edit

- Any sped-up wait is labelled on screen. Real timing for the hero paper on 2026-11-03 was about 2 min 50 s for 3 figures.
- A figure reused from a saved run is not presented as freshly generated.
- Do not claim measured learning gains; there is no reader study.
- Say "teaching model" for custom figures; they are not verified reproductions of the paper's experiments.

## Rehearsal checklist

- [ ] Hero paper's three figures reviewed in the recording profile; the β slider behaves as narrated (0 slow, ~0.5 fastest, 0.9 overshoots).
- [ ] Fresh arXiv paper dry run completed and its figures reviewed.
- [ ] "New figure" pill and arrival animation visible in the recorded run (they only play for figures delivered while the page is open, not restored ones).
- [ ] Recording profile is the only one used; `npm run usage:summary` checked before and after.
- [ ] Hosted URL and jury access verified; final video checked against the authenticated portal's actual requirements.
