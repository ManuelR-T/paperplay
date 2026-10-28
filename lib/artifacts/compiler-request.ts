import { compileRequestSchema } from '../../shared/figure-compilation';
import type { BuiltFigureArtifact } from './lifecycle';
/** Send code and digest references, never source-paper text, assets, credentials or build commands. */
export function compilerRequestFromBuild(built:BuiltFigureArtifact){if(built.manifest.kind!=='generated')throw Error('Only generated source needs isolated compilation.');return compileRequestSchema.parse({format:'paperplay-figure-compile-request',schemaVersion:1,source:built.manifest.entry.source,sourceSha256:built.manifest.entry.sha256,manifestSha256:built.contentSha256,sdkSha256:built.manifest.dependencyLock[0].sha256});}
