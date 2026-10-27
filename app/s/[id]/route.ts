import { shortLinkHandlers, unavailableShortLinks } from '@/server/short-links/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { return await shortLinkHandlers().resolve(request, (await context.params).id); } catch { return unavailableShortLinks(); } }
