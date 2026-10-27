import type { ImportedSource } from '../../shared/import-types';
import type { SourceDocument } from '../../shared/schema';
import { reconstructPdfText } from './reconstruct';
import { abortIfNeeded, MAX_PDF_BYTES, MAX_PDF_PAGES, normalizeSource, pdfItemsToText, sha256, type PdfTextItem, type RawSourceBlock } from './normalize';

type PdfLibrary = Pick<typeof import('pdfjs-dist'), 'getDocument'>;
export type PdfImportOptions = { name?: string; signal?: AbortSignal; onProgress?: (page: number, total: number) => void; title?: string; authors?: string[]; sourceUrl?: string };

export async function extractPdfWithLibrary(file: Blob, options: PdfImportOptions, library: PdfLibrary, resources: { cMapUrl?: string; standardFontDataUrl?: string; wasmUrl?: string } = {}): Promise<ImportedSource> {
  abortIfNeeded(options.signal);
  if (file.size > MAX_PDF_BYTES) throw new Error('This PDF is larger than the 10 MB import limit. Choose a smaller document.');
  if (file.size < 8) throw new Error('The file is empty or is not a readable PDF.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('The selected file is not a PDF. Choose a PDF document.');
  const contentHash = await sha256(bytes); abortIfNeeded(options.signal);
  const task = library.getDocument({ data: bytes, useSystemFonts: true, cMapPacked: true, ...resources });
  const abort = () => { void task.destroy().catch(() => {}); };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('This PDF has more than 50 pages. Import a shorter excerpt; pages were not silently omitted.');
    const blocks: RawSourceBlock[] = [];
    const warnings = ['PDF extraction preserves text and page references but may lose equation notation, figures, tables and exact reading order. Use the original PDF to verify them.'];
    let weakPages = 0;
    const reconstructed: NonNullable<SourceDocument['reconstruction']>['pages'] = [];
    const pages: Array<{ text: string; page: number }> = [];
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      abortIfNeeded(options.signal);
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent(); abortIfNeeded(options.signal);
      const items = content.items.filter((item): item is typeof item & PdfTextItem => 'str' in item);
      const viewport = page.getViewport({ scale: 1 });
      const extracted = pdfItemsToText(items, viewport.width);
      if (extracted.columnsReordered) warnings.push('Strong two-column regions were reordered geometrically, keeping full-width separators and physical page references. The repair is heuristic; compare the original page for equations, captions and reading order.');
      else if (extracted.possibleColumns) warnings.push('Possible multi-column text was detected, but layout confidence was insufficient for repair. Compare with the original page.');
      if (extracted.text.trim().length < 30) weakPages++;
      const regions = extracted.regions.slice(0, 500).map((line, index) => ({ id: `pdf-p${pageIndex}-r${index+1}`, text: line.text.slice(0,5000), x: line.x, y: line.y, width: Math.max(0,line.right-line.x), height: line.height }));
      reconstructed.push({ page: pageIndex, width: viewport.width, ...(Number.isFinite(viewport.height)&&viewport.height>0?{height:viewport.height}:{}), regions, coordinatesComplete: extracted.regions.length <= 500 && extracted.regions.every(line=>line.text.length<=5000) });
      pages.push({ text: extracted.text, page: pageIndex });
      page.cleanup(); options.onProgress?.(pageIndex, pdf.numPages); abortIfNeeded(options.signal);
    }
    const witness = pages.map(page => page.text).join('\n');
    for (const item of pages) blocks.push(...reconstructPdfText(item.text, item.page, reconstructed[item.page-1].regions, witness));
    if (blocks.reduce((sum, block) => sum + ('text' in block ? block.text.length : 0), 0) < 200) throw new Error('This PDF has too little extractable text. It may be scanned or image-only; OCR is not supported. Import a text PDF.');
    if (weakPages) warnings.push(`${weakPages} page(s) contained little or no text. Their images, equations or scans have not been reconstructed.`);
    let metadata: Record<string, unknown> = {};
    try { metadata = (await pdf.getMetadata()).info as Record<string, unknown>; } catch { /* Source text remains usable when metadata is unavailable. */ }
    const fallbackName = options.name?.replace(/\.pdf$/i, '') || 'Imported research paper';
    const title = options.title || (typeof metadata.Title === 'string' && metadata.Title.trim() ? metadata.Title : fallbackName);
    const authors = options.authors || (typeof metadata.Author === 'string' && metadata.Author.trim() ? [metadata.Author] : undefined);
    abortIfNeeded(options.signal);
    warnings.push('Source-v3 paragraph/heading reconstruction is heuristic. Raw fragments, operations and page-region coordinates are retained for inspection; equations and images are not invented.');
    const source = await normalizeSource({ kind: 'pdf', title, authors, url: options.sourceUrl, pageCount: pdf.numPages, blocks, warnings, identity: contentHash, reconstruction: { version: 'pdf-layout-v3', pages: reconstructed } });
    abortIfNeeded(options.signal);
    return { source, original: file, originalName: options.name || 'paper.pdf', ...(options.sourceUrl ? { originalUrl: options.sourceUrl } : {}) };
  } catch (error) {
    abortIfNeeded(options.signal);
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('This PDF is encrypted or password-protected. Import an unlocked copy.');
    if (error instanceof Error && ['InvalidPDFException', 'MissingPDFException', 'UnknownErrorException'].includes(error.name)) throw new Error('The PDF could not be read. It may be corrupt or unsupported; try an unlocked text PDF.');
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await task.destroy().catch(() => {});
  }
}
