# Explore arXiv

`/explore` is the discovery entry point; the existing reader links to it on desktop and mobile.

## Reading flow

- Discover starts with recent papers across all subjects from the real arXiv Atom API. The dated [official taxonomy](https://arxiv.org/category_taxonomy) snapshot, checked28October2026, exposes all155 listed categories across8 groups, including the13 Physics archives. The snapshot includes official alias categories; it does not claim to update live when arXiv changes its taxonomy. Group and archive buttons immediately browse their papers; the grouped category select exposes exact category identifiers and changes the result set in one action. Topic shortcuts and search support a literal phrase in all fields, title or author, publication start year, and relevance/newest/updated ordering.
- Twelve results per page include the authors' title, abstract, submission date, categories, original link and exact arXiv version. Paper titles open the reader directly. A separate abstract action exposes the complete returned abstract, with category buttons that browse that subject inside Paperplay. Categories on paper cards also link to their Paperplay result lists. Metadata and text render as React text, never executable feed markup.
- Search state is URL-addressable, including pagination, with back/forward restoration. The form uses explicit submission; typing does not call arXiv.
- Saved papers persist in this browser under a separate versioned local-storage key. Saving retains metadata only, up to 100 entries. Quota/access/invalid-data failures are reported without overwriting existing data. Other tabs synchronize through storage events. Removing a favorite does not remove an imported paper, reading position or widgets.
- **Open in Paperplay** sends the exact versioned identifier through `/?arxiv=…` to the existing reader. An already imported matching version is selected; otherwise the source is imported through the existing source preparation and failure/cancellation UI. The reader owns the new automatic Meta preparation workflow and its persistent deduplication, budget, stop/error and source-grounding gates. Discovery itself does not create a model job; opening a paper can request automatic preparation under that reader policy. An upstream access failure, unsupported extraction or invalid model output never becomes a fabricated paper or successful figure.

## Server boundary

`GET /api/explore` validates filters and pagination before accessing a fixed HTTPS arXiv API endpoint. Query strings are constructed as literal phrases, with validated subject/date clauses; external links in feed entries are ignored. `group:<id>` and `archive:<id>` are internal filter identifiers, expanded only through the installed taxonomy to parenthesized OR clauses over exact category identifiers. Arbitrary wildcards, unknown categories/groups and user-supplied operators remain rejected. No taxonomy scraping occurs during page viewing. The existing bounded network helper restricts redirects, timeouts and body size. The feed parser validates pinned identifiers, dates, lengths, page size and totals, and rejects entity declarations.

`lib/explore/search.ts` owns a process-local shared cache (24 hours, at most 100 pages), request coalescing and a serial search queue (at most 8 distinct pending queries). Search calls are separated by at least 3 seconds after the previous response, including failures. Failures are not cached as successful empty results. There are no automatic retries or model requests. A disconnected browser can leave a shared upstream request to finish and fill the cache.

Pagination stops after the first 1,008 results and asks users to refine broad searches. This is discovery, not a bulk arXiv mirror. Multiple server replicas would require a shared queue/cache to coordinate their upstream traffic; the MVP uses one Node process. The existing source-import resolver has its own bounded network flow.

The implementation follows the [official arXiv API manual](https://info.arxiv.org/help/api/user-manual.html), including Atom search, field prefixes, sorting, pagination, caching and request spacing. arXiv metadata does not imply an independent scientific verification or permission to redistribute every paper; the reader retains its existing attribution and source handling.

## Validation

`npm run check` covers strict TypeScript, deterministic tests and the production Next build. Exploration tests cover query construction, hostile feeds/URLs, shared cache isolation/expiry, request spacing, queue overload, upstream failure recovery, and favorite persistence/data preservation. The import-controller test verifies that the exploration read-only import never starts a model request. Routine checks do not call arXiv or Meta.

Live browser checks use actual arXiv results and verify discovery, abstract preview, persisted favorites, mobile layout and source import. No Meta inference is needed for this feature.

## Broader discovery validation

The focused exploration suite verifies all155 unique category identifiers,8 nonempty group filters,13 physics archive filters, exact group/category membership and rejection of unknown/injected filters. Existing feed, cache, coalescing, spacing, queue-overload, pagination and saved-data recovery tests remain in place. This expands the discoverable taxonomy; it does not mirror all arXiv PDFs, bypass publisher access limits or remove the1,008-result refinement boundary.
