# Deployment

Paperplay has a normal Next.js Node deployment and a Sites artifact using a static Next frontend plus a Cloudflare Worker API. Both use the same authored UI, validated analysis handlers and simulation contracts. The Sites adapter changes packaging and persistence; it does not replace the application with another frontend framework.

## Local production

Use the Node version in [`.nvmrc`](../.nvmrc). From the project root:

```sh
npm ci
cp .env.example .env.local
npm run check
npm run start
```

The prepared reading workspace works with an empty `MODEL_API_KEY`. Add the real key only to server-side configuration when inference is needed; follow [Meta setup](meta-setup.md). Set `ANALYSIS_APP_ORIGIN` to the exact HTTPS origin for a hosted or LAN deployment. Keep `.env.local`, runtime SQLite files, private imported papers and provider checkpoints out of source archives and public build assets.

`npm ci` rebuilds PDF.js resources and the trusted browser engine worker. The production build must include `/pdf.worker.min.mjs`, `/engine.worker.mjs` and the pinned public paper assets. Give the Node process a writable persistent `.paperplay` directory or explicit SQLite paths. Preserve signing secrets to keep signed handles valid across restarts. Configure a reverse proxy with HTTPS and the intended audience controls before public exposure.

The isolated [clean-install proof](clean-install-report.md) passed strict TypeScript, 133 tests, a production build and prepared numeric-browser checks without credentials. It records the exact source snapshot; it is not proof of a published Git checkout or every later source revision.

Distributed Node replicas require shared Redis for quotas as described in [operations](operations.md). That quota adapter does not provide a distributed short-link database. Use the D1 hosting target for the implemented shared short-link path, or keep that Node route unavailable until a shared adapter is supplied.

## Hosted Sites artifact

