import 'server-only';
import { serverMetaConfig } from '../meta/environment';
import { getUsageStore } from '../usage/service';
import { createQuestionHandler } from './handler';

export async function answerQuestion(request: Request) {
  try {
    const usage = getUsageStore();
    return await createQuestionHandler({ getConfig: serverMetaConfig, usage, signingSecret: process.env.ANALYSIS_SIGNING_SECRET })(request);
  } catch {
    return Response.json({ error: 'The usage store is unavailable. Questions are disabled until it is configured.', uncertain: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
