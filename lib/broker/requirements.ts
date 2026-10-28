import {brokerRequirementSchema,type BrokerRequirement} from '../../shared/external-broker';
import type {ScientificAsset} from '../../shared/scientific-assets';
import type {CapabilityGap} from '../../shared/representation-capabilities';
import {hasCheckedAssetIntegrity} from '../assets/local';

export type BrokerRequirementStatus={requirement:BrokerRequirement;status:'satisfied-local'|'missing';reason:string;assetId?:string};
/** expectedSha256 identifies a local ScientificAsset manifest checksum, never its original-file digest.
 * expectedBytes, when supplied, counts the serialized manifest's UTF-8 bytes. Existing assets do
 * not have a reviewed dataset-release/weights-version receipt, so a requested version stays missing. */
export function inspectBrokerRequirements(requirements:readonly BrokerRequirement[],assets:readonly ScientificAsset[]=[]):BrokerRequirementStatus[]{
 if(requirements.length>16)throw Error('Inspect at most sixteen named external requirements.');
 return requirements.map(raw=>{
  const requirement=brokerRequirementSchema.parse(raw);
  if(requirement.kind==='compute')return {requirement,status:'missing',reason:'No real heavy-compute adapter is admitted. The deterministic demo does not supply scientific compute.'};
  if(requirement.kind==='weights')return {requirement,status:'missing',reason:'No reviewed trained-weight loader or version admission exists. A file or availability declaration does not establish compatible weights.'};
  if(requirement.expectedSha256===null)return {requirement,status:'missing',reason:'The dataset needs an exact expected ScientificAsset manifest checksum before a local match can be admitted.'};
  if(requirement.expectedVersion!==null)return {requirement,status:'missing',reason:'The requested dataset version has no checked release-version binding; no compatible version is inferred.'};
  const asset=assets.find(value=>hasCheckedAssetIntegrity(value)&&value.checksum.value===requirement.expectedSha256&&(requirement.expectedBytes===null||new TextEncoder().encode(JSON.stringify(value)).byteLength===requirement.expectedBytes));
  return asset?{requirement,status:'satisfied-local',reason:'An exact integrity-checked local manifest matches this dataset requirement. This is not scientific verification.',assetId:asset.id}:{requirement,status:'missing',reason:'The exact checked dataset manifest/byte length is unavailable locally. A declared availability hint or matching original-file digest is insufficient.'};
 });
}
/** Optional requirements remain informative; they cannot block a local conceptual alternative. */
export function externalRequirementGaps(requirements:readonly BrokerRequirement[],assets:readonly ScientificAsset[]=[]):CapabilityGap[]{
 return inspectBrokerRequirements(requirements,assets).filter(value=>value.requirement.blocksExecution&&value.status!=='satisfied-local').map(value=>({kind:value.requirement.kind,requirement:value.requirement.id,reason:`${value.requirement.title}: ${value.reason}`,nextAction:value.requirement.kind==='dataset'?'Explicitly import the exact local dataset or retain the source-linked fallback.':'Retain the conceptual/reported fallback. Real external execution requires a separately reviewed adapter and explicit bounded consent.'}));
}
