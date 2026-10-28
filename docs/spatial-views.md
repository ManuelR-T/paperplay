# Spatial images and fields (PP-091)

Implemented: a shared `spatial-view` representation for original image references and bounded 2D scalar tensors. The reader and standalone scientific studies use the same renderer, semantic region store and source-return actions. No model inference or new executable code is involved.

## Coordinates and evidence

Coordinates refer to original pixel/grid centers, with inclusive integer region bounds. Zoom and scroll change only the viewport. Declared physical calibration requires explicit length units, spacing, origin and axis directions; pixel mode never invents a microscope scale. Selected regions expose world coordinates, original values and source-only summaries. Missing field cells and transparent source samples remain missing. Regions above 16,384 cells retain geometry and numerical fallback without silent subsampling or inferred uncertainty.

Rectangle annotations and binary/null mask tensors are separate layers with their own origin, source links and interpretation. They cannot replace base image pixels or field values. Displayed sRGB is a native browser decode, not raw instrument intensity. A generated or source-extracted mask is not independently verified segmentation.

The examples pair an authentic unchanged [CDC micrograph](spatial-image-source.md) with an explicitly authored 64×64 analytic field in millimetres and kelvin. Its threshold mask illustrates a mathematical operation, not an observed biological boundary, physical phase transition or diffusion simulation. Neither example is from the frozen held-out corpus.

## Bounded image loading

Image bytes load only after an explicit reader action. The known CDC image is served locally without altering the original archive reference or bytes; unknown external references require browser CORS. No image proxy, model request or cross-origin credentials are added. Stream reads enforce a 2 MiB limit; headers enforce 2048 pixels per side and 1,048,576 pixels total before native decoding. Actual dimensions and SHA-256 are checked against available source expectations.

Only an intentionally strict, single-frame, 8-bit baseline JPEG / PNG subset is admitted. Orientation-bearing, animated, compressed-metadata and unsupported formats fall back to the original source. Loading supports cancellation and an eight-second UI timeout. Large/unavailable/unsupported images do not block source reading. Integrity checks establish byte consistency, not scientific validity.

## Interaction and portability

Fit width, zoom, actual pixels, scroll/pan, drag/click regions, arrow-key movement and four labeled coordinate inputs are available. Readable source-value tables accompany selections. The viewport, palette and visible overlays are navigation; their changes do not invalidate the scientific input binding. Calibration, source bytes, data and masks remain scientific inputs.

Data study v2 exports source text, attribution, checked embedded assets, exact image reference/digest, navigation and approved views, capped at 512 KiB. Image/PDF binary bytes stay separate. V1 statistical studies remain accepted and serialized as v1. Imported JSON does not create verification receipts. A shared scientific-study host and representation renderer keep imported and in-paper behavior aligned.

## Verification

`npm run check`: TypeScript, 283 tests and production build. Reference tests check the exact CDC bytes, baseline decode headers, orientation/truncation/SVG rejection, reversed axes, ROI round trips, nulls, large-region limits, mask shape/values, calibration, offline metadata execution, v2 export/import, viewport binding invariance, digest mismatch, streaming overflow and cancellation.

Native Chromium at 320 px verified the real source raster and digest; image selection retained (350,205) and displayed sRGB (132,132,132) across an annotation toggle and zoom. The field's missing 4×4 corner exposed sixteen missing cells and no mean. Cell (32,32) retained 313.094521534 K across a mask toggle and zoom; focused arrow-key movement selected (33,32). A downloaded v2 study reopened with the selection and 563% viewport intact, with no alerts or page overflow. These are engineering checks, not participant or scientific expert review.
