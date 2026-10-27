# Paperplay — English demo script

Editorial target: about 2–3 minutes. This is a presentation choice, **not a verified portal video limit**. Check [current event requirements](hackathon-requirements.md) in the accepted participant's account before recording the final submission. This file is a rehearsal script; it does not claim a video has already been recorded.

## Before recording

Use a clean browser at the verified demo URL or the local production build. Keep the same prepared input seed for the graph and comparison. Start on **Priority & shortest paths**, with its default edge weight and the source attribution available. Prepare the **Curvature & momentum** example in the sidebar.

For the import segment, use a source that has actually passed the current release's live smoke test. Keep its original, versioned source link visible. If inference is slow, shorten the wait in editing and mark the cut; do not fabricate progress. If using a completed local result, leave **Saved analysis** visible and describe it as a saved result. Do not present cache reuse as a new live model call.

## Script and actions

| Approximate time | Screen action | Spoken text |
| --- | --- | --- |
| 0:00–0:15 | Open the prepared graph paper. Point to original text and a shaded added figure. | “I built Paperplay to make research papers easier to explore. You keep reading the paper, and interactive figures sit beside the passages they explain. The original source and the added material stay clearly separate.” |
| 0:15–0:45 | Follow the passage link to the graph. Select edge S→A. Change its weight from 4 to 1, then inspect the final state. | “Here, the figure runs a supported Dijkstra implementation on a small synthetic graph. Changing this weight changes the shortest distance to T from four to two. These are actual computed states. They are not the paper's original dataset or a reproduction of its verified data structure.” |
| 0:45–1:05 | Show the compatible heap/scan comparison and **Return to source**. | “The comparison gives both methods the same input and reports their own counted operations. I can step through the computation, reset it, and return to the exact source passage. A faster animation is not presented as a hardware speedup.” |
| 1:05–1:40 | Show a genuine Meta import or an honestly labeled saved live result. Open its quoted source passage and analysis note. | “For an imported PDF or arXiv article, the official Meta API proposes figures and their locations. Paperplay checks the schema, source quotations and engine compatibility before displaying them. Unsupported methods get a labeled explanation. A proposal with the wrong source reference is rejected rather than quietly moved to another passage.” |
| 1:40–2:00 | Open **Curvature & momentum**. Inspect matrix cells and the residual plot; change a stable step size. | “The same source and figure contracts also work for numerical optimization. This matrix and residual plot come from a bounded computation. Changing the step size changes the observed trajectory. That does not prove momentum is always faster or reproduce the source article's experiments.” |
| 2:00–2:20 | Show **Share snapshot**, then **Export experiment** with inclusion choices. | “A public snapshot restores compatible input and controls in another browser. For a local paper, export explicitly chooses whether to include the text or PDF. Opening the file does not start a new model request.” |
| 2:20–2:45 | Show the prepared example with new Meta work disabled, or a real handled provider error. | “The prepared papers and saved results remain useful when inference is unavailable. New analyses and questions have shared usage limits. Paperplay helps readers inspect an idea while keeping the scientific claim tied to the evidence actually available.” |

The times are approximate. Keep the meaningful weight change, source return and Meta-validation boundary if shortening the recording. Do not claim students learned from a study: current understanding evidence is developer self-review only.

## Rehearsal checklist

- Open in a clean browser; confirm initial reading and worker computation need no API request.
- Confirm the default graph really gives distance four before changing the edge, and distance two afterward. If a different seed/input is displayed, reset first.
- Verify comparison methods share input, seed and compatible metric units.
- Use the current release's actual Meta result. Identify rejected figures, conceptual figures and cached results accurately.
- Demonstrate matrix/plot labels, including synthetic inputs and observed residual samples.
- Open a public snapshot in a separate browser profile, or show the recorded verification honestly.
- Rehearse missing configuration/provider failure. Source reading and the prepared figures should remain available.
- Check the final recording against the authenticated portal's actual field and video requirements.

## Recording assets

Actual screenshots and video are to be attached by the release integrator after final UI verification. Do not treat the following as existing files:

| Asset | State |
| --- | --- |
| Prepared paper and changed graph | Pending final capture |
| Matrix / computed residual plot | Pending final capture |
| Genuine Meta result with source citation | Pending final capture |
| English demo recording | Pending recording and portal-format check |
| Hosted demo URL and access behavior | Pending published deployment verification |
