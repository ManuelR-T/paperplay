import 'server-only';
import { serverMetaConfig } from '../meta/environment';
import { createAnalysisHandlers } from './handlers';

export const analysisHandlers = createAnalysisHandlers({ getConfig: serverMetaConfig, signingSecret: process.env.ANALYSIS_SIGNING_SECRET });
