# Reading and interaction accessibility review

Reviewed on 27 October 2026 in the actual collaborative Chromium browser. This is a targeted developer review, not an independent accessibility certification or participant study.

- Settled numerical reading workspace: axe-core WCAG 2/2.1 A/AA checks reported 34 passes and zero violations. Settled import dialog: 23 passes, zero violations. The check ran after the dialog opening animation; automated checks cannot establish complete conformance.
- The skip link becomes visible on focus. Pressing Enter moves focus to `main#paper-content`, with `tabIndex=-1`.
- Enter on the numerical next-step button advances Step 1 to Step 2. Tab then reaches Restart playback. Graph, matrix and convergence states also have text, accessible labels and tables rather than color alone.
- Escape closes the import dialog and returns focus to its Import paper button. The shared dialog component explicitly restores the opener for custom triggers.
- A controlled `matchMedia` API simulation of `prefers-reduced-motion: reduce` before mounting the numerical paper disabled all three Play controls, retained enabled step controls and displayed the explanation. Enter still advanced the trace. This is an actual browser behavior check with simulated API input, not OS-level preference emulation.
- Desktop 1280px and narrow 320px checks found no document-wide horizontal overflow for the numerical reading workspace. Matrix cells use 16px text; auxiliary labels retain the earlier minimum 14px, controls 16px and paper text 17px mobile / 18px desktop. Wide equation/data regions scroll locally where needed.

The review does not establish screen-reader compatibility on every platform, every imported document layout, all combinations of magnification or every hosted authentication screen. Source extraction limitations remain in [PDF reconstruction](pdf-reconstruction.md). Worker responsiveness evidence is in [performance-worker.md](performance-worker.md).
