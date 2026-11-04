# Paperplay demo video

The demo film is code: real takes of the app are captured by script, then edited in [Remotion](https://www.remotion.dev).

## Pipeline

1. **Capture** (`capture/`), with the app running on `http://localhost:3000`:
   ```sh
   node demo-video/capture/capture.mjs hero   # momentum figure, β slider: sharp 2× slow-motion take, saved figures
   node demo-video/capture/capture.mjs live   # fresh browser profile, WASABI by arXiv link, real Meta generation (~5–8 min)
   node demo-video/capture/capture.mjs play   # the finished live paper: drag a figure, return to its source
   ```
   Each take writes `public/clips/<name>.mp4` and `<name>.json`: a log of every pointer move, click and named mark. The edit redraws the cursor, zooms and captions from that log, so the app itself stays untouched.
2. **Edit**: `npm run studio` (in `demo-video/`) to preview, scene by scene (`HeroOnly`, `LiveOnly`, …).
3. **Prepare footage**: `npm run prepare:render` decodes the real takes into a local JPEG frame cache. This avoids repeated expensive video seeking in Remotion. The cache is ignored by Git and rebuilt when a clip changes; original clip files and pointer timings stay intact. Run this before Studio on a fresh checkout.
4. **Render**: `npm run render` → `out/paperplay-demo.mp4` (1920×1080, 30 fps).

Install Remotion’s matching browser once with `npx remotion browser ensure`. `npm run render` prepares the frame cache automatically.

If necessary, an existing local headless Chrome can also be passed:
`--browser-executable=$HOME/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.

## Honesty rules built into the edit

- Sped-up generation always shows the speed badge ("×N real generation, sped up"); key moments (plan reveal, first arrival) play at 1×.
- The generation take opens the paper in a fresh profile. The final cluttered result is replaced in the edit by an actual Meta revision, explicitly labelled “Revised Meta figure”. The following interaction is labelled “synchronized replay”: it replays that unchanged model's outputs together, without the original recording's cursor and computation delays. It demonstrates the model's behavior, not application latency.
- Added figures are described as teaching models, not results; the model is credited as it is configured (`muse-spark-1.3`).

The final export uses Remotion’s matching browser and a decoded-frame cache to avoid repeated native video seeking. The source takes remain available alongside their pointer logs. The outro does not claim public repository access. The WASABI submission date is taken from its [arXiv record](https://arxiv.org/abs/2610.41958), rather than the recording day.

Input checks: `node capture/check-input-latency.mjs` checks live bank-widget updates in the saved hero profile; `node capture/check-generated-input.mjs` checks computed SDK output before pointer release. `node capture/check-framing.mjs` checks camera tracking after page growth and at the end of the document. The reader server must be running for input checks.

The latest WASABI takes use focus reading at 1600 × 1400 with 18 px body text. The edit follows arriving figures, crops around the revised diagram, and shows its chart and controls side by side in the interaction scene. The library, contents and search chrome are hidden by the product’s focus mode. SDK calculations remain serialized, with each slider’s latest value retained while a calculation runs. Source recordings, timing logs and rendered exports are local artifacts excluded from Git; they are needed to reproduce the exact final edit.

Shared-browser recordings can be normalized with `capture/ingest-preview-recording.mjs live|live-play recording events.json`. Event times are measured from the real recording start; generation waits stay labelled when sped up. The momentum opening combines a real Show figure click with a mathematical animation and a continuous β slider.

The distribution replay is exported with `npx tsx demo-video/capture/export-figure-replay.ts admitted.json source-export.json` from the repository root. The exporter checks the exact candidate digest, compiles the actual Meta source, and evaluates it in the application's isolated interpreter for 401 shift values. It checks the 1D moments and saves only static display data in `src/replay/tilted-noise.json`. The chart, numerical values, slider thumb and edited cursor all use the same selected state. The return to the cited passage uses the original recording.

## Soundtrack

The full film mixes “Cylinder Five” by Chris Zabriskie under CC BY 4.0, with quiet volume automation and opening/closing fades. Credits appear in the outro and in `public/audio/CREDITS.md`; retain that attribution when sharing. Four subtle sound cues follow the actual Show figure click, the new-paper transition, the interaction reveal and the closing logo. The original sound effects can be regenerated with `python3 capture/create-sfx.py`. `src/Soundtrack.tsx` uses scene timings, so the cues follow changes to the edit.
