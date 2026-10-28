import { createExtractionManifest,validateExtractionEvidenceManifest } from '../extraction/model';
import type { ImportedSource } from '../../shared/import-types';
import { validateDocument } from '../../shared/schema';
import { extractPdf } from './pdf';
import { normalizeSource, abortIfNeeded } from './normalize';
import type { ArxivPayload } from './arxiv';

export async function importArxiv(input: string, options: { signal?: AbortSignal; onProgress?: (page: number, total: number) => void } = {}): Promise<ImportedSource> {
  abortIfNeeded(options.signal);
  const response = await fetch(`/api/arxiv?id=${encodeURIComponent(input)}`, { signal: options.signal });
  const payload = await response.json() as ArxivPayload & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Unable to import this arXiv paper. Upload its PDF instead.');
  if (payload.kind === 'html') {
    const source=validateDocument(payload.source);
    return { source, originalUrl: payload.originalUrl, ...('extractionEvidence' in payload&&payload.extractionEvidence?{extractionEvidence:await validateExtractionEvidenceManifest(payload.extractionEvidence,source)}:{}) };
  }
  if (payload.kind !== 'pdf' || typeof payload.pdfBase64 !== 'string' || payload.pdfBase64.length > 4_000_004) throw new Error('The arXiv import response is invalid or too large.');
  const bytes = Uint8Array.from(atob(payload.pdfBase64), character => character.charCodeAt(0));
  const original = new Blob([bytes], { type: 'application/pdf' });
  const result = await extractPdf(original, { ...options, name: `${payload.arxivId.replace('/', '-')}.pdf`, title: payload.title, authors: payload.authors, sourceUrl: payload.originalUrl });
  return rebindArxivPdfSource(result,payload);
}

/** Rebinding the pinned arXiv identity must preserve the original PDF coordinate evidence. */
export async function rebindArxivPdfSource(result:ImportedSource,payload:Extract<ArxivPayload,{kind:'pdf'}>):Promise<ImportedSource>{
  const source = await normalizeSource({ kind: 'arxiv', title: result.source.title, authors: result.source.authors, url: payload.originalUrl,
    pageCount: result.source.pageCount, blocks: result.source.blocks, reconstruction:result.source.reconstruction, warnings: [...result.source.extractionWarnings, 'arXiv structured HTML was unavailable; the pinned original PDF was extracted instead.'], identity: payload.arxivId });
  const previous=result.extractionEvidence?await validateExtractionEvidenceManifest(result.extractionEvidence,result.source):undefined;
  const extractionEvidence=previous?await createExtractionManifest(source,previous.original,previous.entries,{extractor:previous.extractor,losses:previous.losses,entriesTruncated:previous.coverage.entriesTruncated,inventory:previous.coverage.inventory}):undefined;
  return { ...result, source, originalUrl: payload.originalUrl, ...(extractionEvidence?{extractionEvidence}:{}) };
}
