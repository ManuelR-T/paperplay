import { z } from 'zod';
import { arxivPaperSchema, type ArxivPaper } from '../../shared/explore';

export const SAVED_PAPERS_KEY = 'paperplay:explore-saved:v1';
export const MAX_SAVED_PAPERS = 100;
const savedSchema = z.object({ version: z.literal(1), papers: z.array(arxivPaperSchema).max(MAX_SAVED_PAPERS) });
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export function readSavedPapers(storage: Storage): ArxivPaper[] {
  const raw = storage.getItem(SAVED_PAPERS_KEY);
  if (!raw) return [];
  if (raw.length > 3_000_000) throw new Error('Saved papers are too large to read. Existing data has been retained.');
  return savedSchema.parse(JSON.parse(raw)).papers;
}
export function toggleSavedPaper(storage: Storage, paper: ArxivPaper): ArxivPaper[] {
  const valid = arxivPaperSchema.parse(paper);
  const papers = readSavedPapers(storage);
  const exists = papers.some(item => item.id === valid.id);
  if (!exists && papers.length >= MAX_SAVED_PAPERS) throw new Error('Your library holds 100 papers. Remove a saved paper to make room.');
  const next = exists ? papers.filter(item => item.id !== valid.id) : [valid, ...papers];
  storage.setItem(SAVED_PAPERS_KEY, JSON.stringify({ version: 1, papers: next }));
  return next;
}

export function filterSavedPapers(papers: ArxivPaper[], query: string): ArxivPaper[] {
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return papers;
  return papers.filter(paper => { const text = fold([paper.title, ...paper.authors, ...paper.categories, paper.abstract].join(' ')); return terms.every(term => text.includes(term)); });
}
