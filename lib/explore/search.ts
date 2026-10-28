import * as cheerio from 'cheerio';
import { fetchArxivResource, parseArxivId } from '../import/arxiv';
import { EXPLORE_PAGE_SIZE, exploreSubjectIds, arxivPaperSchema, exploreQuerySchema, type ExploreQuery, type ExploreResult } from '../../shared/explore';

export class ExploreBusyError extends Error {}
export function arxivSearchUrl(input: ExploreQuery) {
  const query = exploreQuerySchema.parse(input);
  const prefix = { all: 'all', title: 'ti', author: 'au' }[query.field];
  // A literal phrase preserves stopwords in titles such as "Attention Is All You Need".
  // Never forward user-supplied Lucene operators, wildcards or field names.
  const terms = query.q.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  if (query.q && !terms.length) throw new Error('Enter a topic, title or author using letters or numbers.');
  const clauses = terms.length ? [`${prefix}:"${terms.join(' ')}"`] : [];
  if (query.category) { const subjects=exploreSubjectIds(query.category); clauses.push(subjects.length===1?`cat:${subjects[0]}`:`(${subjects.map(id=>`cat:${id}`).join(' OR ')})`); }
  if (query.since) clauses.push(`submittedDate:[${query.since}01010000 TO 299912312359]`);
  // A leading all-field wildcard currently fails upstream with HTTP 500.
  // The documented submission-date range covers the archive without selecting a discipline.
  if (!clauses.length) clauses.push('submittedDate:[199101010000 TO 299912312359]');
  const url = new URL('https://export.arxiv.org/api/query');
  url.search = new URLSearchParams({ search_query: clauses.join(' AND '), start: String(query.start), max_results: String(EXPLORE_PAGE_SIZE),
    sortBy: !query.q && query.sort === 'relevance' ? 'submittedDate' : { relevance: 'relevance', newest: 'submittedDate', updated: 'lastUpdatedDate' }[query.sort], sortOrder: 'descending' }).toString();
  return url.href;
}

export function parseArxivFeed(xml: string, query: ExploreQuery, fetchedAt: number): ExploreResult {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('arXiv returned an unsupported feed.');
  const $ = cheerio.load(xml, { xmlMode: true });
  const feed = $('feed');
  if (feed.length !== 1 || !feed.children('id').length) throw new Error('arXiv returned an invalid search feed.');
  const total = Number(feed.children('opensearch\\:totalResults').text());
  if (!Number.isSafeInteger(total) || total < 0 || !feed.children('opensearch\\:totalResults').length) throw new Error('arXiv search totals are unavailable.');
  const entries = feed.children('entry');
  if (entries.length > EXPLORE_PAGE_SIZE) throw new Error('arXiv returned too many search results.');
  const papers = entries.map((_, element) => {
    const node = $(element);
    const rawId = node.children('id').text().trim().replace(/^http:\/\/arxiv.org\//, 'https://arxiv.org/');
    if (rawId.startsWith('http://arxiv.org/api/errors') || rawId.includes('/api/errors')) throw new Error('arXiv could not process this search. Try a simpler query.');
    const text = (selector: string) => node.children(selector).text().replace(/\s+/g, ' ').trim();
    return arxivPaperSchema.parse({ id: parseArxivId(rawId), title: text('title'), abstract: text('summary'),
      authors: node.children('author').map((__, author) => $(author).children('name').text().replace(/\s+/g, ' ').trim()).get(),
      published: text('published'), updated: text('updated'), categories: [...new Set(node.children('category').map((__, cat) => $(cat).attr('term') ?? '').get().filter(Boolean))] });
  }).get();
  if (new Set(papers.map(paper => paper.id)).size !== papers.length) throw new Error('arXiv returned duplicate results. Try again later.');
  return { query, papers, total, fetchedAt };
}

export function createExploreSearch(options: { fetcher?: typeof fetch; now?: () => number; wait?: (ms: number) => Promise<void> } = {}) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const cache = new Map<string, ExploreResult>();
  const pending = new Map<string, Promise<ExploreResult>>();
  let tail = Promise.resolve(); let nextRequestAt = 0;
  return function search(input: ExploreQuery): Promise<ExploreResult> {
    const query = exploreQuerySchema.parse(input);
    const key = arxivSearchUrl(query);
    const cached = cache.get(key);
    if (cached && now() - cached.fetchedAt < 86_400_000) return Promise.resolve(structuredClone({ ...cached, query }));
    const existing = pending.get(key);
    if (existing) return existing.then(result => structuredClone({ ...result, query }));
    if (pending.size >= 8) return Promise.reject(new ExploreBusyError('Search is busy. Please try again in a moment.'));
    const request = tail.then(async () => {
      await wait(Math.max(0, nextRequestAt - now()));
      try {
        const { bytes } = await fetchArxivResource(key, 1_000_000, options.fetcher);
        const result = parseArxivFeed(new TextDecoder().decode(bytes), query, now());
        cache.delete(key); cache.set(key, result);
        if (cache.size > 100) cache.delete(cache.keys().next().value!);
        return result;
      } finally { nextRequestAt = now() + 3000; }
    });
    tail = request.then(() => {}, () => {});
    pending.set(key, request);
    void request.finally(() => pending.delete(key)).catch(() => {});
    return request.then(result => structuredClone(result));
  };
}

// One bounded cache and request queue for the Node process, including dev reloads.
const processState = globalThis as typeof globalThis & { paperplayExploreSearch?: ReturnType<typeof createExploreSearch> };
export const searchArxiv = processState.paperplayExploreSearch ??= createExploreSearch();
