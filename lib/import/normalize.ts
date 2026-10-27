import { validateDocument, type SourceDocument } from '../../shared/schema';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const MAX_SOURCE_CHARACTERS = 200_000;
export const NORMALIZER_VERSION = 'source-v3';
export type RawSourceBlock = SourceDocument['blocks'][number];

export function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError');
}
export function cleanText(text: string) {
  return text.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function normalizeSource(input: {
  kind: 'pdf' | 'arxiv'; title: string; authors?: string[]; url?: string;
  pageCount: number; blocks: RawSourceBlock[]; warnings?: string[]; identity?: string; reconstruction?: SourceDocument['reconstruction'];
}): Promise<SourceDocument> {
  if (!input.blocks.length) throw new Error('No readable source content was found. Import a text PDF rather than a scanned image.');
  const count = input.blocks.reduce((sum, block) => sum + (block.kind === 'equation' ? block.latex.length : block.kind === 'original-figure' ? block.caption.length : block.text.length), 0);
  if (count > MAX_SOURCE_CHARACTERS) throw new Error('This source exceeds the 200,000-character import limit. Import a shorter excerpt; content was not silently truncated.');
  const normalized = input.blocks.map(block => {
    if (block.kind === 'equation') return { ...block, latex: block.latex.trim() };
    if (block.kind === 'original-figure') return { ...block, caption: cleanText(block.caption), alt: cleanText(block.alt) };
    return { ...block, text: cleanText(block.text) };
  });
  if (normalized.length > 1_000) throw new Error('This source contains more than 1,000 extracted blocks. Import a shorter excerpt; content was not silently omitted.');
  const identity = await sha256(JSON.stringify({ normalizer: NORMALIZER_VERSION, identity: input.identity ?? '', kind: input.kind, url: input.url ?? '', title: cleanText(input.title), authors: input.authors ?? [], pageCount: input.pageCount, blocks: normalized }));
  return validateDocument({
    schemaVersion: 1, id: `import-${identity.slice(0, 32)}`, sourceVersion: `${NORMALIZER_VERSION}:${identity}`,
    title: cleanText(input.title).slice(0, 500) || 'Imported research paper',
    authors: (input.authors?.length ? input.authors : ['Author metadata unavailable']).map(author => cleanText(author).slice(0, 200)).filter(Boolean).slice(0, 100),
    source: { kind: input.kind, ...(input.url ? { url: input.url } : {}) },
    pageCount: input.pageCount, blocks: normalized,
    anchors: normalized.filter(block => block.kind !== 'heading').map((block, index) => ({ id: `source-anchor-${index + 1}`, blockId: block.id, page: block.page,
      quote: (block.kind === 'equation' ? block.latex : block.kind === 'original-figure' ? block.caption : block.text).slice(0, 300) })),
    extractionWarnings: [...new Set(input.warnings ?? [])],
    ...(input.reconstruction ? { reconstruction: input.reconstruction } : {}),
  });
}

/** Split only at whitespace; each chunk retains the original page and ordering. */
export function paragraphBlocks(text: string, page: number, prefix = 'pdf'): RawSourceBlock[] {
  const paragraphs = text.split(/\n\s*\n/).map(cleanText).filter(Boolean);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    let rest = paragraph;
    while (rest.length > 4_000) {
      let boundary = rest.lastIndexOf(' ', 4_000);
      if (boundary < 1) boundary = 4_000;
      chunks.push(rest.slice(0, boundary)); rest = rest.slice(boundary).trimStart();
    }
    if (rest) chunks.push(rest);
  }
  return chunks.map((text, index) => ({ id: `${prefix}-p${page}-b${index + 1}`, kind: 'paragraph', page, text }));
}

export type PdfTextItem = { str: string; transform: number[]; height?: number; width?: number; hasEOL?: boolean };
export function pdfItemsToTextLegacy(items: PdfTextItem[], width: number) {
  const lines: Array<{ text: string; x: number; y: number; height: number }> = [];
  let line: typeof lines[number] | undefined;
  for (const item of items) {
    const text = item.str.replace(/\u0000/g, ''); if (!text.trim()) continue;
    const x = item.transform[4]; const y = item.transform[5];
    if (!line || Math.abs(y - line.y) > Math.max(2, line.height * .4)) {
      line = { text, x, y, height: Math.max(item.height ?? 0, Math.abs(item.transform[3]) || 10) }; lines.push(line);
    } else line.text += (line.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ') + text;
    if (item.hasEOL) line = undefined;
  }
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    const prior = lines[i - 1]; const next = lines[i];
    result += (i ? (Math.abs(prior.y - next.y) > Math.max(prior.height, next.height) * 1.65 ? '\n\n' : '\n') : '') + next.text;
  }
  const left = lines.filter(line => line.x < width * .35).length;
  const right = lines.filter(line => line.x > width * .45).length;
  return { text: result, possibleColumns: left >= 6 && right >= 6 };
}


