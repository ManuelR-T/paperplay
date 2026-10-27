import { serverMetaConfig } from '@/server/meta/environment';
import { publicMetaStatus } from '@/server/meta/config';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    return Response.json({ status: 'ok', stage: 'M5', meta: publicMetaStatus(serverMetaConfig()) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ status: 'error', stage: 'M5', error: 'Invalid server configuration.' }, { status: 500 });
  }
}
