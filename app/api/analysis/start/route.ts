import { analysisHandlers } from '@/server/analysis/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return analysisHandlers.start(request); }
