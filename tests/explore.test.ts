import test from 'node:test';
import assert from 'node:assert/strict';
import { arxivSearchUrl, createExploreSearch, ExploreBusyError, parseArxivFeed } from '../lib/explore/search';
import { exploreQuerySchema, readerUrl, type ArxivPaper } from '../shared/explore';
import { readSavedPapers, toggleSavedPaper, SAVED_PAPERS_KEY } from '../lib/explore/saved';

const query = exploreQuerySchema.parse({ q: 'graph search', category: 'cs.DS' });
const entry = `<entry><id>http://arxiv.org/abs/1805.04154v1</id><title>A &amp; B\n on graphs</title><summary>Original abstract with &lt;script&gt;literal markup&lt;/script&gt;.</summary><published>2018-05-10T12:00:00Z</published><updated>2018-05-11T12:00:00Z</updated><author><name>A Researcher</name></author><category term="cs.DS"/></entry>`;
const feed = (entries = entry, total = 25) => `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"><id>http://arxiv.org/api/query</id><opensearch:totalResults>${total}</opensearch:totalResults>${entries}</feed>`;
const paper = (): ArxivPaper => parseArxivFeed(feed(), query, 100).papers[0];
const fakeFetch = (fn: (url: string) => Promise<Response>) => fn as unknown as typeof fetch;
function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test('exploration translates literal words and validated filters into bounded arXiv queries', () => {
  const url = new URL(arxivSearchUrl({ ...query, q: 'graph OR ti:secret', since: '2020', field: 'title', start: 12, sort: 'updated' }));
  assert.equal(url.origin, 'https://export.arxiv.org');
  assert.equal(url.searchParams.get('search_query'), 'ti:"graph OR ti secret" AND cat:cs.DS AND submittedDate:[202001010000 TO 299912312359]');
  assert.equal(url.searchParams.get('max_results'), '12'); assert.equal(url.searchParams.get('start'), '12');
  assert.equal(url.searchParams.get('sortBy'), 'lastUpdatedDate');
  for (const invalid of [{ start: -1 }, { start: 1 }, { start: 1008 }, { q: 'a'.repeat(201) }, { q: '***' }, { category: 'cs.DS OR all:*' }, { since: '2020] OR all:*' }, { field: 'url' }]) assert.equal(exploreQuerySchema.safeParse(invalid).success, false);
  assert.equal(new URL(arxivSearchUrl(exploreQuerySchema.parse({}))).searchParams.get('sortBy'), 'submittedDate');
});

test('Atom metadata retains authors, version and plain text while ignoring supplied links', () => {
  const result = parseArxivFeed(feed(entry.replace('</entry>', '<link href="https://evil.invalid"/></entry>')), query, 123);
  assert.equal(result.total, 25); assert.equal(result.fetchedAt, 123);
  assert.equal(result.papers[0].title, 'A & B on graphs'); assert.equal(result.papers[0].id, '1805.04154v1');
  assert.match(result.papers[0].abstract, /<script>literal markup<\/script>/);
  assert.equal(JSON.stringify(result).includes('evil.invalid'), false);
  assert.equal(readerUrl('cs/9901001v2'), '/?arxiv=cs%2F9901001v2');
  assert.deepEqual(parseArxivFeed(feed('', 0), query, 1).papers, []);
  for (const xml of ['<html>unavailable</html>', feed(entry.replace('http://arxiv.org/abs/', 'https://evil.invalid/abs/')), feed(entry + entry), feed(entry.repeat(13)), feed().replace('25</opensearch', 'oops</opensearch'), '<!DOCTYPE feed [<!ENTITY a "x">]>' + feed()]) assert.throws(() => parseArxivFeed(xml, query, 1));
});

test('search coalesces concurrent requests, isolates cached results and refreshes after a day', async () => {
  let calls = 0; let clock = 100; const waits: number[] = [];
  const search = createExploreSearch({ now: () => clock, wait: async ms => { waits.push(ms); clock += ms; }, fetcher: fakeFetch(async () => { calls++; return new Response(feed()); }) });
  const [a, b] = await Promise.all([search(query), search(query)]);
  assert.equal(calls, 1); a.papers[0].title = 'Changed in the caller'; assert.notEqual(b.papers[0].title, a.papers[0].title);
  assert.notEqual((await search(query)).papers[0].title, a.papers[0].title); assert.equal(calls, 1);
  await search({ ...query, start: 12 }); assert.equal(calls, 2); assert.equal(waits[1], 3000);
  clock += 86_400_001; await search(query); assert.equal(calls, 3);
});

