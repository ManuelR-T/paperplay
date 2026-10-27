import { z } from 'zod';

export const EXPLORE_PAGE_SIZE = 12;
export const EXPLORE_CATEGORIES = [
  { value: '', label: 'All subjects' },
  { value: 'cs.AI', label: 'Artificial intelligence' },
  { value: 'cs.LG', label: 'Machine learning' },
  { value: 'cs.CL', label: 'Language & NLP' },
  { value: 'cs.CV', label: 'Computer vision' },
  { value: 'cs.DS', label: 'Algorithms & data structures' },
  { value: 'math.OC', label: 'Optimization & control' },
  { value: 'stat.ML', label: 'Statistical learning' },
] as const;
export const exploreQuerySchema = z.object({
  q: z.string().trim().max(200).refine(value => !value || /[\p{L}\p{N}]/u.test(value), 'Enter a topic, title or author.').default(''),
  field: z.enum(['all', 'title', 'author']).default('all'),
  category: z.string().refine(value => EXPLORE_CATEGORIES.some(item => item.value === value), 'Choose a supported subject.').default(''),
  since: z.string().regex(/^(?:|19\d{2}|20\d{2})$/).default(''),
  sort: z.enum(['relevance', 'newest', 'updated']).default('relevance'),
  start: z.coerce.number().int().min(0).max(996).refine(value => value % EXPLORE_PAGE_SIZE === 0).default(0),
});
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;
export const arxivPaperSchema = z.object({
  id: z.string().max(100).regex(/^(?:\d{4}\.\d{4,5}|[a-z][a-z.-]*(?:\.[A-Z]{2})?\/\d{7})v[1-9]\d{0,2}$/),
  title: z.string().min(1).max(2000),
  authors: z.array(z.string().min(1).max(300)).min(1).max(100),
  abstract: z.string().max(20000),
  published: z.iso.datetime(), updated: z.iso.datetime(),
  categories: z.array(z.string().max(80)).max(40),
});
export type ArxivPaper = z.infer<typeof arxivPaperSchema>;
export const exploreResultSchema = z.object({
  query: exploreQuerySchema, papers: z.array(arxivPaperSchema).max(EXPLORE_PAGE_SIZE),
  total: z.number().int().nonnegative(), fetchedAt: z.number(),
});
export type ExploreResult = z.infer<typeof exploreResultSchema>;
export function paperUrl(id: string) { return `https://arxiv.org/abs/${id}`; }
export function readerUrl(id: string) { return `/?arxiv=${encodeURIComponent(id)}`; }
export function exploreParams(query: ExploreQuery) {
  return new URLSearchParams({ q: query.q, field: query.field, category: query.category, since: query.since, sort: query.sort, start: String(query.start) });
}
