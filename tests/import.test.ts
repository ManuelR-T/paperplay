import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSource, paragraphBlocks, pdfItemsToText, MAX_SOURCE_CHARACTERS } from '../lib/import/normalize';
import { extractPdfWithLibrary } from '../lib/import/pdf-core';
import { fetchArxivResource, parseArxivHtml, parseArxivId, resolveArxiv } from '../lib/import/arxiv';
import { validateDocument } from '../shared/schema';

const sampleHtml = `<!doctype html><html><head><meta name="citation_title" content="A structured test paper"><meta name="citation_author" content="A Researcher"></head><body><article class="ltx_document"><h1>A structured test paper</h1><section><h2>Method</h2><p>We describe a source-grounded method with useful steps and references. This is original explanatory content for the parser fixture, not a scientific result.</p><div class="ltx_equation"><math alttext="f(x)=x^2"><mi>f</mi></math><span>(1)</span></div><p>A second paragraph introduces a graph and its costs. <script>steal()</script><math alttext="a+b"><mi>a</mi></math> remains a mathematical expression.</p><figure><img src="https://evil.invalid/tracker"><figcaption>Figure 1: A source illustration.</figcaption></figure></section></article></body></html>`;
const asFetch = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof fetch;
const htmlResponse = () => new Response(sampleHtml, { headers: { 'Content-Type': 'text/html' } });

test('normalization has stable content identity, source references and explicit size bounds', async () => {
  const input = { kind: 'pdf' as const, title: 'Example', authors: ['A'], pageCount: 2, blocks: [...paragraphBlocks('The first paragraph contains a readable mechanism.', 1), ...paragraphBlocks('The second page has a separate statement.', 2)], warnings: ['Math layout is not certified.'] };
  const a = await normalizeSource(input); const b = await normalizeSource(structuredClone(input));
  assert.equal(a.id, b.id); assert.equal(a.sourceVersion, b.sourceVersion); validateDocument(a);
  assert.equal(a.anchors[1].page, 2); assert.equal(a.extractionWarnings[0], input.warnings[0]);
  const changed = await normalizeSource({ ...input, blocks: paragraphBlocks('A different mechanism.', 1) });
  assert.notEqual(a.id, changed.id);
  await assert.rejects(normalizeSource({ ...input, blocks: paragraphBlocks('x '.repeat(MAX_SOURCE_CHARACTERS), 1) }), /200,000/);
});

test('multi-column geometry is disclosed without inventing an equation or dropping source text', () => {
  const items = Array.from({ length: 14 }, (_, i) => ({ str: `Column ${i} ∑ x`, transform: [10,0,0,10,i % 2 ? 340 : 30,700-i*12], height: 10, hasEOL: true }));
  const extracted = pdfItemsToText(items, 600);
  assert.equal(extracted.possibleColumns, true); assert.match(extracted.text, /Column 13 ∑ x/);
  const blocks = paragraphBlocks(extracted.text, 3); assert.ok(blocks.every(block => block.kind === 'paragraph' && block.page === 3));
});

test('actual publisher PDF extraction retains page provenance and supports cancellation', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = await readFile('public/papers/priority-search-trees.pdf');
  const file = new Blob([bytes], { type: 'application/pdf' });
  const result = await extractPdfWithLibrary(file, { name: 'priority.pdf' }, pdfjs);
  assert.equal(result.source.pageCount, 18); assert.equal(result.original, file);
  assert.ok(result.source.blocks.some(block => block.page === 15));
  assert.ok(result.source.extractionWarnings.some(warning => warning.includes('equation'))); validateDocument(result.source);
  const controller = new AbortController();
  await assert.rejects(extractPdfWithLibrary(file, { signal: controller.signal, onProgress: () => controller.abort() }, pdfjs), { name: 'AbortError' });
});

test('invalid, oversized, encrypted and scanned sources have explicit import failures', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  await assert.rejects(extractPdfWithLibrary(new Blob(['not a PDF document']), {}, pdfjs), /not a PDF/);
  await assert.rejects(extractPdfWithLibrary(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), {}, pdfjs), /10 MB/);
  await assert.rejects(extractPdfWithLibrary(new Blob(['%PDF-1.4\ncorrupt document']), {}, pdfjs), /could not be read/);
  const fake = (document: object) => ({ getDocument: () => ({ promise: Promise.resolve(document), destroy: async () => {} }) }) as unknown as Pick<typeof pdfjs, 'getDocument'>;
  const emptyPage = { getTextContent: async () => ({ items: [] }), getViewport: () => ({ width: 600 }), cleanup: () => {} };
  await assert.rejects(extractPdfWithLibrary(new Blob(['%PDF-1.4 fixture']), {}, fake({ numPages: 1, getPage: async () => emptyPage })), /scanned|image-only/);
  await assert.rejects(extractPdfWithLibrary(new Blob(['%PDF-1.4 fixture']), {}, fake({ numPages: 51 })), /50 pages/);
  const password = { getDocument: () => ({ promise: Promise.reject(Object.assign(new Error('password'), { name: 'PasswordException' })), destroy: async () => {} }) } as unknown as Pick<typeof pdfjs, 'getDocument'>;
  await assert.rejects(extractPdfWithLibrary(new Blob(['%PDF-1.4 fixture']), {}, password), /password-protected/);
});

