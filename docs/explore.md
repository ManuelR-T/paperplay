# Explore arXiv

`/explore` is the discovery entry point; the existing reader links to it on desktop and mobile.

## Reading flow

- Discover starts with recent `cs.AI` papers from the real arXiv Atom API. Topic shortcuts and search support a literal phrase in all fields, title or author, a subject, publication start year, and relevance/newest/updated ordering.
- Twelve results per page include the authors' title, abstract, submission date, categories, original link and exact arXiv version. The abstract dialog exposes the complete returned abstract. Metadata and text render as React text, never executable feed markup.
- Search state is URL-addressable, including pagination, with back/forward restoration. The form uses explicit submission; typing does not call arXiv.
- Saved papers persist in this browser under a separate versioned local-storage key. Saving retains metadata only, up to 100 entries. Quota/access/invalid-data failures are reported without overwriting existing data. Other tabs synchronize through storage events. Removing a favorite does not remove an imported paper, reading position or widgets.
- **Open in Paperplay** sends a versioned identifier to the existing reader. An already imported matching version is selected; otherwise the source is imported with `analyze: false`. The source preparation and failure/cancellation UI remain the existing import pipeline. Generating widgets remains an explicit Meta action. Opening a result does not guarantee that extraction supports every PDF or that the paper has interactive figures.

## Server boundary

`GET /api/explore` validates filters and pagination before accessing a fixed HTTPS arXiv API endpoint. Query strings are constructed as literal phrases, with validated subject/date clauses; external links in feed entries are ignored. The existing bounded network helper restricts redirects, timeouts and body size. The feed parser validates pinned identifiers, dates, lengths, page size and totals, and rejects entity declarations.

`lib/explore/search.ts` owns a process-local shared cache (24 hours, at most 100 pages), request coalescing and a serial search queue (at most 8 distinct pending queries). Search calls are separated by at least 3 seconds after the previous response, including failures. Failures are not cached as successful empty results. There are no automatic retries or model requests. A disconnected browser can leave a shared upstream request to finish and fill the cache.

Pagination stops after the first 1,008 results and asks users to refine broad searches. This is discovery, not a bulk arXiv mirror. Multiple server replicas would require a shared queue/cache to coordinate their upstream traffic; the MVP uses one Node process. The existing source-import resolver has its own bounded network flow.

The implementation follows the [official arXiv API manual](https://github.com/arXiv/arxiv-docs/blob/develop/source/help/api/user-manual.md), including Atom search, field prefixes, sorting, pagination, caching and request spacing. arXiv metadata does not imply an independent scientific verification or permission to redistribute every paper; the reader retains its existing attribution and source handling.

## Validation

`npm run check` covers strict TypeScript, deterministic tests and the production Next build. Exploration tests cover query construction, hostile feeds/URLs, shared cache isolation/expiry, request spacing, queue overload, upstream failure recovery, and favorite persistence/data preservation. The import-controller test verifies that the exploration read-only import never starts a model request. Routine checks do not call arXiv or Meta.

Live browser checks use actual arXiv results and verify discovery, abstract preview, persisted favorites, mobile layout and source import. No Meta inference is needed for this feature.
