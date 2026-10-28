# PP107 native UI observations

28 October 2026, production server at localhost:3001, a new agent-owned tab using the default browser profile. No other agent’s tab was operated.

Prepared-source inspection correctly identified its input as normalized source JSON, disclosed partial inventory and unavailable original geometry/tables/supplements, and retained raw supplied TeX. A user annotation appeared beside the unchanged original `Abstract`; the paper text did not change. Saving, resetting to original, undoing that reset and reopening produced revisions 1, 2 and 3 as expected. The 998-byte annotations-only export contained source/target hashes and the user replacement/reason, without original PDF or attachment bytes. A changed-source import was rejected while revision 3 and its derived interpretation remained available; the original rejected file was downloadable.

The source-return button focused the visible original source block. Native Tab showed a visible outline on the next type filter; Enter activated it. An empty table inventory explicitly avoided claiming that the source contained no tables.

At 1280 px the page width remained 1280. At 320 px it remained 320, with the evidence panel measuring 250/250 client/scroll width. Explicitly enlarging root text to a measured 32 px retained these widths; buttons were at least 83 px high. The native file input clipped its own filename internally, without page overflow. Screenshots and their hashes are recorded in `extraction-browser-report.json`.

Instrumented save/export/reset/undo/source-return actions made zero fetch calls. Reload made only the ordinary health request; no model or supplement request occurred. Actual PDF rendering, raw-byte provenance, structured HTML inventory and approved supplement retrieval are outside this particular walkthrough and are covered separately by the parent agent and adapter tests. No scientific extraction-accuracy or reader-study claim follows from this UI exercise.

Only this agent’s created overlay was removed afterward using its exact manifest and correction IDs; no local paper was created. The only code change from this pass was the requested wording “retention limit reached”, which also covers byte/cell limits. Parent rebuild is required to display that wording.
