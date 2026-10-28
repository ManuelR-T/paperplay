import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../shared/schema';
import {validateRepresentationPlan} from '../shared/representations';
import type {BrokerRequirement} from '../shared/external-broker';
import {sealScientificAsset} from '../lib/assets/local';
import {datasetSourceFingerprint} from '../lib/datasets/model';
import {inspectBrokerRequirements,externalRequirementGaps} from '../lib/broker/requirements';
import {buildRepresentation,executeRepresentation} from '../lib/representations/lifecycle';
import {getRepresentationCapabilities} from '../lib/representations/adapters';
import {representationInputRevision} from '../shared/representation-selection';

async function fixture(){
 const quote='An authored guide with named dataset, trained-weight and computation requirements; it does not start external work.';
 const source=validateDocument({schemaVersion:1,id:'broker-guide-fixture',sourceVersion:'authored-v1',title:'Local explanation with external requirements',authors:['Paperplay'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'scope',kind:'paragraph',page:1,text:quote}],anchors:[{id:'scope',blockId:'scope',page:1,quote}],extractionWarnings:['Authored engineering fixture, not a paper reproduction.']});
 const asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'fixture-data',label:'Synthetic local fixture',kind:'table',shape:[1,1],coordinates:{system:'Authored table',axes:[]},missingValues:'null',provenance:{origin:'illustrative',attribution:'Paperplay-authored numbers',rights:'Project-authored fixture'},transformations:[],data:{columns:[{id:'value',label:'Value',type:'number',unit:'1'}],rows:[{id:'one',values:[1]}]}},source);
 const requirement:BrokerRequirement={id:'required-dataset',kind:'dataset',title:'Exact checked fixture table',anchorIds:['scope'],sourceFingerprint:await datasetSourceFingerprint(source),expectedVersion:null,expectedSha256:asset.checksum.value,expectedBytes:new TextEncoder().encode(JSON.stringify(asset)).length,availability:'missing',blocksExecution:true,details:'Exact ScientificAsset manifest checksum and serialized byte count; no original-file digest substitution.'};
 const raw={format:'paperplay-representation',schemaVersion:1,id:'broker-guide-fixture',title:source.title,source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:{kind:'prepared',label:'Authored engineering fixture'},objective:'Keep local explanation readable and name actual external capability gaps.',anchors:source.anchors,claims:[{id:'scope',kind:'pedagogical-addition',text:quote,anchorIds:['scope']}],assumptions:['Requirement metadata is inert; an availability hint is not a receipt or upload consent.'],requestedEvidence:'illustrative-walkthrough',assets:[{id:asset.id,kind:'table',description:asset.label,checksum:asset.checksum.value}],assetManifests:[asset],quantities:[],execution:{kind:'none',capabilities:[{id:'source-guide',version:'1.0.0'},{id:'asset-inspector',version:'1.0.0'}],assetIds:[asset.id]},interactions:['inspect-data','return-source'],externalRequirements:[requirement],views:[{id:'guide',kind:'source-guide',steps:[{id:'explain',title:'Inspect requirements',explanation:quote,anchorIds:['scope']}]},{id:'data',kind:'asset',assetId:asset.id}]};
 return {source,asset,requirement,plan:validateRepresentationPlan(raw,source)};
}
test('named requirements require exact checked local data; availability hints and file digests are insufficient',async()=>{
 const {asset,requirement}=await fixture();assert.equal(inspectBrokerRequirements([requirement],[asset])[0].status,'satisfied-local');assert.equal(externalRequirementGaps([requirement],[asset]).length,0);
 assert.equal(inspectBrokerRequirements([{...requirement,availability:'available'}],[])[0].status,'missing');assert.equal(inspectBrokerRequirements([requirement],[structuredClone(asset)])[0].status,'missing');
 assert.equal(inspectBrokerRequirements([{...requirement,expectedBytes:requirement.expectedBytes!+1}],[asset])[0].status,'missing');assert.equal(inspectBrokerRequirements([{...requirement,expectedVersion:'unadmitted-release-v2'}],[asset])[0].status,'missing');
 for(const kind of ['weights','compute'] as const){const missing={...requirement,id:`need-${kind}`,kind,availability:'available' as const};assert.equal(inspectBrokerRequirements([missing],[asset])[0].status,'missing');assert.equal(externalRequirementGaps([missing],[asset])[0].requirement,missing.id);}
});
test('blocking requirements produce named gaps while optional requirements preserve the local explanation without a broker execution path',async()=>{
 const {source,asset,requirement,plan}=await fixture(),built=buildRepresentation(plan,source,{assets:[asset]});assert.equal(built.status,'ready');if(built.status!=='ready')throw Error('Local fixture should build');const executed=await executeRepresentation(built.value,source);assert.equal(executed.status,'ready');
 const weights={...requirement,id:'needed-weights',kind:'weights' as const,title:'Missing named trained weights',availability:'available' as const};
 const blocked=validateRepresentationPlan({...plan,externalRequirements:[weights]},source),result=buildRepresentation(blocked,source,{assets:[asset]});assert.equal(result.status,'unsupported');assert.ok(result.gaps?.includes(weights.id));
 const fallback=validateRepresentationPlan({...plan,externalRequirements:[{...weights,blocksExecution:false}]},source);assert.equal(buildRepresentation(fallback,source,{assets:[asset]}).status,'ready');assert.notEqual(representationInputRevision(plan),representationInputRevision(fallback));
 assert.throws(()=>validateRepresentationPlan({...plan,externalRequirements:[{...requirement,anchorIds:['missing']}]},source),/undeclared source anchor/);
 const capabilities=getRepresentationCapabilities();assert.equal(capabilities.externalAdapters[0].classification,'fake');assert.equal(capabilities.policy.brokerAutomaticSubmission,false);assert.equal(capabilities.policy.brokerDirectGuestAccess,false);assert.equal(capabilities.adapters.some(adapter=>adapter.id==='deterministic-demo'),false);
});
