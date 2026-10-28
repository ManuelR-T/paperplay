import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { importScientificData, parseCsv } from '../lib/assets/import';
import { validateScientificAsset, hasCheckedAssetIntegrity, sealScientificAsset, originalFigureAssets } from '../lib/assets/local';
import { validateAssetStructure, type ScientificAsset } from '../shared/scientific-assets';
import { preparedPapers } from '../data/papers';
import { validateDocument } from '../shared/schema';
import { representationFromAsset } from '../lib/representations/from-asset';
import { buildRepresentation, executeRepresentation } from '../lib/representations/lifecycle';
import { scientificBinding } from '../lib/representations/evidence';

test('CSV quoted delimiters, embedded newlines, missing cells and identifier text are preserved',async()=>{
  const csv='id,note,value\r\n001,"first, sample",2\r\n002,"two\nlines",\r\n';
  const asset=await importScientificData('data.csv',csv);assert.equal(asset.kind,'table');if(asset.kind!=='table')return;
  assert.deepEqual(asset.shape,[2,3]);assert.deepEqual(asset.data.rows.map(row=>row.values),[['001','first, sample',2],['002','two\nlines',null]]);
  assert.equal(asset.provenance.fileDigest,createHash('sha256').update(csv).digest('hex'));
  assert.equal(asset.data.columns[0].type,'text');assert.equal(asset.provenance.origin,'user-supplied');assert.equal(asset.data.columns[2].unit,'unspecified');
  assert.deepEqual(parseCsv('a,b\n"quoted ""text""",z')[1],['quoted "text"','z']);
});
test('malformed, duplicate, oversized and inconsistent data fail before activation',async()=>{
  for(const csv of ['a,a\n1,2','a,b\n1','a\n"unclosed','a\n"closed"tail',''])assert.throws(()=>parseCsv(csv));
  assert.throws(()=>parseCsv('a\n'+'1\n'.repeat(1001)),/1,000/);
  assert.throws(()=>parseCsv('x'.repeat(2*1024*1024+1)),/2 MiB/);
  for(const json of ['[{"a":1},{"a":2,"b":3}]','[{"a":{"nested":1}}]','[{"a":1e999}]','{}'])await assert.rejects(()=>importScientificData('data.json',json));
  await assert.rejects(()=>importScientificData('data.exe','anything'),/CSV or JSON/);
});
test('JSON rows retain missing keys and mixed columns without fabricating zeros or observations',async()=>{
  const asset=await importScientificData('data.json','[{"x":2,"label":"a","missing":null},{"label":"b","missing":null}]');
  assert.equal(asset.kind,'table');if(asset.kind!=='table')return;
  assert.deepEqual(asset.data.rows[1].values,[null,'b',null]);assert.equal(asset.data.columns[2].type,'text');
  const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!,plan=representationFromAsset(asset,source,block.id);
  assert.equal(plan.evidence![0].origin,'user-supplied');assert.ok(!plan.evidence!.some(item=>item.origin==='observed-data'));
});
test('checksummed manifests are immutable and tampering cannot become a checked binding',async()=>{
  const asset=await importScientificData('data.csv','x,y\n1,2');assert.ok(hasCheckedAssetIntegrity(asset));
  const copied=JSON.parse(JSON.stringify(asset));assert.equal(hasCheckedAssetIntegrity(copied),false);
  const reopened=await validateScientificAsset(copied);assert.deepEqual(reopened,asset);assert.ok(hasCheckedAssetIntegrity(reopened));
  if(copied.kind==='table')copied.data.rows[0].values[0]=3;
  await assert.rejects(()=>validateScientificAsset(copied),/checksum mismatch/);
  assert.throws(()=>{if(asset.kind==='table')asset.data.rows[0].values[0]=9;});
});
const base={format:'paperplay-scientific-asset' as const,schemaVersion:1 as const,id:'fixture',label:'Typed structural fixture',coordinates:{system:'Declared coordinate convention',axes:[]},missingValues:'reject' as const,provenance:{origin:'illustrative' as const,attribution:'Paperplay synthetic fixture',rights:'Fixture only'},transformations:[]};
test('tensor, sequence, graph and geometry schemas enforce shape, alphabet and referenced identities',async()=>{
  const examples=[{...base,kind:'tensor',shape:[2,2],data:{values:[1,2,3,4]}},{...base,kind:'sequence',shape:[4],data:{alphabet:'dna',symbols:'ACGN'}},{...base,kind:'graph',shape:[2,1],data:{directed:true,nodes:[{id:'a',label:'A'},{id:'b',label:'B'}],edges:[{source:'a',target:'b'}]}},{...base,kind:'geometry',shape:[3,3],data:{vertices:[[0,0,0],[1,0,0],[0,1,0]],faces:[[0,1,2]]}}];
  for(const input of examples){const asset=await sealScientificAsset(input as Omit<ScientificAsset,'checksum'>);assert.deepEqual((await validateScientificAsset(JSON.parse(JSON.stringify(asset)))).data,asset.data);}
  await assert.rejects(()=>sealScientificAsset({...examples[0],shape:[2,3]} as Omit<ScientificAsset,'checksum'>),/shape/);
  await assert.rejects(()=>sealScientificAsset({...examples[1],data:{alphabet:'dna',symbols:'ACGU'}} as Omit<ScientificAsset,'checksum'>),/alphabet/);
  await assert.rejects(()=>sealScientificAsset({...examples[2],data:{...examples[2].data,edges:[{source:'a',target:'absent'}]}} as Omit<ScientificAsset,'checksum'>),/endpoints/);
  await assert.rejects(()=>sealScientificAsset({...examples[3],data:{...examples[3].data,faces:[[0,1,9]]}} as Omit<ScientificAsset,'checksum'>),/unavailable vertex/);
});
test('original figures retain exact source references and do not fabricate pixel checksums or dimensions',async()=>{
  const source=validateDocument({schemaVersion:1,id:'source-image',sourceVersion:'v1',title:'Original image fixture',authors:['Fixture'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'image',kind:'original-figure',page:1,caption:'An original caption retained by extraction.',alt:'Fixture image',imageUrls:['https://example.org/fixture.png']}],anchors:[],extractionWarnings:[]});
  const assets=await originalFigureAssets(source);assert.equal(assets.length,1);const image=assets[0];assert.equal(image.kind,'image');assert.deepEqual(image.shape,[]);assert.equal(image.checksum.scope,'manifest-and-data');
  const tampered=structuredClone(image);if(tampered.kind==='image')tampered.data.url='https://unrelated.invalid/private';await assert.rejects(()=>validateScientificAsset(tampered,source),/original figure source/);
  await assert.rejects(()=>validateScientificAsset(image,{...source,sourceVersion:'v2'}),/exact cited source/);
});
test('execution requires checked confirmed data and the asset adapter exposes precisely those values',async()=>{
  const asset=await importScientificData('data.csv','x,y\n1,2'),source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!,plan=representationFromAsset(asset,source,block.id);
  assert.equal(buildRepresentation(plan,source).status,'missing-data');
  assert.equal(buildRepresentation(plan,source,{assets:[structuredClone(asset)]}).status,'invalid');
  const built=buildRepresentation(plan,source,{assets:[asset]});assert.equal(built.status,'ready');if(built.status!=='ready')return;
  const run=await executeRepresentation(built.value,source);assert.equal(run.status,'ready');if(run.status==='ready'){const view=run.value.views[0];assert.equal(view.kind,'asset');if(view.kind==='asset')assert.deepEqual(view.asset.data,asset.data);}
  const untrusted=JSON.parse(JSON.stringify(plan)),reopened=await validateScientificAsset(untrusted.assetManifests[0]);assert.equal(buildRepresentation(untrusted,source,{assets:[reopened]}).status,'ready');
  const oldBinding=await scientificBinding(plan);const changed=await importScientificData('data.csv','x,y\n1,9',{id:asset.id});const changedPlan={...plan,assets:plan.assets.map(ref=>({...ref,checksum:changed.checksum.value})),assetManifests:[changed]};assert.notEqual(await scientificBinding(changedPlan),oldBinding);
});

