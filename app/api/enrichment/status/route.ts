import { enrichmentHandlers } from '@/server/enrichment/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return enrichmentHandlers.status(request); }