test('failed upstream searches leave the queue usable and are never cached as successful empty results', async () => {
  let calls = 0; let clock = 0;
  const search = createExploreSearch({ now: () => clock, wait: async ms => { clock += ms; }, fetcher: fakeFetch(async () => { calls++; return calls === 1 ? new Response('upstream unavailable', { status: 503 }) : new Response(feed()); }) });
  await assert.rejects(search(query), /HTTP 503/);
  assert.equal((await search(query)).papers.length, 1); assert.equal(calls, 2); assert.equal(clock, 3000);
});

test('search rejects excess queued work rather than starting parallel arXiv calls', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const search = createExploreSearch({ wait: async () => {}, fetcher: fakeFetch(async () => { await gate; return new Response(feed()); }) });
  const requests = Array.from({ length: 8 }, (_, index) => search({ ...query, q: `topic${index}` }));
  await assert.rejects(search({ ...query, q: 'overflow' }), ExploreBusyError);
  release(); await Promise.all(requests);
});

test('saved papers survive a reload, toggle by exact version and preserve data on corruption or quota failure', () => {
  const storage = memory(); const original = paper();
  assert.deepEqual(readSavedPapers(storage), []);
  toggleSavedPaper(storage, original); assert.equal(readSavedPapers(storage)[0].id, original.id);
  toggleSavedPaper(storage, { ...original, id: '1805.04154v2' }); assert.equal(readSavedPapers(storage).length, 2);
  toggleSavedPaper(storage, original); assert.equal(readSavedPapers(storage).length, 1);
  const before = storage.getItem(SAVED_PAPERS_KEY);
  assert.throws(() => toggleSavedPaper({ ...storage, setItem() { throw new Error('Quota exceeded'); } }, original), /Quota/);
  assert.equal(storage.getItem(SAVED_PAPERS_KEY), before);
  storage.setItem(SAVED_PAPERS_KEY, '{broken');
  assert.throws(() => toggleSavedPaper(storage, original)); assert.equal(storage.getItem(SAVED_PAPERS_KEY), '{broken');
});

test('official dated taxonomy covers every group, exact category and physics archive without query injection',async()=>{
 const {ARXIV_GROUPS,ARXIV_ARCHIVES,ARXIV_SUBJECTS,exploreSubjectGroup,exploreSubjectIds}=await import('../shared/explore');
 assert.equal(ARXIV_GROUPS.length,8);assert.equal(ARXIV_SUBJECTS.length,155);assert.equal(ARXIV_ARCHIVES.length,13);
 assert.equal(new Set(ARXIV_SUBJECTS.map(item=>item.value)).size,155);
 for(const group of ARXIV_GROUPS){const selection=`group:${group.id}`,ids=exploreSubjectIds(selection);assert.ok(ids.length);assert.equal(exploreSubjectGroup(selection),group.id);const input=exploreQuerySchema.parse({category:selection});const clause=new URL(arxivSearchUrl(input)).searchParams.get('search_query')!;for(const id of ids)assert.ok(clause.includes(`cat:${id}`));assert.equal(clause.includes('*'),false);}
 for(const subject of ARXIV_SUBJECTS){assert.equal(exploreQuerySchema.safeParse({category:subject.value}).success,true);assert.deepEqual(exploreSubjectIds(subject.value),[subject.value]);assert.equal(exploreSubjectGroup(subject.value),subject.group);}
 const astro=exploreSubjectIds('archive:astro-ph');assert.equal(astro.length,6);assert.equal(astro.includes('quant-ph'),false);assert.equal(exploreSubjectGroup('archive:astro-ph'),'physics');
 for(const unsupported of ['group:chemistry','group:physics OR all:*','archive:physics.*','physics.unknown','cs.*'])assert.equal(exploreQuerySchema.safeParse({category:unsupported}).success,false);
});

test('unfiltered discovery uses a dated all-archive query rather than the upstream-failing all-field wildcard', async () => {
  let observed = '';
  const search = createExploreSearch({ wait: async () => {}, fetcher: fakeFetch(async url => {
    observed = new URL(url).searchParams.get('search_query') ?? '';
    return observed === 'all:*' ? new Response('Internal Server Error', { status: 500 }) : new Response(feed());
  }) });
  const result = await search(exploreQuerySchema.parse({}));
  assert.equal(result.papers.length, 1);
  assert.equal(observed, 'submittedDate:[199101010000 TO 299912312359]');
  assert.equal(new URL(arxivSearchUrl(exploreQuerySchema.parse({ start: 12 }))).searchParams.get('start'), '12');
});