The application is deployed at [the private Sites URL](https://paperplay-meta-lab-1027.poeticbadge1024.chatgpt.site). Actual [hosted infrastructure smoke](hosted-quota-smoke.json) records frontend and engine-worker HTTP 200, Worker/D1 health, quota rejection before paid work and short-link creation/resolution/deletion. One [real hosted Meta import](hosted-live-smoke.json) preserved an 18-page source and produced three cited conceptual figures using 22,042 reported tokens. These are deployment observations, not load or judge-access certification.

The Sites tooling must first create/open an isolated checkout with retained `.openai/hosting.json` identity and D1 configuration. Do not invent that identity or replace the root project with a starter. The source staging command is:

```sh
npm run stage:site -- .paperplay-sites
```

It copies authored application/source/public assets while preserving the Sites identity and helper scripts. It excludes private environment and runtime data. The isolated checkout's build script invokes the hosted builder; the ordinary root `npm run build` remains a Node Next build. Staging does not require committing the user's root workspace. The native Sites tooling owns synchronization and publication of its isolated checkout.

The hosted builder, `npm run build:hosted`, requires the retained hosting identity. It produces:

- `dist/client`: the static Next frontend and public worker/paper assets, built without server secrets.
- `dist/server/index.js`: the Worker dispatcher and shared backend handlers.
- `dist/server/wrangler.json`: Worker/asset/D1 configuration with `ASSETS` and `DB` bindings.
- `dist/.openai`: the retained hosting metadata and packaged D1 migration resources.

The migration originates at [deploy/migrations/0000_paperplay.sql](../deploy/migrations/0000_paperplay.sql). Apply it through the retained native hosting workflow before enabling paid work or short links. A local artifact's placeholder database identity does not provision a real database. The build scans output for private runtime files and configured secret values, and fails if they leak.

Configure `MODEL_API_KEY`, model/creation-cutoff settings and stable signing secrets as runtime secrets/bindings, never static frontend values. Configure `ANALYSIS_APP_ORIGIN` to the actual deployed origin. D1 supplies shared atomic quota reservations and public-link storage. Missing D1 disables new paid requests and link storage instead of falling back to per-isolate memory. Accepted-job status/cancellation remains separately recoverable with valid provider and signing configuration. See [operations](operations.md).

The user explicitly chose to retain private access. Keep hosting authentication enabled. Invite intended judges through the authorized hosting interface and verify their access individually; do not assume possession of the private URL grants access. A public snapshot link still inherits the hosted site's access boundary. Authentication at the hosting layer and possession of a snapshot deletion token are different controls.

## Release checks

Retain these checks on the actual deployed origin. The linked smoke reports establish the completed infrastructure, link and inference checks; remaining invited-judge access, broader browser/lifecycle and portal checks must keep their own scope:

1. Confirm the intended account can open the site, unintended viewers cannot, and any explicitly invited judge can authenticate. Retain private access as requested.
2. Confirm HTML, health, PDF worker, engine worker and pinned paper assets load from that origin. Health should identify the Worker runtime and D1 quota store.
3. Run a prepared graph change/comparison and the matrix/plot example, including a narrow viewport. Inspect browser errors and worker requests.
4. Verify missing/disabled Meta configuration leaves reading, prepared simulations and saved bundles usable. Keep this check free of paid calls.
5. Verify shared quota persistence and fail-closed behavior with provider stubs or administrative inspection. Confirm replicas use the same store; a process-local check is insufficient.
6. Create/open/delete a prepared public short link only within the authorized audience, and verify explicit bundle import locally. Do not publish private imported paper content.
7. If authorized and credits are confirmed, make one bounded real Meta import, record observed usage and reuse its saved result for rehearsal. Do not infer balance from success.

The actual account plan must support the workload. Review the official [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/); the Worker memory limit is 128 MB per isolate. Hosting cost/credit allowances are not established by this repository.

## Optional Node container

The [Dockerfile](../Dockerfile) packages the standalone Next Node output on pinned Node 24.14.0. [compose.yml](../compose.yml) mounts persistent quota/short-link SQLite storage at `/data` and passes runtime variables from the invoking environment. `.env.local` is excluded from the build context; Compose does not automatically load it as its variable source. Export the intended runtime variables or supply an explicitly managed Compose environment file outside the source artifact.

```sh
docker compose up --build -d
docker compose logs --tail=50 paperplay
docker compose down
```

Keep the named `paperplay-data` volume when stopping the container; deleting it resets local quota history and removes stored short links. This is a single-host distribution, so separate container hosts still need the shared-store configuration above. The final image `sha256:192b3681d92cc979e89bd413d3a01019dedafb7ad25f0dede25dc1abb170d557` was built and actually served on port 3007. Health identified M5 with Meta unconfigured; HTML, PDF worker and engine worker returned HTTP 200. The smoke container was stopped afterward. This verifies that image on one host, not multi-host quota coordination or sustained load.

## Submission handoff

The actual [70-second demo video](../artifacts/paperplay-demo.mp4) has burned English captions and no audio; [SRT](../artifacts/paperplay-demo.srt) and five screenshots are retained locally. It records the localhost production UI and reuses a genuine saved Meta result without another paid request. Authenticated hackathon submission fields and video constraints remain unverified. The [submission draft](submission-draft.md) is review material, not a submitted entry. The [demo script](demo-script.md) uses an editorial two-to-three-minute target, not a claimed portal rule.

## Final deployed revision

The final private version was deployed successfully on 27 October 2026 from isolated source commit `a7cf7a5966a9245dcb2a02837d2a56c6e640ad6a`, runtime environment revision 2. [deployment-report.json](deployment-report.json) records its exact saved-version and deployment IDs. [hosted-release-smoke.json](hosted-release-smoke.json) verifies the final runtime health and retrieval/revalidation of the existing 18-page Meta analysis with zero new paid requests. Owner-private access was deliberately preserved. A final artifact scan checked 293 output files and found zero occurrences of the actual configured API key; source and deployment archives excluded private environment files and checkpoints. Post-deployment evidence documents are local handoff records and do not claim a further source deployment.
