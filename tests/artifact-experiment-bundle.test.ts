import test from 'node:test';
import assert from 'node:assert/strict';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { createArtifactExperimentBundle, parseArtifactExperimentBundle } from '../lib/artifacts/experiment-bundle';
import { createArtifactExperimentIdentity, createArtifactCacheRecord } from '../shared/artifact-experiment';
import { hasCheckedAssetIntegrity, sealScientificAsset } from '../lib/assets/local';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { sha256Text } from '../lib/artifacts/sdk-source';

test('default artifact export omits source/assets/jobs and restores source-bound recorded replay without inference',async()=>{
  const f=await createDynamicSequenceArtifact(),identity=await createArtifactExperimentIdentity(f),frame=await evaluateGuestFrame(f.artifact,{},null,{kind:'initialize'});
  const record=await createArtifactCacheRecord('execution',identity,{inputJson:'{}',entries:[{key:'a'.repeat(64),inputJson:'{}',stateJson:'null',eventJson:'{"kind":"initialize"}',frame}],currentKey:'a'.repeat(64)});
  const text=await createArtifactExperimentBundle({...f,records:[record]});const value=JSON.parse(text);assert.equal(value.source,undefined);assert.deepEqual(value.assets,[]);assert.equal(value.inclusions.results,true);assert.equal(value.contents,'artifact-and-quoted-excerpts');assert.equal(value.records.length,1);assert.equal(value.run,undefined);assert.equal(value.job,undefined);
  const missing=await parseArtifactExperimentBundle(text);assert.equal(missing.status,'missing-source');assert.equal(missing.original,text);
  const restored=await parseArtifactExperimentBundle(text,{sources:[f.source]});assert.equal(restored.status,'ready');assert.equal(restored.seed,42);assert.equal(restored.records.length,1);assert.deepEqual(restored.records[0].payload,record.payload);
});
test('full source inclusion is explicit and unknown versions retain exact original bytes',async()=>{
  const f=await createDynamicSequenceArtifact(),text=await createArtifactExperimentBundle({...f,includeSource:true});const restored=await parseArtifactExperimentBundle(text);assert.equal(restored.status,'ready');assert.equal(restored.source!.id,f.source.id);
  const unknown=JSON.stringify({...JSON.parse(text),schemaVersion:999});const rejected=await parseArtifactExperimentBundle(unknown);assert.equal(rejected.status,'incompatible');assert.equal(rejected.original,unknown);assert.equal(rejected.artifact,undefined);
});
test('changed input, artifact code, source fingerprint and private envelope fields reject without destructive migration',async()=>{
  const f=await createDynamicSequenceArtifact(),text=await createArtifactExperimentBundle({...f,includeSource:true});
  for(const mutate of [(v:any)=>{v.inputJson='{"changed":true}';},(v:any)=>{v.artifact.entry.source+='\n';},(v:any)=>{v.source.title='Modified';},(v:any)=>{v.job={token:'private'};}]){const value=JSON.parse(text);mutate(value);const original=JSON.stringify(value),result=await parseArtifactExperimentBundle(original);assert.equal(result.status,'incompatible');assert.equal(result.original,original);}
});
async function assetFixture(){
  const f=await createDynamicSequenceArtifact();
  const asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'data',kind:'tensor',label:'Synthetic private array',shape:[1],coordinates:{system:'Authored values',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Paperplay synthetic fixture',rights:'Project-authored ISC fixture'},transformations:[],data:{values:[31337]}});
  f.artifact.assetIds=['data'];f.artifact.assetBindings=[{id:'data',kind:'tensor',sha256:asset.checksum.value}];f.artifact.interfaces.input=[{id:'assets',kind:'object',description:'Exact supplied assets'}];const input={assets:{data:asset}};
  return {...f,asset,input};
}
test('asset attachments are opt-in, omitted raw inputs become read-only recorded frames with original effective-input identity',async()=>{
  const f=await assetFixture(),identity=await createArtifactExperimentIdentity({...f,assets:[f.asset]}),frame=await evaluateGuestFrame(f.artifact,f.input,null,{kind:'initialize'});
  const inputJson=JSON.stringify(f.input),record=await createArtifactCacheRecord('execution',identity,{inputJson,entries:[{key:'a'.repeat(64),inputJson,stateJson:'null',eventJson:'{"kind":"initialize"}',frame}],currentKey:'a'.repeat(64)});
  const text=await createArtifactExperimentBundle({...f,assets:[f.asset],records:[record],includeSource:true});const value=JSON.parse(text);assert.equal(value.inputBinding,'assets-omitted');assert.equal(value.identity.inputSha256,identity.inputSha256);assert.equal(value.inputJson,'{"assets":null}');assert.equal(value.records.length,0);assert.equal(value.recordedFrames.length,1);assert.deepEqual(value.assets,[]);assert.equal(text.includes('31337'),false);
  const parsed=await parseArtifactExperimentBundle(text);assert.equal(parsed.status,'missing-data');assert.deepEqual(parsed.missingAssetIds,['data']);assert.equal(parsed.replay!.frame.title,frame.title);assert.equal(parsed.records.length,0);assert.equal(parsed.replay!.inputSha256,identity.inputSha256);
});
test('explicit asset export rehydrates checked assets but never compiler receipts',async()=>{
  const f=await assetFixture(),text=await createArtifactExperimentBundle({...f,assets:[f.asset],includeAssets:true,includeSource:true});const result=await parseArtifactExperimentBundle(text);assert.equal(result.status,'ready');assert.equal(result.assets.length,1);assert.equal(hasCheckedAssetIntegrity(result.assets[0]),true);assert.equal(JSON.stringify(result).includes('admissionReceipt'),false);
  const corrupt=JSON.parse(text);corrupt.assets[0].data.values[0]=0;assert.equal((await parseArtifactExperimentBundle(JSON.stringify(corrupt))).status,'incompatible');
});
test('includeResults false exports an artifact experiment without cached state or quality reports',async()=>{
  const f=await createDynamicSequenceArtifact(),identity=await createArtifactExperimentIdentity(f);const record=await createArtifactCacheRecord('report',identity,{report:{status:'passed',diagnostics:[],framesChecked:1,textMeasurements:'not-run'},environment:'Synthetic desktop fixture',policyVersion:identity.qualityPolicy,executionKey:null});
  const text=await createArtifactExperimentBundle({...f,records:[record],includeResults:false,includeSource:true});const value=JSON.parse(text);assert.equal(value.inclusions.results,false);assert.deepEqual(value.records,[]);assert.deepEqual(value.recordedFrames,[]);assert.equal((await parseArtifactExperimentBundle(text)).status,'ready');
});
test('a quality policy change invalidates reports without preventing compatible artifact import',async()=>{
  const f=await createDynamicSequenceArtifact(),text=await createArtifactExperimentBundle({...f,includeSource:true});const value=JSON.parse(text);value.identity.qualityPolicy='older-quality-policy';const parsed=await parseArtifactExperimentBundle(JSON.stringify(value));assert.equal(parsed.status,'ready');
});
test('omitted asset placeholders retain assets-first input order and exact digest after checked rebinding',async()=>{
  const f=await assetFixture();f.artifact.interfaces.input.push({id:'width',kind:'number',description:'Synthetic width'},{id:'mode',kind:'string',description:'Teaching mode'});f.artifact.initialInput={width:7,mode:'synthetic'};
  const input={assets:{data:f.asset},width:7,mode:'synthetic'},identity=await createArtifactExperimentIdentity({...f,input,assets:[f.asset]});
  const text=await createArtifactExperimentBundle({...f,input,assets:[f.asset],includeSource:true});assert.equal(text.includes('31337'),false);const raw=JSON.parse(text);assert.equal(raw.inputJson,'{"assets":null,"width":7,"mode":"synthetic"}');
  const parsed=await parseArtifactExperimentBundle(text);assert.equal(parsed.status,'missing-data');assert.deepEqual(Object.keys(parsed.input as object),['assets','width','mode']);
  const rebound={...(parsed.input as Record<string,unknown>)};rebound.assets={data:f.asset};assert.equal(JSON.stringify(rebound),JSON.stringify(input));assert.equal(await sha256Text(JSON.stringify(rebound)),identity.inputSha256);
  raw.inputJson=JSON.stringify({assets:{data:f.asset},width:7,mode:'synthetic'});raw.inputJsonSha256=await sha256Text(raw.inputJson);assert.equal((await parseArtifactExperimentBundle(JSON.stringify(raw))).status,'incompatible');
});
test('asset-omitted replay selects the exact current seed/input branch even when another branch is last in record order',async()=>{
  const f=await assetFixture();f.artifact.interfaces.input.push({id:'width',kind:'number',description:'Synthetic width'});f.artifact.initialInput={width:7};
  const input42={assets:{data:f.asset},width:7},input43={assets:{data:f.asset},width:8};
  const identity42=await createArtifactExperimentIdentity({...f,input:input42,seed:42,assets:[f.asset]}),identity43=await createArtifactExperimentIdentity({...f,input:input43,seed:43,assets:[f.asset]});
  const base=await evaluateGuestFrame(f.artifact,input42,null,{kind:'initialize'}),frame42={...base,title:'Recorded branch 42'},frame43={...base,title:'Wrong branch 43'};
  const record42=await createArtifactCacheRecord('execution',identity42,{inputJson:JSON.stringify(input42),entries:[{key:'a'.repeat(64),inputJson:JSON.stringify(input42),stateJson:'null',eventJson:'{"kind":"initialize"}',frame:frame42}],currentKey:'a'.repeat(64)});
  const record43=await createArtifactCacheRecord('execution',identity43,{inputJson:JSON.stringify(input43),entries:[{key:'b'.repeat(64),inputJson:JSON.stringify(input43),stateJson:'null',eventJson:'{"kind":"initialize"}',frame:frame43}],currentKey:'b'.repeat(64)});
  const options={...f,input:input42,seed:42,assets:[f.asset],records:[record42,record43],includeSource:true};
  const text=await createArtifactExperimentBundle(options),raw=JSON.parse(text);assert.equal(raw.recordedFrames.length,1);assert.equal(raw.recordedFrames[0].frame.title,'Recorded branch 42');
  const parsed=await parseArtifactExperimentBundle(text);assert.equal(parsed.status,'missing-data');assert.equal(parsed.replay!.frame.title,'Recorded branch 42');assert.equal(parsed.replay!.seed,42);assert.equal(parsed.replay!.inputSha256,identity42.inputSha256);
  const attached=JSON.parse(await createArtifactExperimentBundle({...options,includeAssets:true}));assert.equal(attached.records.length,2);assert.deepEqual(attached.recordedFrames,[]);
});
