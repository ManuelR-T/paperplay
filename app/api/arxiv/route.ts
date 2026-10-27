import { resolveArxiv } from '@/lib/import/arxiv';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get('id');
  if (!input || input.length > 500) return Response.json({ error: 'Provide one arXiv paper identifier or URL.' }, { status: 400 });
  try {
    return Response.json(await resolveArxiv(input, { signal: request.signal }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'arXiv took too long to respond. Try again later or import the PDF directly.'
      : error instanceof Error && error.name === 'AbortError' ? 'arXiv import was cancelled.'
      : error instanceof Error ? error.message : 'arXiv import failed. Import the PDF directly instead.';
    return Response.json({ error: message }, { status: /Invalid arXiv|Use an|Provide/.test(message) ? 400 : 502 });
  }
}
