import { exploreQuerySchema } from '@/shared/explore';
import { ExploreBusyError, searchArxiv } from '@/lib/explore/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = exploreQuerySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return Response.json({ error: 'Check the search text, subject, date and page.' }, { status: 400 });
  try {
    return Response.json(await searchArxiv(parsed.data), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const busy = error instanceof ExploreBusyError;
    return Response.json({ error: busy ? error.message : 'arXiv search is temporarily unavailable. Try again shortly; your saved papers are still available.' },
      { status: busy ? 429 : 502, headers: { 'Cache-Control': 'no-store', ...(busy ? { 'Retry-After': '15' } : {}) } });
  }
}
