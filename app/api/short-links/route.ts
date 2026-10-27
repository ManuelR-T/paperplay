import { shortLinkHandlers, unavailableShortLinks } from '@/server/short-links/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { try { return await shortLinkHandlers().create(request); } catch { return unavailableShortLinks(); } }
export async function DELETE(request: Request) { try { return await shortLinkHandlers().remove(request); } catch { return unavailableShortLinks(); } }
