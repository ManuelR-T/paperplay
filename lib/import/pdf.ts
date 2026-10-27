import type { ImportedSource } from '../../shared/import-types';
import { extractPdfWithLibrary, type PdfImportOptions } from './pdf-core';
export type { PdfImportOptions } from './pdf-core';

/** The PDF parser and worker are loaded only after a browser import is requested. */
export async function extractPdf(file: Blob, options: PdfImportOptions = {}): Promise<ImportedSource> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return extractPdfWithLibrary(file, options, pdfjs, { cMapUrl: '/pdfjs/cmaps/', standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' });
}
