# Composed scientific figures (PP-087)

`paperplay-composed-scene` version 1 is a bounded declarative layout inside a source-linked representation plan. It composes nested panels, adaptive rows/grids, text, source/assumption annotations, legends, repeated marks and named chart/equation/data slots. Slots currently expose explicit text/numerical equivalents; they do not pretend to implement the later specialized scientific renderers.

The new `composed-scene@1.0.0` approved adapter uses the existing build/execute contract. The reader does not select by discipline. Structural biology, physics and algorithm examples pass through the same contract; their values are explicitly synthetic, not evidence of paper reproduction. **Create a figure → Preview a composed figure** opens a manual source scaffold. Imported representation JSON can supply a more specific composition. Current Muse widget proposals retain their existing schema; generic composition generation belongs to the later planning work.

## Layout and coordinates

The flat node registry forms a validated tree with unique identities, one parent per node, a maximum depth of five and 80 nodes. Grids request one to four columns and collapse inside narrow containers. Shared spacing tokens, conservative numbered-mark text measurement and browser-flow full labels avoid truncation. Scientific coordinates have a named frame/axes/unit independent from responsive layout pixels. Diagrams and complete value tables use explicit keyboard-focusable local scroll regions.

A scene expands at most 128 marks, including repeated point groups; a composed figure permits at most 256. Relationships require existing endpoints, frames update existing stable mark IDs, and 24 frames per scene/3,072 total updates bound the work. Every frame is relative to the declared initial state. The viewport is derived from the union of initial and all frame extents, including temporarily hidden objects. Seeking therefore keeps the scale and unchanged objects stable.

Collisions are checked across all frames and reported visibly; overlapping marks are not silently discarded. Every object, including one hidden by an authored frame, remains in the full-label coordinate/value table. Relationship tables retain endpoint labels and meaning. A drawn arrow does not establish causality. Source annotations must quote an actual declared source anchor; interpretations need the added-assumption label. Frame controls say **authored walkthrough**, never computed scientific execution.

## Verification and limits

`tests/composed-scene.test.ts` covers common rendering contracts for three domains, exact source annotations, registered offline execution, stable extents, unchanged-object positions, collision detection, hidden-object numerical equivalents and tree/repetition/frame bounds. The full check passes TypeScript, 258 tests and the production build.

Native Chromium at 320 CSS pixels verified local scrolling (560 px diagram / 480 px tables), complete labels, frame updates with unchanged object positions, collision warnings, source-return focus and no document overflow. A 200% text-size stress check with WCAG-style line/letter/word/paragraph spacing retained all essential labels and the visible close action; tables scrolled locally. This is a text/reflow check, not a claim of testing every browser's zoom implementation. No inference, expert validation or real-paper scientific execution was performed.

This issue supplies layout and declarative inspection. It does not add a numerical solver, causal inference, new original-paper content or arbitrary generated JavaScript. Linked multi-view selections and snapshot restoration are the next issue.
