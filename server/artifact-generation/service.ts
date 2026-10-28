import 'server-only';
import { createArtifactGenerationHandlers } from './handlers';
import { serverMetaConfig } from '../meta/environment';
export const artifactGenerationHandlers = createArtifactGenerationHandlers({ getConfig: serverMetaConfig, signingSecret: process.env.ANALYSIS_SIGNING_SECRET });
