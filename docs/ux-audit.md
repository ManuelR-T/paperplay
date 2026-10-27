# Paperplay user-experience audit

Date: 2026-10-27. Scope: all ten widget families, prepared-paper figures, reader tools, source import, Meta planning, and arXiv discovery. This is an agent walkthrough using the real local application, not a study with human participants.

## Findings and implementation checklist

Each finding is phrased from the reader's point of view. Only concrete issues observed in the interface or its interaction code are included.

| ID | Reader's problem | Improvement | Status |
| --- | --- | --- | --- |
| U01 | I see configuration and tables before I understand the result. | Put the visual/result first; separate View, Inputs and Values with direct buttons. | Implemented |
| U02 | I do not know what to try in a new widget. | Give each family a short, specific interaction prompt. | Implemented |
| U03 | Clearing a number or typing a negative/scientific value fights the editor. | Keep numeric drafts editable, validate bounds inline, support keyboard adjustment and exact matrix edits. | Implemented |
| U04 | A mistake or reset makes me afraid of losing the previous setting. | Add undo for the last input change/reset, distinct from stepping. | Implemented |
| U05 | The plot is difficult to interpret and tapping does not reliably select the point I see. | Add axis/series labels and correct SVG coordinate conversion on resized canvases. | Implemented |
| U06 | A concept/graph node is too small or its name is cut off. | Keep diagrams at a readable scale with local scrolling and a full selected-node explanation. | Implemented |
| U07 | Graph dragging provides poor feedback. | Preview a drag locally and commit its coordinates on release; preserve keyboard movement. | Implemented |
| U08 | I cannot see how a matrix changes a vector. | Show a dedicated input-vector plane and a clearly labeled transformed result. | Implemented |
| U09 | Attention looks like three spreadsheets. | Show attention weights as an interactive heatmap and weighted output; keep Q/K/V editable separately. | Implemented |
| U10 | Query selection and stepping in attention can disagree. | Synchronize the selected query, highlighted matrix row and current step. | Implemented |
| U11 | A line through discrete probabilities looks like a continuous density. | Render discrete mass as stems/dots, identify the analytic series and show observed sample frequencies visually. | Implemented |
| U12 | The probability example buries its meaning under sample tables. | Keep the main distribution and observations prominent; move all draws/likelihood details to Values. | Implemented |
| U13 | A table filter can leave me with a blank table and no way back. | Add an explicit empty state and one-click clear; make headers sortable with visible direction. | Implemented |
| U14 | Convolution does not make it obvious which output I am inspecting. | Highlight the exact output cell and show the current local-product description beside it. | Implemented |
| U15 | A custom model exposes runtime jargon before its purpose. | Put purpose, scene and selected metrics first; move runtime/catalog-gap explanations to details. | Implemented |
| U16 | Stepped widgets have a different, incomplete playback interface. | Provide consistent previous/play/next/restart/seek controls, with reduced-motion support. | Implemented |
| U17 | Values are repeated in several long tables. | Offer one explicit Values view with all numerical equivalents and clear, scrollable table regions. | Implemented |
| U18 | The widget gallery makes me choose unexplained technical names in a dropdown. | Offer ten named example buttons with short descriptions and compact source attribution. | Implemented |
| U19 | I scroll several screens before seeing discovery results. | Compact the Explore introduction/search area and offer a direct filter reset. | Implemented |
| U20 | Saving a paper gives little confirmation and a long reading list is difficult to scan. | Confirm save/remove actions and allow local filtering of saved papers. | Implemented |
| U21 | Reader controls become small on a phone and model status terminology is distracting. | Use readable touch controls and plain reading-status labels. | Implemented |
| U22 | Figure creation/import copy makes me think I must generate AI content just to read. | Use source-first action labels and place the paid-request disclosure at the actual Meta action. | Implemented |
| U23 | A figure title appears several times and action rows obscure the content. | Keep one main title; consolidate secondary file/share/configuration actions. | Implemented |
| U24 | A computation failure or invalid edit obscures what is still usable. | Keep validated inputs, actionable inline errors, a retry action, and readable empty states. | Implemented |
| U25 | After scrolling a long dialog on my phone, its close button disappears. | Keep a 44-pixel close control visible while the dialog scrolls. | Implemented |

## Baseline

All ten gallery widgets were opened at 320 CSS pixels. No horizontal document overflow or automated WCAG A/AA violations were found in their default state. Usability remained poor: the equation widget occupied 2,182 px, function 2,308 px, diagram 1,902 px, table 1,670 px, linear algebra 2,211 px, probability 4,134 px, attention 2,717 px, graph 3,461 px, convolution 2,953 px and custom model 3,845 px. Input controls preceded the primary result in every family. Baseline automated checks alone therefore missed the main user-facing problem.

## Verification boundary

Use native T3 Chromium on desktop and a 320-pixel viewport. Exercise each family, its Inputs/Values views, reset/undo, stepped navigation and relevant selections. Run deterministic validation tests, TypeScript and a production build. Use no paid model inference for this audit. Keep original source attribution, scientific limitations, bounded execution and existing portable state formats available. Hosting/release work and the unavailable real-reader study remain outside this pass.

## Results

All findings above are implemented. The common tabs are named **Explore**, **Inputs**, and **Values**. Numerical tables and scientific qualifications remain available; shortening the main view does not remove those details.

The ten families were checked in all three tabs at 320 and 1280 CSS pixels (60 states): no automated WCAG A/AA violations, document overflow, or runtime alerts were observed. All ten main views also passed automated checks in sepia and high contrast. These automated results do not establish complete accessibility compliance.

Native interactions verified numeric drafts and undo, function and vector pointer coordinates, graph dragging, attention query synchronization, convolution output selection, table empty-state recovery, keyboard tab navigation, and custom-widget share restoration. Source-first arXiv import opened the paper without opening the planner or requesting paid inference. Notes and search opened directly from the sticky reader controls. Saving and filtering the reading list were exercised with real arXiv results. A scrolled mobile preferences dialog retained its close control inside the visible dialog.

The probability main view decreased from 4,134 to 2,036 pixels at 320 pixels wide; custom models from 3,845 to 1,775. This measures layout height, not execution speed or comprehension. Raw baseline and final matrix measurements are in [ux-audit-qa.json](./ux-audit-qa.json).

`npm run check` passed: TypeScript, 205 tests, and the production build. No paid Meta requests were made. Reduced-motion behavior is preserved in the playback code; an operating-system reduced-motion setting was not exercised. The real-reader study remains pending because no participants are available.
