# Security and privacy notes

This document describes implemented boundaries and operational responsibilities. It is not an independent security audit or a guarantee that the application is vulnerability-free.

## Report a concern

Do not put API keys, session/job capabilities, private source text or personal documents in a public issue. Use GitHub private vulnerability reporting if it is enabled for the repository, or contact the maintainer through an established private channel. No security email address or response-time commitment is asserted here.

## Credentials and source content

Meta credentials and signing secrets are server-only runtime configuration. Keep `.env*` and private `.paperplay/` runtime state out of source archives, client assets and deployment traces. Never prefix an inference key with `NEXT_PUBLIC_`, place it in a URL, or log full provider errors.

A local PDF is extracted in the browser. Relevant normalized text is sent to Meta when the user explicitly starts analysis or a contextual question; this does not make inference offline. arXiv import uses restricted source destinations. Source text, originals, analyses and reading state remain in browser storage unless an explicit export or supported sharing action transfers them. Browser settings or private-mode cleanup can erase that storage.

Experiment bundles explicitly distinguish metadata, source text and source-plus-PDF inclusion. Treat an imported bundle as untrusted data, not an author signature. Bundles must not contain provider jobs, API keys, session cookies or management capabilities. A public snapshot link is not a means of transferring a private local PDF.

## Execution and inference boundaries

Only the application registry implements executable algorithms. Model output selects bounded schema variants and registered engines; it is not arbitrary code. Source content and questions are untrusted data. Validation checks source references, quotation/page consistency, parameter bounds, engine compatibility and safe plain-text output before activation.

A matching quote proves a location, not scientific truth. Unsupported methods and incomplete computations must stay labeled. Equations render with untrusted/limited math settings, and missing PDF diagrams or notation must not be filled by model guesses.

Workers run trusted application code, validate their versioned messages, cap work/transfer size and terminate on cancellation or timeout. An obsolete result must not replace a newer input. Keep these bounds when adding algorithms or larger data.

## Anonymous access and spending

Inference creation requires same-origin checks and shared durable reservations before calling the provider. Accepted background jobs use signed capabilities scoped to the browser session and source identity; another browser must not retrieve/cancel them by changing a response ID. Losing a response before its capability is saved produces an explicit uncertain state, never an automatic duplicate paid creation.

Quotas count requests and conservative token reservations across analyses and questions. SQLite is appropriate only for processes sharing one persistent volume; distributed hosts need a correctly configured shared store. A missing/unavailable required store must fail closed. Keep inference/session limits and global allowances at server endpoints, including direct requests.

Reported tokens are provider measurements when available. Unknown work retains a conservative reservation. These controls are not a hard currency cap, cannot reveal remaining Meta credit, and do not replace provider billing controls. Use `META_ANALYSIS_ENABLED=false` or a configured expiry cutoff to stop new inference while retaining prepared/local reading; accepted-job status/cancellation is a separate lifecycle.

## Optional public short links

The short-link implementation is for explicitly selected **prepared public snapshots**, with canonical public metadata plus chosen input/seed/settings. It must reject private paper/PDF uploads. Access is by an unguessable URL, not by a product account; anyone holding that link can read the public snapshot while valid.

Links have a bounded expiry and a separate deletion capability. Do not place the deletion token in the public URL or exported experiment. Deletion cannot revoke copies, screenshots, earlier downloads or a recipient's already-restored local experiment. Verify the actual shared-store adapter, quota, expiry and deletion behavior when enabling hosted links.

## Deployment review

Before enabling public inference, verify the exact allowed origin, stable signing configuration, private runtime-secret handling, persistent/shared quota store, direct-route limits and browser ownership isolation. Preserve prepared-demo fallback if provider access fails or funding stops. A reserved/private deployment address is not evidence of public access or successful hosted verification.

Keep Node, PDF.js, math-rendering and framework dependencies current within tested compatibility. Run the repository's checks and inspect relevant advisories when updating them; an inventory or clean package audit is not a comprehensive application audit.
