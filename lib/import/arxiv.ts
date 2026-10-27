import * as cheerio from 'cheerio';
import { cleanText, normalizeSource, paragraphBlocks, type RawSourceBlock } from './normalize';
import type { SourceDocument } from '../../shared/schema';

const ID_PATTERN = /^(?:\d{4}\.\d{4,5}|[a-z][a-z.-]*(?:\.[A-Z]{2})?\/\d{7})(?:v[1-9]\d{0,2})?$/;
const HOSTS = new Set(['arxiv.org', 'export.arxiv.org']);
const MAX_HTML_BYTES = 2_000_000;
const MAX_ARXIV_PDF_BYTES = 3_000_000;
export type ArxivPayload = { kind: 'html'; source: SourceDocument; originalUrl: string; arxivId: string }
  | { kind: 'pdf'; pdfBase64: string; originalUrl: string; arxivId: string; title?: string; authors?: string[] };

export function parseArxivId(value: string): string {
  let id = value.trim().replace(/^arxiv\s*:\s*/i, '');
  if (/^https?:\/\//i.test(id)) {
    const url = new URL(id);
    if (url.protocol !== 'https:' || url.hostname !== 'arxiv.org' || url.port || url.username || url.password) throw new Error('Use an HTTPS arxiv.org paper URL or an arXiv identifier.');
    const match = url.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)\/?$/);
    if (!match) throw new Error('Use an arXiv /abs/, /pdf/ or /html/ paper link.');
    id = decodeURIComponent(match[1]).replace(/\.pdf$/i, '');
  }
  const date = id.includes('/') ? id.split('/')[1].slice(0, 4) : id.slice(0, 4);
  if (!ID_PATTERN.test(id) || Number(date.slice(2, 4)) < 1 || Number(date.slice(2, 4)) > 12) throw new Error('Invalid arXiv identifier. Use a paper ID such as 1805.04154v1.');
  return id;
}
function assertAllowed(url: URL) {
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.port || url.username || url.password || !/^\/(abs|html|pdf|api\/query)(\/|$)/.test(url.pathname)) throw new Error('arXiv redirected to an unapproved destination.');
}
export async function fetchArxivResource(url: string, limit: number, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<{ bytes: Uint8Array; response: Response; url: string }> {
  let target = new URL(url); assertAllowed(target);
  const timeout = AbortSignal.timeout(12_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(target.href, { redirect: 'manual', signal: combined, headers: { 'User-Agent': 'Paperplay/0.1 (research-paper reader)', Accept: 'text/html,application/atom+xml,application/pdf' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('arXiv returned an invalid redirect.');
      target = new URL(location, target); assertAllowed(target); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`arXiv returned HTTP ${response.status}. Try again later or upload the PDF directly.`); }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > limit) { await response.body?.cancel(); throw new Error('This arXiv source exceeds the supported download size. Download it separately and import a shorter PDF.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('arXiv returned an empty response.');
    let size = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.length;
        if (size > limit) throw new Error('This arXiv source exceeds the supported download size. Download it separately and import a shorter PDF.');
        chunks.push(next.value);
      }
    } catch (error) { await reader.cancel(); throw error; }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { bytes, response, url: target.href };
  }
  throw new Error('arXiv returned too many redirects.');
}

function texOf($: cheerio.CheerioAPI, element: Parameters<cheerio.CheerioAPI>[0]) {
  const node = $(element);
  return node.attr('alttext') || node.find('annotation[encoding="application/x-tex"]').first().text();
}
export async function parseArxivHtml(html: string, arxivId: string, url: string): Promise<SourceDocument> {
  const $ = cheerio.load(html);
  const imageBase = $('base[href]').first().attr('href');
  $('script,style,nav,header,footer,form,iframe,object,svg,canvas,.ltx_page_header,.ltx_page_footer').remove();
  const article = $('article.ltx_document').first().length ? $('article.ltx_document').first() : $('article').first();
  if (!article.length) throw new Error('No structured arXiv article was available.');
  const title = cleanText($('meta[name="citation_title"]').attr('content') || article.find('h1').first().text() || `arXiv ${arxivId}`);
  const authors = $('meta[name="citation_author"]').map((_, element) => $(element).attr('content') || '').get().map(cleanText).filter(Boolean);
  if (!authors.length) article.find('.ltx_personname').each((_, element) => { const name = cleanText($(element).text()); if (name) authors.push(name); });
  const blocks: RawSourceBlock[] = []; let sequence = 0;
  const selector = 'h1,h2,h3,h4,h5,h6,p,.ltx_equation,.ltx_equationgroup,figure,.ltx_figure';
  article.find(selector).each((_, element) => {
    const node = $(element);
    if (node.parents(selector).filter((__, ancestor) => ancestor !== article[0]).length) return;
    const tag = element.tagName?.toLowerCase(); const id = `html-b${++sequence}`;
    if (/^h[1-6]$/.test(tag || '')) {
      const text = cleanText(node.text());
      if (text.length > 500) throw new Error('An HTML heading exceeds the supported source length.');
      if (text) blocks.push({ id, kind: 'heading', page: 1, level: Number(tag![1]), text }); return;
    }
    if (tag === 'figure' || node.hasClass('ltx_figure')) {
      const caption = cleanText(node.find('figcaption,.ltx_caption').first().text());
      if (caption.length > 5_000) throw new Error('An HTML figure caption exceeds the supported source length.');
      const images = node.find('img').toArray().map(image => {
        const src = $(image).attr('src'); if (!src) return undefined;
        try { const asset = new URL(src, imageBase ? new URL(imageBase,url) : url); const paper = new URL(url);
          return asset.protocol === 'https:' && asset.origin === paper.origin && !asset.username && !asset.password && asset.pathname.startsWith(paper.pathname.replace(/\/$/, '') + '/') ? asset.href : undefined;
        } catch { return undefined; }
      }).filter((asset): asset is string => !!asset);
      if (images.length > 8) throw Error('This source figure exceeds the eight-image display limit.');
      if (caption) blocks.push({ id, kind: 'original-figure', page: 1, caption, alt: cleanText(node.find('img').first().attr('alt') || caption).slice(0,1000), sourceUrl: url, ...(images.length ? { imageUrls: [...new Set(images)] } : {}) });
      return;
    }
    if (node.hasClass('ltx_equation') || node.hasClass('ltx_equationgroup')) {
      const expressions = node.find('math').toArray().map(math => texOf($, math).trim());
      if (expressions.length && expressions.every(latex => latex && latex.length <= 5_000)) {
        expressions.forEach((latex, index) => blocks.push({ id: `${id}-m${index + 1}`, kind: 'equation', page: 1, latex }));
        return;
      }
    }
    node.find('math').each((__, math) => { const tex = texOf($, math); $(math).replaceWith($('<span>').text(tex || $(math).text())); });
    const text = cleanText(node.text());
    if (text) paragraphBlocks(text, 1, `html-${sequence}`).forEach(block => blocks.push(block));
  });
  if (blocks.filter(block => block.kind === 'paragraph').length < 2) throw new Error('The structured article did not contain enough readable source text.');
  return normalizeSource({ kind: 'arxiv', title, authors, url, pageCount: 1, blocks, identity: arxivId,
    warnings: ['Structured arXiv HTML was imported as one logical document. Source page 1 is an HTML reference, not a physical PDF page number.', 'Available original image asset locations are retained; illustrations without usable image assets keep the original article reference. Inline mathematical notation may remain TeX text; check the original article for exact layout.'] });
}

export async function resolveArxiv(input: string, options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<ArxivPayload> {
  let id = parseArxivId(input); const fetcher = options.fetcher ?? fetch;
  let title: string | undefined; let authors: string[] | undefined;
  if (!/v\d+$/.test(id)) {
    const meta = await fetchArxivResource(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, 200_000, fetcher, options.signal);
    const $ = cheerio.load(new TextDecoder().decode(meta.bytes), { xmlMode: true });
    const entry = $('entry').first();
    const entryUrl = entry.find('id').first().text();
    let pinned = ''; try { pinned = new URL(entryUrl).pathname.replace(/^\/abs\//, ''); } catch { /* Handled below. */ }
    if (!pinned || !/v\d+$/.test(pinned) || parseArxivId(pinned).replace(/v\d+$/, '') !== id) throw new Error('Could not pin the arXiv version. Use an explicit version such as 1805.04154v1 or upload the PDF.');
    id = pinned; title = cleanText(entry.find('title').text()); authors = entry.find('author name').map((_, author) => cleanText($(author).text())).get();
  }
  const htmlUrl = `https://arxiv.org/html/${id}`;
  let htmlFailure = '';
  try {
    const response = await fetchArxivResource(htmlUrl, MAX_HTML_BYTES, fetcher, options.signal);
    if (parseArxivId(response.url) !== id) throw new Error('arXiv redirected to a different paper version.');
    if (!(response.response.headers.get('content-type') || '').includes('html')) throw new Error('Structured HTML unavailable.');
    return { kind: 'html', source: await parseArxivHtml(new TextDecoder().decode(response.bytes), id, response.url), originalUrl: response.url, arxivId: id };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    htmlFailure = error instanceof Error ? error.message : 'Structured HTML unavailable.';
  }
  const pdfUrl = `https://arxiv.org/pdf/${id}`;
  const pdf = await fetchArxivResource(pdfUrl, MAX_ARXIV_PDF_BYTES, fetcher, options.signal);
  if (parseArxivId(pdf.url) !== id) throw new Error('arXiv redirected to a different paper version.');
  if (!new TextDecoder().decode(pdf.bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error(`arXiv did not return a readable PDF. ${htmlFailure}`);
  return { kind: 'pdf', pdfBase64: Buffer.from(pdf.bytes).toString('base64'), originalUrl: pdfUrl, arxivId: id, ...(title ? { title } : {}), ...(authors?.length ? { authors } : {}) };
}
