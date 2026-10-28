import type { SourceDocument } from '../../shared/schema';
import type { ScientificAsset } from '../../shared/scientific-assets';
import { validateRepresentationPlan, MAX_REPRESENTATION_BYTES } from '../../shared/representations';
import { createSourceGuide } from './source-guide';
export function representationFromAsset(asset:ScientificAsset,source:SourceDocument,blockId:string){
  const base=createSourceGuide(source,blockId,asset.label);
  const input={...base,objective:'Inspect reader-supplied or attributed data beside a chosen source passage. Binding data does not establish it as source measurements.',assets:[{id:asset.id,kind:asset.kind,description:asset.label,checksum:asset.checksum.value}],assetManifests:[asset],execution:{kind:'none',capabilities:[{id:'asset-inspector',version:'1.0.0'}],assetIds:[asset.id]},interactions:['inspect-data','return-source'],views:[{id:'data',kind:'asset',assetId:asset.id}],evidence:[{id:'data-origin',subject:{kind:'asset',id:asset.id},origin:asset.provenance.origin==='illustrative'?'authored-assumption':asset.provenance.origin==='source-extracted'?'source-extracted':'user-supplied',anchorIds:['passage'],assumptions:['The reader selected this source association. The data has not been independently verified.'],references:[{label:asset.provenance.attribution,location:asset.provenance.rights}],dependsOn:[]}]};
  if(new TextEncoder().encode(JSON.stringify(input)).length>MAX_REPRESENTATION_BYTES)delete (input as {assetManifests?:ScientificAsset[]}).assetManifests;
  return validateRepresentationPlan(input,source);
}