test('large integer identifiers remain exact text and ambiguous JSON numeric precision is rejected',async()=>{
  const asset=await importScientificData('ids.csv','id,value\n9007199254740993,2');assert.equal(asset.kind,'table');if(asset.kind==='table')assert.equal(asset.data.rows[0].values[0],'9007199254740993');
  await assert.rejects(()=>importScientificData('ids.json','[{"id":9007199254740993}]'),/precision/);
});
test('supplying a dataset cannot silently make an adapter consume data it does not bind',async()=>{
  const {createSourceGuide}=await import('../lib/representations/source-guide');
  const asset=await importScientificData('data.csv','x\n2'),source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!,guide=createSourceGuide(source,block.id);
  const plan={...guide,assets:[{id:asset.id,kind:asset.kind,description:asset.label}],execution:{...guide.execution,assetIds:[asset.id]}};
  const result=buildRepresentation(plan,source,{assets:[asset]});assert.equal(result.status,'unsupported');
});

test('larger datasets remain usable as exact-checksum external bindings without oversized portable plans',async()=>{
  const csv='label\n'+('x'.repeat(300)+'\n').repeat(1000),asset=await importScientificData('large.csv',csv);
  const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!,plan=representationFromAsset(asset,source,block.id);
  assert.equal(plan.assetManifests,undefined);assert.ok(new TextEncoder().encode(JSON.stringify(plan)).length<256*1024);
  assert.equal(buildRepresentation(plan,source,{assets:[asset]}).status,'ready');
  const reopened=await importScientificData('large.csv',csv,{id:asset.id});assert.equal(buildRepresentation(JSON.parse(JSON.stringify(plan)),source,{assets:[reopened]}).status,'ready');
  const different=await importScientificData('large.csv','label\ndifferent',{id:asset.id});assert.equal(buildRepresentation(plan,source,{assets:[different]}).status,'invalid');
});

test('newly supplied asset bindings become part of artifact identity without mutating a portable request',async()=>{
  const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
  const a=await importScientificData('data.csv','x\n1'),b=await importScientificData('data.csv','x\n2',{id:a.id});
  const input=representationFromAsset(a,source,block.id);delete input.assetManifests;delete input.assets[0].checksum;
  const one=buildRepresentation(input,source,{assets:[a]}),two=buildRepresentation(input,source,{assets:[b]});assert.equal(one.status,'ready');assert.equal(two.status,'ready');if(one.status!=='ready'||two.status!=='ready')return;
  assert.equal(input.assets[0].checksum,undefined);assert.equal(one.value.plan.assets[0].checksum,a.checksum.value);assert.notEqual(await scientificBinding(one.value.plan),await scientificBinding(two.value.plan));
});
