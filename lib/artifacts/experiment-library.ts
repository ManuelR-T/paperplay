import { artifactPlanPayloadSchema, artifactRecordedReplaySchema, artifactExperimentOwner, createArtifactExperimentIdentity, createArtifactCacheRecord, type ArtifactCacheRecord, type ArtifactRecordedReplay } from '../../shared/artifact-experiment';
import { validateFigureArtifact, type FigureArtifact } from '../../shared/figure-artifacts';
import type { SourceDocument } from '../../shared/schema';
import type { ScientificAsset } from '../../shared/scientific-assets';
import { validateScientificAsset } from '../assets/local';
import { assertBoundedFigureJson } from '../../shared/figure-json';
import { validateArtifactInterface } from '../../shared/figure-interfaces';
import { createArtifactExperimentStorage, type ArtifactExperimentStorage } from './experiment-storage';
import { sha256Text } from './sdk-source';
import { validateSdkFrame } from '../../shared/figure-sdk';

const defaultStorage = createArtifactExperimentStorage();
export type SavedArtifactExperiment = { id: string; title: string; artifact: FigureArtifact; input: unknown; seed: number; assets: ScientificAsset[]; replay?: ArtifactRecordedReplay };
function checkReplay(input:ArtifactRecordedReplay|undefined,artifact:FigureArtifact,artifactSha256:string,seed:number){if(!input)return undefined;const replay=artifactRecordedReplaySchema.parse(input);if(artifact.kind!=='generated'||replay.artifactSha256!==artifactSha256||replay.seed!==seed)throw Error('Recorded replay differs from the saved artifact/seed.');validateSdkFrame(replay.frame,artifact.resources,artifact.anchors.map(anchor=>anchor.id),artifact.capabilityRequests);validateArtifactInterface(replay.frame.state,artifact.interfaces.state,artifact.resources.maxStateBytes);return replay;}
async function checkedValues(options: {source:SourceDocument;artifact:unknown;input?:unknown;seed?:number;assets?:readonly ScientificAsset[]}) {
  const artifact=validateFigureArtifact(options.artifact,options.source);
  const assets=await Promise.all((options.assets??[]).filter(asset=>artifact.kind!=='generated'||artifact.assetIds.includes(asset.id)).map(asset=>validateScientificAsset(asset,options.source)));
  if(new Set(assets.map(asset=>asset.id)).size!==assets.length)throw Error('Duplicate saved asset identifiers.');
  if(artifact.kind==='generated'&&assets.some(asset=>!artifact.assetBindings.some(binding=>binding.id===asset.id&&binding.kind===asset.kind&&binding.sha256===asset.checksum.value)))throw Error('Saved assets differ from the exact declared bindings.');
  const supplied=options.input??(artifact.kind==='generated'?artifact.initialInput??{}:{});assertBoundedFigureJson(supplied,256*1024);
  if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))throw Error('Saved artifact input must be a JSON object.');
  const input=JSON.parse(JSON.stringify(supplied)) as Record<string,unknown>;
  if(artifact.kind==='generated'){
    const nonAssetInput=Object.fromEntries(Object.entries(input).filter(([key])=>key!=='assets'));
    validateArtifactInterface(nonAssetInput,artifact.interfaces.input.filter(field=>field.id!=='assets'),artifact.resources.maxInputBytes);
    if(artifact.interfaces.input.some(field=>field.id==='assets'))input.assets=Object.fromEntries(assets.map(asset=>[asset.id,asset]));
  }
  const identity=await createArtifactExperimentIdentity({source:options.source,artifact,input,seed:options.seed,assets});
  return {artifact,input,assets,identity};
}
/** Only this explicit save path protects an accepted generic artifact in the local library. */
export async function saveArtifactExperiment(options:{source:SourceDocument;artifact:unknown;input?:unknown;seed?:number;assets?:readonly ScientificAsset[];storage?:ArtifactExperimentStorage;replay?:ArtifactRecordedReplay}):Promise<ArtifactCacheRecord>{
  const {artifact,input,assets,identity}=await checkedValues(options);
  const baseInput=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,key==='assets'?null:value]));
  const replay=checkReplay(options.replay,artifact,identity.artifactSha256,identity.seed);
  const record=await createArtifactCacheRecord('plan',identity,{artifact,inputJson:JSON.stringify(baseInput),seed:identity.seed,assets,...(replay?{replay}:{})});
  await (options.storage??defaultStorage).put(record,artifactExperimentOwner(identity),{accepted:true});return record;
}
export async function listSavedArtifactExperiments(source:SourceDocument,options:{storage?:ArtifactExperimentStorage}={}):Promise<SavedArtifactExperiment[]>{
  // Source-only owner calculation exactly matches the existing enrichment fingerprint.
  const fingerprint=await sha256Text(JSON.stringify({...source,anchors:[]})),owner=`${source.id}:${fingerprint}`;
  const records=await (options.storage??defaultStorage).list(owner,{acceptedOnly:true}),result:SavedArtifactExperiment[]=[];
  for(const record of records){if(record.kind!=='plan')continue;try{const payload=artifactPlanPayloadSchema.parse(record.payload);const checked=await checkedValues({source,artifact:payload.artifact,input:payload.inputJson===undefined?undefined:JSON.parse(payload.inputJson),seed:payload.seed??record.identity.seed,assets:payload.assets});const preservedVersions={...checked.identity,sdk:record.identity.sdk,compiler:record.identity.compiler,runtime:record.identity.runtime,randomPolicy:record.identity.randomPolicy,qualityPolicy:record.identity.qualityPolicy};if(JSON.stringify(preservedVersions)!==JSON.stringify(record.identity))continue;const replay=checkReplay(payload.replay,checked.artifact,checked.identity.artifactSha256,checked.identity.seed);result.push({id:record.id,title:checked.artifact.title,artifact:checked.artifact,input:checked.input,seed:checked.identity.seed,assets:checked.assets,...(replay?{replay}:{})});}catch{/* Invalid originals remain in storage and exportOriginal; never fabricate a replacement. */}}
  return result;
}
export async function removeSavedArtifactExperiment(id:string,source:SourceDocument,options:{storage?:ArtifactExperimentStorage}={}):Promise<void>{
  const storage=options.storage??defaultStorage,items=await listSavedArtifactExperiments(source,{storage});if(!items.some(item=>item.id===id))throw Error('This saved artifact does not belong to the exact current source.');await storage.removeRecord(id,`${source.id}:${await sha256Text(JSON.stringify({...source,anchors:[]}))}`);
}
export const listArtifactExperiments=listSavedArtifactExperiments;
export const removeArtifactExperiment=removeSavedArtifactExperiment;
