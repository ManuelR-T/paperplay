# Linked semantic selections (PP-088)

A representation owns one provider-free selection store. Composed diagrams, complete value tables, numerical slots and source annotations consume its immutable snapshot rather than sending reciprocal DOM events. Selecting an entity in any linked control updates the same semantic ID everywhere, including an exact cited passage. The same controls work by keyboard.

`shared/semantic-selections.ts` defines source/view-scoped entity, time, coordinate-region, parameter-focus and uncertainty-focus selections. Physical time is distinct from an authored walkthrough index. Regions retain a coordinate frame and unit; mismatched frames or inverted bounds are rejected. Quantity uncertainty focus must match a declared quantity, uncertainty type and valid index. The current region protocol is an extension hook for later spatial views, not a claim that image brushing is already implemented.

Composed entities declare source anchors. Mark/value bindings and frame anchors must resolve to actual declared targets. Seeking and resetting a frame preserve the selected entity; Undo selection restores prior navigation. Missing targets are pruned when inputs change. Input rebinding clears obsolete navigation undo history, while ordinary seeking does not alter inputs or rerun a computation.

Existing widgets use an explicit adapter into this store. Their source/seed/spec remain unchanged during navigation. Widget navigation is captured atomically so one undo reverses one action. Input editing and the widget's own input undo remain separate; incoming navigation no longer erases that undo record. Raw legacy widget selection strings remain scoped to their own widget; they do not become global scientific entity identities.

## Portable state and evidence

Optional `navigation` in the version-1 representation carries the current linked selections and a local input-freshness digest. JSON export/reopen restores entity and frame selections without inference. Unknown or stale targets retain the original file and produce an actionable validation error. The digest detects navigation staleness; it is not cryptographic evidence or a scientific permission. Scientific evidence bindings explicitly exclude navigation while retaining source, data, model and semantic-definition changes.

The store bounds 32 retained channels and 32 navigation undo entries. Equal selections are idempotent even when a subscriber repeats them. Scope transactions validate before mutation; exceeding the channel limit keeps the prior snapshot and history and gives a visible message instead of silently evicting selections.

## Verification

`npm run check` passes strict TypeScript, 265 tests and the production build. Deterministic tests exercise figure/table/source bindings, feedback-loop prevention, immutability, frame reset and undo, input rebinding, portable restoration, scientific-binding invariance, stale targets, coordinate scopes, parameter/uncertainty focus, legacy widgets and channel budgets.

Native Chromium at 320 pixels verified a table selection updating the drawing, two numerical views and the source annotation; seek/reset preserving the entity; undo and export/reopen restoring entity/frame; keyboard Enter selecting another mark; legacy graph seek/clear; graph weight editing and input undo. No document overflow or alert occurred in these valid flows; the observed model-request count was zero. Specialized charts and image-region controls are subsequent issues; no scientific simulation or independent verification is claimed here.
