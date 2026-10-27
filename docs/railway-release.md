# Railway release — deferred

Decision: Railway is the final release target. Do this at the end, after product feature work. No Railway project, service, volume, domain or secret has been created or changed by this planning update. The existing private Sites experiment is retained unchanged; no further Sites integration is planned.

## Final release sequence

1. [PP-078 / #33 — Node container and Railway configuration](https://github.com/ManuelR-T/paperplay/issues/33): reuse the existing Docker/Next target, check runtime port/readiness, configure runtime variables and the writable volume at release.
2. [PP-079 / #34 — Durable state, access and operations](https://github.com/ManuelR-T/paperplay/issues/34): verify SQLite persistence, backup/restore, operating allowances and intended-reader access.
3. [PP-076 / #31 — Actual Railway release smoke](https://github.com/ManuelR-T/paperplay/issues/31): verify assets, questions, accepted-job recovery/cancellation, quotas and snapshots on the final origin. Previous Sites/D1 proof is not Railway proof.

These issues form M11 / slice E and do not block M6–M10 feature development. Local CI and schema/engine verification continue during development; only hosting work is deferred.

## Technical proposal to verify at release

Start from the existing Node container and a single persistent instance. The proposed volume mount is `/data`, with explicit quota/short-link SQLite paths. Recheck [Railway volume availability and permissions](https://docs.railway.com/volumes): the current image uses `USER node`, so image-time ownership alone is not proof that a mounted volume is writable. Resolve and test the runtime permission policy at release.

Recheck [volume limitations](https://docs.railway.com/volumes/reference) before choosing replicas or claiming uninterrupted redeployment. Verify the app against Railway’s runtime `PORT` and [healthcheck behavior](https://docs.railway.com/deployments/healthchecks). Perform a real [backup/restore](https://docs.railway.com/volumes/backups) exercise when storage exists.

Runtime Meta/signing secrets, exact HTTPS origin, real hosting allowances and conservative inference limits will be configured then. Private access remains the current user preference; the Sites login does not automatically protect a Railway URL. Decide and test an explicit access mechanism before sharing the final URL. Do not infer a hosting budget from Meta credits or report application token limits as a billing cap.

The deploy URL, build revision, volume, access evidence and costs remain unverified until the final deployment. This document is a release plan, not provisioning evidence.
