import * as cheerio from 'cheerio';
import {originalSvgImage} from './svg-image';
import { cleanText, normalizeSource, paragraphBlocks, type RawSourceBlock } from './normalize';
import { texOf, textWithTex } from './html-math';
import { sourceBlockSchema, type SourceDocument } from '../../shared/schema';
import type {ExtractionEvidenceManifest} from '../../shared/extraction-evidence';
import {extractHtmlEvidence} from '../extraction/html';

import {parseArxivId} from '../../shared/arxiv-id';
export {parseArxivId} from '../../shared/arxiv-id';
const HOSTS = new Set(['arxiv.org', 'export.arxiv.org']);
const MAX_HTML_BYTES = 2_000_000;
const MAX_ARXIV_PDF_BYTES = 3_000_000;
export type ArxivPayload = { kind: 'html'; source: SourceDocument; originalUrl: string; arxivId: string;extractionEvidence?:ExtractionEvidenceManifest }
  | { kind: 'pdf'; pdfBase64: string; originalUrl: string; arxivId: string; title?: string; authors?: string[] };

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

function arxivHtmlContent(html: string, arxivId: string, url: string, figuresOnly=false) {
  const $ = cheerio.load(html);
  const imageBase = $('base[href]').first().attr('href');
  // LaTeXML uses SVG <object data=...> for some original charts. Retain only
  // the resource reference before removing active embeds; the asset allowlist
  // below still applies, and the reader displays these through inert <img>.
  $('object[type="image/svg+xml"][data]').each((_, element) => {
    const object=$(element);
    object.replaceWith($('<img>').attr('src',object.attr('data')!).attr('alt',object.attr('aria-label')??''));
  });
  const inlineSvgs=new Map<object,string>();
  $('figure,.ltx_figure').each((_,element)=>{const node=$(element),svg=node.find('svg').first();if(svg.length){const image=originalSvgImage($.html(svg));if(image)inlineSvgs.set(element,image);}});
  $('script,style,nav,header,footer,form,iframe,object,svg,canvas,.ltx_page_header,.ltx_page_footer').remove();
  const article = $('article.ltx_document').first().length ? $('article.ltx_document').first() : $('article').first();
  if (!article.length) throw new Error('No structured arXiv article was available.');
  const title = cleanText($('meta[name="citation_title"]').attr('content') || article.find('h1').first().text() || `arXiv ${arxivId}`);
  const authors = $('meta[name="citation_author"]').map((_, element) => $(element).attr('content') || '').get().map(cleanText).filter(Boolean);
  if (!authors.length) article.find('.ltx_personname').each((_, element) => { const name = cleanText($(element).text()); if (name) authors.push(name); });
  const blocks: RawSourceBlock[] = []; let sequence = 0;
  const selector = 'h1,h2,h3,h4,h5,h6,p,.ltx_equation,.ltx_equationgroup,figure,.ltx_figure,table,.ltx_table';
  article.find(selector).each((_, element) => {
    const node = $(element);
    if (figuresOnly && !node.is('figure,.ltx_figure,table,.ltx_table')) return;
    if (node.parents(selector).filter((__, ancestor) => ancestor !== article[0]).length) return;
    const tag = element.tagName?.toLowerCase(); const id = `html-b${++sequence}`;
    if (/^h[1-6]$/.test(tag || '')) {
      const text = cleanText(node.text());
      if (text.length > 500) throw new Error('An HTML heading exceeds the supported source length.');
      if (text) blocks.push({ id, kind: 'heading', page: 1, level: Number(tag![1]), text }); return;
    }
    if (tag === 'figure' || tag === 'table' || node.hasClass('ltx_figure') || node.hasClass('ltx_table')) {
      const inlineSvg=inlineSvgs.get(element);
      const caption = textWithTex($, node.find('figcaption,.ltx_caption,caption').first());
      if (caption.length > 5_000) throw new Error('An HTML figure caption exceeds the supported source length.');
      const tableNode = tag === 'table' ? node : node.find('table').first();
      let table: Extract<SourceDocument['blocks'][number], {kind:'original-figure'}>['table'];
      if (tableNode.length && !tableNode.find('table').length) {
        try {
        const rowNodes = tableNode.find('tr').toArray();
        if(rowNodes.length > 256) throw new Error('Source table exceeds the supported row limit.');
        const rows = rowNodes.map(row => {
          const cells = $(row).children('th,td').toArray();
          if(cells.length > 32) throw new Error('Source table exceeds the supported column limit.');
          return {cells: cells.map(cell => {
            const current=$(cell), text=textWithTex($,current);
            const span=(name:string,max:number)=>{const raw=current.attr(name)??'1';if(!/^[1-9]\d*$/.test(raw)||Number(raw)>max)throw new Error('Unsupported source table span.');return Number(raw);};
            if(text.length>500) throw new Error('Source table cell exceeds the supported length.');
            return {text,header:cell.tagName==='th',rowSpan:span('rowspan',100),colSpan:span('colspan',32)};
          })};
        }).filter(row=>row.cells.length);
        if(rows.length) table={rows};
        } catch {
          // Keep the caption/source link; the evidence inventory reports unsupported structure.
          // Never render a partial grid as though it were the authors' complete table.
          table=undefined;
        }
      }
      const images = node.find('img').toArray().map(image => {
        const src = $(image).attr('src'); if (!src) return undefined;
        try { const paper = new URL(url);
          // arXiv emits both sibling-style and article-prefixed asset paths.
          const articleBase = new URL(paper.href); articleBase.pathname = articleBase.pathname.replace(/\/$/, '') + '/';
          const prefixed = src.startsWith(paper.pathname.split('/').filter(Boolean).at(-1)! + '/');
          const asset = new URL(src, imageBase ? new URL(imageBase,url) : prefixed ? paper : articleBase);
          return asset.protocol === 'https:' && asset.origin === paper.origin && !asset.username && !asset.password && asset.pathname.startsWith(paper.pathname.replace(/\/$/, '') + '/') ? asset.href : undefined;
        } catch { return undefined; }
      }).filter((asset): asset is string => !!asset);
      if (images.length > 8) throw Error('This source figure exceeds the eight-image display limit.');
      if (caption) blocks.push({ id, kind: 'original-figure', page: 1, caption, alt: cleanText(node.find('img').first().attr('alt') || caption).slice(0,1000), sourceUrl: url, ...(images.length ? { imageUrls: [...new Set(images)] } : {}), ...(table ? {table} : {}), ...(inlineSvg?{inlineSvg}:{}) });
      return;
    }
    if (node.hasClass('ltx_equation') || node.hasClass('ltx_equationgroup')) {
      const expressions = node.find('math').toArray().map(math => texOf($, math).trim());
      if (expressions.length && expressions.every(latex => latex && latex.length <= 5_000)) {
        expressions.forEach((latex, index) => blocks.push({ id: `${id}-m${index + 1}`, kind: 'equation', page: 1, latex }));
        return;
      }
    }
    node.find('math').each((__, math) => { const tex = texOf($, math).trim(); $(math).replaceWith($('<span>').text(tex ? `\\(${tex}\\)` : $(math).text())); });
    const text = cleanText(node.text());
    if (text) paragraphBlocks(text, 1, `html-${sequence}`).forEach(block => blocks.push(block));
  });
  return {title,authors,blocks};
}

