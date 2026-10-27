import 'server-only';
import { serverMetaConfig } from '../meta/environment';
import { createEnrichmentHandlers } from './handlers';
export const enrichmentHandlers = createEnrichmentHandlers({ getConfig: serverMetaConfig, signingSecret: process.env.ANALYSIS_SIGNING_SECRET });