test('arXiv identifiers are strict and network destinations cannot be supplied arbitrarily', () => {
  assert.equal(parseArxivId('https://arxiv.org/pdf/1805.04154v1.pdf'), '1805.04154v1');
  assert.equal(parseArxivId('arXiv:cs/9901001v2'), 'cs/9901001v2');
  assert.equal(parseArxivId('https://arxiv.org/html/2504.17327v2'), '2504.17327v2');
  for (const input of ['https://evil.invalid/abs/1805.04154','https://arxiv.org.evil.invalid/abs/1805.04154','http://arxiv.org/abs/1805.04154','https://user@arxiv.org/abs/1805.04154','../../etc/passwd','1800.04154','1805.04154v0']) assert.throws(() => parseArxivId(input));
});

test('structured HTML is converted to bounded source blocks without executable markup', async () => {
  const doc = await parseArxivHtml(sampleHtml, '1805.04154v1', 'https://arxiv.org/html/1805.04154v1');
  assert.equal(doc.title, 'A structured test paper'); assert.equal(doc.pageCount, 1); validateDocument(doc);
  assert.ok(doc.blocks.some(block => block.kind === 'equation' && block.latex === 'f(x)=x^2'));
  assert.ok(doc.blocks.some(block => block.kind === 'original-figure'));
  assert.ok(!JSON.stringify(doc).includes('steal()')); assert.ok(!JSON.stringify(doc).includes('evil.invalid'));
  assert.ok(doc.extractionWarnings.some(warning => warning.includes('not a physical PDF page')));
  const grouped = sampleHtml.replace('class="ltx_equation"', 'class="ltx_equationgroup"').replace('<span>(1)</span>', '<math alttext="g(x)=x+1"><mi>g</mi></math>');
  const groupedDoc = await parseArxivHtml(grouped, '1805.04154v1', 'https://arxiv.org/html/1805.04154v1');
  assert.equal(groupedDoc.blocks.filter(block => block.kind === 'equation').length, 2);
  await assert.rejects(parseArxivHtml(sampleHtml.replace('Figure 1: A source illustration.', 'x'.repeat(5001)), '1805.04154v1', 'https://arxiv.org/html/1805.04154v1'), /caption exceeds/);
});

test('arXiv resolver pins unversioned metadata then prefers structured HTML', async () => {
  const requests: string[] = [];
  const fetcher = asFetch(async url => {
    requests.push(url);
    if (url.includes('/api/query')) return new Response('<feed><entry><id>http://arxiv.org/abs/1805.04154v1</id><title>Example</title><author><name>A</name></author></entry></feed>');
    return htmlResponse();
  });
  const result = await resolveArxiv('1805.04154', { fetcher });
  assert.equal(result.kind, 'html'); assert.equal(result.arxivId, '1805.04154v1');
  assert.equal(requests.length, 2); assert.match(requests[1], /\/html\/1805.04154v1$/);
});

test('arXiv HTML absence falls back to a bounded pinned PDF without an arbitrary URL proxy', async () => {
  const bytes = await readFile('public/papers/adaptive-mergesort.pdf');
  const fetcher = asFetch(async url => url.includes('/html/') ? new Response('missing', { status: 404 }) : new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } }));
  const result = await resolveArxiv('1805.04154v1', { fetcher });
  assert.equal(result.kind, 'pdf'); if (result.kind === 'pdf') assert.equal(Buffer.from(result.pdfBase64, 'base64').subarray(0,5).toString(), '%PDF-');
  let calls = 0;
  const redirect = asFetch(async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/metadata' } }); });
  await assert.rejects(fetchArxivResource('https://arxiv.org/html/1805.04154v1', 1000, redirect), /unapproved/);
  assert.equal(calls, 1);
  await assert.rejects(fetchArxivResource('https://arxiv.org/pdf/1805.04154v1', 4, asFetch(async () => new Response(new Uint8Array(10)))), /download size/);
});
