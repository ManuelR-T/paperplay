import { getSupplementHandlers } from '@/server/supplements/handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return getSupplementHandlers().retrieve(request); }
