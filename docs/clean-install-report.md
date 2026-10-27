# Clean source installation proof — PP-035

Checked 27 October 2026. A frozen copy of the authored source was installed, tested and served in an isolated temporary directory without application credentials. This is a **local source-snapshot proof**, not a claim that a final Git commit has been published or cloned from GitHub.

## Frozen inputs

- Copy time: `2026-10-27T02:05:41Z`.
- Isolated directory: `/tmp/paperplay-clean-iz3zx1lp`.
- Copied files: 136 authored source/configuration files and pinned public resources.
- Source-snapshot SHA-256: `77e5a5d73870b6846335ea6a6da2f401e7532dd91d5c76c6b6b256d914aec3da` (digest of the sorted per-file hash manifest).
- `package.json` SHA-256: `a909ebfcb3158c371b76515c4a7e458a81edabbdddce710cfb004a9dd781edac`.
- Lockfile SHA-256: `208ff4c4cce8bdd111d03547a89fb8167416c3389c8823a9f2277f6ec29c5304`.
- Package version: `1.1.0`; Node `v24.14.0`; npm `11.19.1`.

The copy included application, component, data, deploy, library, server, shared, script, test, asset and pinned-public source, plus package/lock/configuration files, README, license and `.env.example`. It excluded `.env`/private environment files, `.paperplay`, isolated hosting state/builds, `node_modules`, `.next`, `dist`, TypeScript build caches and generated PDF/engine-worker assets. The harmless environment example was included; `.env.local` was absent. Sensitive inference/signing/Redis environment variables were also removed from the install/check/server child-process environment.

The source tree was under active development; this proof applies to the recorded snapshot. Later changes require their affected checks. No user root file or private runtime directory was deleted or copied into the proof environment.

## Commands actually run

| Command | Result |
| --- | --- |
| `npm ci` | Exit 0; 163 packages installed, 164 audited. Package audit reported zero vulnerabilities for that installed tree. |
| Postinstall | Rebuilt local PDF.js worker/resources and trusted engine worker from the installed dependencies/source. No previously generated worker was copied. |
| `npm run check` | Exit 0: strict TypeScript, 133 tests passed / zero failed, optimized Next production build succeeded. |
| `npm run start -- --port 3006` | Production server started successfully from the isolated build. |

The rebuilt PDF worker was 1,264,342 bytes; the engine worker was 483,037 bytes. Local CMaps, standard-font and WASM directories were present. The npm install-script advisory for esbuild did not prevent the successful postinstall/build. Node emitted its documented experimental SQLite warning; no application build failure was observed.

This used the machine's installed Node/npm and available package cache/network. It is not a fresh-OS, cross-platform or independent supply-chain audit.

## Actual production smoke checks

All of these returned HTTP 200 on the isolated production server:

- `/`: HTML containing the Paperplay application.
- `/api/health`: `status: ok`, `meta.configured: false`.
- `/pdf.worker.min.mjs`: JavaScript worker asset.
- `/engine.worker.mjs`: executable browser JavaScript worker asset.
- `/papers/priority-search-trees.pdf`: original pinned PDF.

The snapshot's health metadata still labeled its stage `M3`; this stale display field was reported to the release integrator rather than treated as proof of final release identity.

A separate native collaborative-browser tab opened the isolated origin and selected **Curvature & momentum**. It displayed **Why Momentum Really Works**, matrix cells and completed numeric runs with the rebuilt engine worker served as `engine.worker.mjs?v=1.1.0-p1` (HTTP 200). The first run reported 83 synthetic updates and residual `9.0463e-9`, reaching its declared `1e-8` tolerance. The UI showed **Meta not configured**. Browser request inspection found **zero analysis/question requests**.

This verifies a current prepared numeric example actually runs without inference credentials, in addition to the provider-free test suite. It does not verify a hosted deployment or make a general convergence/performance claim.

## Teardown and handoff

The release integrator additionally checked the prepared numeric matrix and plot at a 320 px viewport: no horizontal overflow and zero paid calls were reported. After that QA, the isolated server was stopped deliberately with Ctrl-C (exit 130), and the proof agent's browser tab was closed. Temporary source/build/test logs remain isolated under `/tmp`; no application key, paper-analysis checkpoint or hosted credential was transferred into this environment.
