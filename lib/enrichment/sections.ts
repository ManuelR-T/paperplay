import { validateDocument, type SourceDocument } from '../../shared/schema';

export const SECTION_CHARACTERS = 12_000;
export const CONTEXT_CHARACTERS = 20_000;
export type SectionSegment = { blockId: string; page: number; start: number; end: number; text: string };
export type SourceSection = { id: string; title: string; segments: SectionSegment[]; characters: number; partial: boolean };
export function sourceBlockText(block: SourceDocument['blocks'][number]): string {
  return block.kind === 'equation' ? block.latex : block.kind === 'original-figure' ? block.caption : block.text;
}
function hash(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }

/** Partition, never mutate, the complete saved source. Oversized blocks get disclosed offset segments. */
export function buildSourceSections(input: SourceDocument): SourceSection[] {
  const source = validateDocument(input); const sections: SourceSection[] = [];
  let title = 'Opening passages'; let segments: SectionSegment[] = []; let characters = 0;
  function flush() {
    if (!segments.length) return;
    sections.push({ id: `section-${sections.length}-${hash(segments.map(s => `${s.blockId}:${s.start}:${s.end}`).join('|'))}`, title: `${sections.length + 1}. ${title}`, segments,
      characters, partial: segments.some(s => { const b = source.blocks.find(b => b.id === s.blockId)!; return s.start !== 0 || s.end !== sourceBlockText(b).length; }) });
    segments = []; characters = 0;
  }
  for (const block of source.blocks) {
    if (block.kind === 'heading') { flush(); title = block.text; }
    const text = sourceBlockText(block);
    for (let start = 0; start < text.length;) {
      const room = SECTION_CHARACTERS - characters;
      if (room < 200 && segments.length) { flush(); continue; }
      const end = Math.min(text.length, start + (SECTION_CHARACTERS - characters));
      segments.push({ blockId: block.id, page: block.page, start, end, text: text.slice(start, end) }); characters += end - start; start = end;
      if (characters >= SECTION_CHARACTERS) flush();
    }
  }
  flush(); return sections;
}

export function sectionContext(source: SourceDocument, sectionId: string, targetBlockId?: string) {
  const sections = buildSourceSections(source); const section = sections.find(s => s.id === sectionId);
  if (!section) throw Error('This section no longer matches the saved source version.');
  const chosen = targetBlockId ? section.segments.filter(s => s.blockId === targetBlockId) : section.segments;
  if (!chosen.length) throw Error('The selected widget does not belong to this section.');
  const ids = new Set(chosen.map(s => s.blockId));
  const first = source.blocks.findIndex(b => b.id === chosen[0].blockId); const last = source.blocks.findIndex(b => b.id === chosen.at(-1)!.blockId);
  const neighbors = [source.blocks[first - 1], source.blocks[last + 1]].filter((b): b is SourceDocument['blocks'][number] => !!b && !ids.has(b.id)).map(b => ({ blockId: b.id, page: b.page, start: 0, end: Math.min(1500, sourceBlockText(b).length), text: sourceBlockText(b).slice(0, 1500), role: 'neighboring context, not the selected coverage' }));
  const text = JSON.stringify({ title: source.title, authors: source.authors, sourceVersion: source.sourceVersion, section: { id: section.id, title: section.title, partialBlockSegments: section.partial }, selectedPassages: chosen, neighboringContext: neighbors,
    extractionWarnings: source.extractionWarnings, coverage: 'Only selected passages are analyzed. The original full source stays unchanged in the reader.' });
  if (text.length > CONTEXT_CHARACTERS) throw Error('This section context exceeds the bounded request size. Choose a smaller section.');
  return { section, text, sections };
}
