import { getBrokerHandlers } from '@/server/broker/handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return getBrokerHandlers().collect(request); }
