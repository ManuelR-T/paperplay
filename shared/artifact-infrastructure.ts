import { z } from 'zod';
const sha256=z.string().regex(/^[a-f0-9]{64}$/);
export type ArtifactWorkerKind='compiler'|'runtime';
function worker(kind:ArtifactWorkerKind){const pattern=new RegExp(`^/artifact-${kind}\\.([a-f0-9]{64})\\.worker\\.mjs$`);return z.strictObject({url:z.string().regex(pattern),sha256}).superRefine((value,context)=>{if(value.url.match(pattern)?.[1]!==value.sha256)context.addIssue({code:'custom',message:'Worker URL and digest must match.'});});}
/** Only the two reviewed same-origin, content-addressed infrastructure entries are admissible. */
export const artifactInfrastructureSchema=z.strictObject({format:z.literal('paperplay-artifact-infrastructure'),schemaVersion:z.literal(1),sdkSha256:sha256,workers:z.strictObject({compiler:worker('compiler'),runtime:worker('runtime')})});
export type ArtifactInfrastructure=z.infer<typeof artifactInfrastructureSchema>;
