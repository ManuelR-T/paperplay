import type { SourceDocument } from '../../shared/schema';
import { cleanText, type RawSourceBlock } from './normalize';

type Region = NonNullable<SourceDocument['reconstruction']>['pages'][number]['regions'][number];
const heading = (line: string) => line.length < 110 && !/[=←\[\]{}\\]/.test(line) && !/\b(?:return|while|for each|push|pop|assert|loop)\b/i.test(line) && !/[;!?]$/.test(line) && (/^(?:\d+(?:\.\d+)*\.?\s+)[A-Z][^.!?]{2,90}$/.test(line) || /^(?:abstract|introduction|conclusions?|references|related work|methods?|experiments?|appendix(?: [A-Z])?)$/i.test(line));

/** Dehyphenate only with a whole-word witness in the same source; keep the raw fragment. */
export function reconstructPdfText(text: string, page: number, regions: Region[] = [], witnessText = text): RawSourceBlock[] {
  const witnessed = new Set((witnessText.match(/\b[A-Za-z]{4,}\b/g) ?? []).map(x => x.toLowerCase()));
  const parts: string[] = []; let buffer: string[] = [];
  const flush = () => { if (buffer.length) { parts.push(buffer.join('\n')); buffer = []; } };
  for (const line of text.split('\n')) {
    if (!line.trim()) { flush(); continue; }
    if (heading(line.trim())) { flush(); parts.push(line); } else buffer.push(line);
  }
  flush();
  const result: RawSourceBlock[] = [];
  for (const rawPart of parts) {
    // Bound metadata chunks without dropping a single raw source character.
    let rest = rawPart;
    while (rest.length) {
      let boundary = rest.length > 4000 ? rest.lastIndexOf(' ', 4000) : rest.length;
      if (boundary < 1) boundary = Math.min(4000, rest.length);
      const rawText = rest.slice(0, boundary); rest = rest.slice(boundary).trimStart();
      let repaired = 0;
      const joined = rawText.replace(/([A-Za-z]{2,})-\s*\n\s*([a-z]{2,})/g, (original, a: string, b: string) => {
        if (!witnessed.has((a+b).toLowerCase())) return original;
        repaired++; return a+b;
      });
      const value = cleanText(joined); if (!value) continue;
      const isHeading = !rawText.includes('\n') && heading(value);
      const isCaption = /^(?:Figure|Fig\.)\s+\d+[a-z]?[.:\s]/i.test(value);
      const operations: NonNullable<RawSourceBlock['reconstruction']>['operations'] = [];
      if (rawText.includes('\n')) operations.push('join-lines');
      if (repaired) operations.push('witnessed-dehyphenation');
      if (isHeading) operations.push('heading-detection');
      if (isCaption) operations.push('caption-detection');
      const plainRaw = cleanText(rawText);
      const matched = regions.filter(r => r.text.trim().length > 3 && plainRaw.includes(cleanText(r.text))).map(r => r.id).slice(0,256);
      const equationCandidate = (value.match(/[=∑∫αβγλθ∂√]/g)?.length ?? 0) >= 2;
      const reconstruction = { rawText, regionIds: matched, operations, confidence: operations.length ? 'heuristic' as const : 'source-text' as const,
        ...(equationCandidate ? { notice: 'Equation-like extracted text; no TeX reconstruction was guessed. Inspect the original page and raw fragments.' } : {}) };
      const base = { id: `pdf-p${page}-b${result.length+1}`, page, reconstruction };
      if (isHeading) result.push({ ...base, kind: 'heading', text: value, level: /^\d+\.\d+/.test(value) ? 3 : 2 });
      else if (isCaption) result.push({ ...base, kind: 'original-figure', caption: value, alt: 'Original PDF caption. Inspect the source page for the image; it has not been reconstructed.' });
      else result.push({ ...base, kind: 'paragraph', text: value });
    }
  }
  return result;
}
