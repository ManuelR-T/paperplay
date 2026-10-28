import { artifactGenerationHandlers } from '@/server/artifact-generation/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return artifactGenerationHandlers.status(request); }