export function parseArxivOriginalFigures(html:string,arxivId:string,url:string){
  return arxivHtmlContent(html,arxivId,url,true).blocks.filter(block=>block.kind==='original-figure').map(block=>sourceBlockSchema.parse(block));
}

export async function parseArxivHtml(html: string, arxivId: string, url: string): Promise<SourceDocument> {
  const {title,authors,blocks}=arxivHtmlContent(html,arxivId,url);
  if (blocks.filter(block => block.kind === 'paragraph').length < 2) throw new Error('The structured article did not contain enough readable source text.');
  return normalizeSource({ kind: 'arxiv', title, authors, url, pageCount: 1, blocks, identity: arxivId,
    warnings: ['Structured arXiv HTML was imported as one logical document. Source page 1 is an HTML reference, not a physical PDF page number.', 'Available original image asset locations are retained; illustrations without usable image assets keep the original article reference. Inline mathematical boundaries are retained for typesetting; unsupported notation remains visible as source text. Check the original article for exact layout.'] });
}

/** Original structural evidence remains separate from the legacy normalized source block union. */
export async function parseArxivHtmlEvidenced(html:string,arxivId:string,url:string,options:{originalBytes?:Uint8Array}={}){
 const source=await parseArxivHtml(html,arxivId,url);
 const extractionEvidence=await extractHtmlEvidence(html,source,{url,originalBytes:options.originalBytes});
 return {source,extractionEvidence};
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
    const html=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(response.bytes);
    return { kind: 'html', ...await parseArxivHtmlEvidenced(html,id,response.url,{originalBytes:response.bytes}), originalUrl: response.url, arxivId: id };
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
