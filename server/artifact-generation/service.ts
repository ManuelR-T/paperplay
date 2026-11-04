import 'server-only';
import {getHostArtifactGenerationRuntime} from './runtime';
import { createArtifactGenerationHandlers } from './handlers';
import { serverMetaConfig } from '../meta/environment';
export const artifactGenerationHandlers = createArtifactGenerationHandlers({ runtime:getHostArtifactGenerationRuntime(), getConfig: serverMetaConfig, signingSecret: process.env.ANALYSIS_SIGNING_SECRET });
