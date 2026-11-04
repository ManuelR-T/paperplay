import process from 'node:process';
import type {GenerationReply} from '../../shared/artifact-generation';

/** Ephemeral foreground work on this Node host; never a substitute for the durable ledger. */
export type ArtifactGenerationRuntime={
 running:Map<string,Promise<GenerationReply>>;
 finished:Map<string,{value?:GenerationReply;error?:unknown}>;
};
export function createArtifactGenerationRuntime():ArtifactGenerationRuntime{
 return {running:new Map(),finished:new Map()};
}
// Next route bundles and HMR can reevaluate modules separately on the same host.
// Node's process object is shared across those module realms. A real process loss
// drops this registry; polling must then use the ledger's actual provider ID or
// report uncertainty, never manufacture a replacement submission.
const registryKey=Symbol.for('paperplay.artifact-generation.foreground-runtime.v1');
type RuntimeHost=NodeJS.Process&{[registryKey]?:ArtifactGenerationRuntime};
export function getHostArtifactGenerationRuntime():ArtifactGenerationRuntime{
 const host=process as RuntimeHost;
 return host[registryKey]??=createArtifactGenerationRuntime();
}