type PositionedLine = { text: string; x: number; right: number; y: number; height: number };
/** Geometry repair is conservative: only strong, overlapping two-column bands are reordered. */
export function pdfItemsToText(items: PdfTextItem[], width: number) {
  if (!Number.isFinite(width) || width <= 0) throw new Error('The PDF page has invalid layout dimensions.');
  const fragments = items.filter(item => item.str.replace(/\u0000/g, '').trim()).map(item => {
    const height = Math.max(1, item.height ?? (Math.abs(item.transform[3]) || 10));
    const x = item.transform[4]; const y = item.transform[5];
    const measuredWidth = Number.isFinite(item.width) && item.width! >= 0 ? item.width! : item.str.length * height * .5;
    return { text: item.str.replace(/\u0000/g, ''), x, right: x + measuredWidth, y, height };
  }).filter(item => [item.x, item.y, item.right, item.height].every(Number.isFinite));
  const rows: Array<{ y: number; height: number; fragments: typeof fragments }> = [];
  for (const item of [...fragments].sort((a,b) => b.y-a.y || a.x-b.x)) {
    const row = rows.find(candidate => Math.abs(candidate.y-item.y) <= Math.max(2, Math.min(candidate.height, item.height)*.4));
    if (row) { row.fragments.push(item); row.height = Math.max(row.height, item.height); }
    else rows.push({ y: item.y, height: item.height, fragments: [item] });
  }
  const lines: PositionedLine[] = [];
  for (const row of rows.sort((a,b) => b.y-a.y)) {
    let line: PositionedLine | undefined;
    for (const fragment of row.fragments.sort((a,b) => a.x-b.x)) {
      const gap = line ? fragment.x-line.right : 0;
      if (!line || gap > Math.max(width*.025, row.height*1.5)) {
        line = { ...fragment, height: row.height }; lines.push(line);
      } else {
        const space = gap > Math.max(.7, row.height*.11) && !line.text.endsWith(' ') && !fragment.text.startsWith(' ') ? ' ' : '';
        line.text += space + fragment.text; line.right = Math.max(line.right, fragment.right);
      }
    }
  }
  const leftOfGutter = (line: PositionedLine) => line.x < width*.4 && line.right < width*.58;
  const rightOfGutter = (line: PositionedLine) => line.x >= width*.45;
  const narrative = (line: PositionedLine) => line.right-line.x >= width*.18 && (line.text.match(/[A-Za-z]{3,}/g)?.length ?? 0) >= 4;
  const prose = lines.filter(narrative);
  const left = prose.filter(leftOfGutter); const right = prose.filter(rightOfGutter);
  const overlap = left.length && right.length ? Math.min(Math.max(...left.map(line=>line.y)),Math.max(...right.map(line=>line.y)))-Math.max(Math.min(...left.map(line=>line.y)),Math.min(...right.map(line=>line.y))) : 0;
  const strongColumns = left.length >= 4 && right.length >= 4 && left.length+right.length >= prose.length*.75 && overlap >= Math.max(30, width*.06);
  let reordered = false;
  const ordered: PositionedLine[] = [];
  if (strongColumns) {
    let band: PositionedLine[] = [];
    const flush = () => {
      const l = band.filter(leftOfGutter); const r = band.filter(rightOfGutter);
      if (l.length >= 2 && r.length >= 2 && l.length+r.length === band.length) { ordered.push(...l.sort((a,b)=>b.y-a.y),...r.sort((a,b)=>b.y-a.y)); reordered = true; }
      else ordered.push(...band);
      band=[];
    };
    for (const line of lines) {
      // Full-width headings/abstracts separate vertical regions; do not drag them into a column.
      if (!leftOfGutter(line) && !rightOfGutter(line)) { flush(); ordered.push(line); }
      else band.push(line);
    }
    flush();
  } else ordered.push(...lines);
  let text = '';
  for (const [index, line] of ordered.entries()) {
    const previous = ordered[index-1];
    const columnSwitch = previous && line.x-previous.x > width*.2;
    const captionStart = /^(?:Figure|Fig\.)\s+\d+[a-z]?[.:\s]/i.test(line.text.trim());
    const separator = index ? (columnSwitch || Math.abs(previous.y-line.y) > Math.max(previous.height,line.height)*1.65 || captionStart ? '\n\n' : '\n') : '';
    text += separator + line.text;
  }
  // Retain uncertainty warnings even when a strong layout repair was possible.
  const legacy = pdfItemsToTextLegacy(items, width);
  return { text: reordered ? text : legacy.text, possibleColumns: strongColumns || legacy.possibleColumns, columnsReordered: reordered, layout: reordered ? 'two-column' as const : (legacy.possibleColumns ? 'uncertain' as const : 'single-column' as const), lineCount: ordered.length, regions: ordered };
}

export function pdfBlocksFromText(text: string, page: number, prefix = 'pdf'): RawSourceBlock[] {
  return paragraphBlocks(text, page, prefix).map(block => {
    if (block.kind !== 'paragraph' || !/^(?:Figure|Fig\.)\s+\d+[a-z]?[.:\s]/i.test(block.text)) return block;
    return { id: block.id, kind: 'original-figure' as const, page, caption: block.text,
      alt: 'Caption extracted from this PDF page. The original figure image has not been reconstructed.' };
  });
}
