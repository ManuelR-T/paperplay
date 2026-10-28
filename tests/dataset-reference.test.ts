import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatasetExample,DATASET_EXAMPLE_IDS} from '../lib/representations/dataset-examples';
import {createStatisticalExample} from '../lib/representations/statistical-examples';
import {analyzeDatasetStudy,verifyDatasetStudyResult,hasDatasetStudyComputation,datasetSourceFingerprint} from '../lib/datasets/model';
import {validateDatasetStudyRequest,type DatasetStudyRequest} from '../shared/dataset-studies';
import {hasCheckedAssetIntegrity,sealScientificAsset,validateScientificAsset} from '../lib/assets/local';
import {validateDocument} from '../shared/schema';

const near=(actual:number|null,expected:number,tolerance=1e-10)=>assert.ok(actual!==null&&Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected}`);
const source=validateDocument({schemaVersion:1,id:'authored-dataset-reference',sourceVersion:'rational-fixture-v1',title:'Authored rational arithmetic references',authors:['Paperplay'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'fixture',kind:'paragraph',page:1,text:'These synthetic rational values test bounded descriptive arithmetic; they are not observations from a scientific experiment.'}],anchors:[],extractionWarnings:['Project-authored illustrative input; no empirical provenance or experimental replication is claimed.']});
type DataRequest=Extract<DatasetStudyRequest,{mode:'data'}>;
type Row=[number|null,number|null,string,string|null,number|null,number|null];
async function fixture(rows:Row[]=[[0,1,'A','u1',5,.5],[1,2,'A','u2',5,.5],[2,5,'A','u3',5,.5]]){
 const asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'rational-values',label:'Synthetic arithmetic conformance values',kind:'table',shape:[rows.length,6],coordinates:{system:'Declared rational test coordinates',axes:[]},missingValues:'null',provenance:{origin:'illustrative',attribution:'Paperplay-authored mathematical fixture, not empirical data',rights:'Project-authored fixture'},transformations:[],data:{columns:[{id:'x',label:'Predictor',type:'number',unit:'s'},{id:'y',label:'Response',type:'number',unit:'m'},{id:'group',label:'Authored group',type:'text',unit:'category'},{id:'unit',label:'Declared unit ID',type:'text',unit:'identifier'},{id:'sourceN',label:'Authored n metadata',type:'number',unit:'count'},{id:'spread',label:'Authored uncertainty',type:'number',unit:'m'}],rows:rows.map((values,index)=>({id:`r${index}`,values}))}});
 const request:DataRequest={format:'paperplay-dataset-study',schemaVersion:1,mode:'data',source:{documentId:source.id,sourceVersion:source.sourceVersion,fingerprint:await datasetSourceFingerprint(source)},assetId:asset.id,checksum:asset.checksum.value,variables:{xColumn:'x',yColumn:'y'},groupColumn:'group',method:'linear-ols',transformations:[],replication:{observationUnit:'One synthetic row',experimentalUnit:'Authored mathematical unit, not a real experimental subject',unitIdColumn:'unit',dependence:'independent-units',sourceNColumn:'sourceN',sourceNMeaning:'Authored metadata; never summed to create independent n.'}};
 return {asset,request};
}
async function dataResult(request:DataRequest,asset:Parameters<typeof analyzeDatasetStudy>[1][number]){
 const result=await analyzeDatasetStudy(request,[asset],source);assert.equal(result.mode,'data');if(result.mode!=='data')throw Error();return result;
}
function exampleRequest(example:Awaited<ReturnType<typeof createDatasetExample>>){const view=example.plan.views[0];if(view.kind!=='dataset-study')throw Error();return view.dataset.request;}

test('Chew long table preserves all source summaries, source owner, root digest and exact input checksum',async()=>{
 const example=await createDatasetExample('biology'),original=await createStatisticalExample('biology');
 const asset=example.assets[0],wide=original.assets[0];assert.equal(asset.kind,'table');if(asset.kind!=='table'||wide.kind!=='table')throw Error();
 assert.ok(hasCheckedAssetIntegrity(asset));assert.deepEqual(asset.provenance,wide.provenance);
 assert.equal(asset.provenance.fileDigest,'98833cf34fda5b598ed0dbb390386abf1797e26b5e9393f5df8a1266c2ff5e68');
 assert.equal(asset.data.rows.length,20);assert.ok(asset.transformations.at(-1)!.description.includes(wide.checksum.value));
 assert.equal(new Set(asset.data.rows.map(row=>row.id)).size,20);
 for(const [index,row]of wide.data.rows.entries()){
  assert.deepEqual(asset.data.rows[2*index],{id:`col-${row.id}`,values:[row.values[0],'Col-0',row.values[1],row.values[2],row.values[5]]});
  assert.deepEqual(asset.data.rows[2*index+1],{id:`mir-${row.id}`,values:[row.values[0],'35S:miR156',row.values[3],row.values[4],row.values[5]]});
 }
 // Independently admitted workbook-cell checks, not a second call to the reshape routine.
 near(asset.data.rows[0].values[2] as number,.00042000000000000923);
 near(asset.data.rows[0].values[3] as number,.00012409673645989936);
 const request=exampleRequest(example),result=await analyzeDatasetStudy(request,example.assets,example.source);
 assert.equal(result.mode,'data');if(result.mode!=='data')throw Error();
 assert.equal(result.inputOrigin,'source-extracted');assert.equal(result.replication.independentN,null);assert.equal(result.groups.length,2);
 assert.ok(result.replication.sourceNValues.every(row=>row.value===5));assert.equal(result.replication.selectedRows,20);
 assert.ok(request.mode==='data'&&request.replication.dependence==='summary-only');
 assert.ok(result.observations.every(point=>point.uncertainty?.kind==='se'));
 const changed=structuredClone(request);if(changed.mode!=='data')throw Error();changed.selectedGroups=['Col-0'];
 const selected=await analyzeDatasetStudy(changed,example.assets,example.source);if(selected.mode!=='data')throw Error();
 assert.equal(selected.observations.length,10);assert.equal(selected.filteredOutRowIds.length,10);assert.equal(selected.replication.independentN,null);
});

test('NOAA contributing days and source uncertainty never become independent n or SE',async()=>{
 const example=await createDatasetExample('physics'),result=await analyzeDatasetStudy(exampleRequest(example),example.assets,example.source);
 if(result.mode!=='data')throw Error();assert.equal(result.observations.length,12);assert.equal(result.replication.independentN,null);
 assert.equal(result.replication.sourceNValues[0].value,29);assert.equal(result.observations[0].y,413.59);
 assert.equal(result.observations[0].uncertainty?.kind,'source-uncertainty');near(result.observations[0].uncertainty!.spread,.26);
 assert.ok(result.request.mode==='data'&&result.request.replication.sourceNMeaning.includes('not independent replicates'));
 assert.equal(result.groups[0].fit?.status,'ready');assert.equal(result.groups[0].fit?.predictions[0].observed,413.59);
});

test('development-corpus HH card uses a short verified anchor and reported-only fallback, with no fabricated observations',async()=>{
 assert.deepEqual(DATASET_EXAMPLE_IDS,['biology','physics','reported']);
 const example=await createDatasetExample('reported'),request=exampleRequest(example);
 assert.equal(example.assets.length,0);assert.equal(example.source.anchors[0].page,1);
 assert.equal(example.source.anchors[0].quote,'Right-hand column: observed time course of membrane currents during voltage clamp. Axon 31 at 4° C; compensated feedback.');
 assert.equal(example.source.anchors[0].quote.split(/\s+/).length,18);assert.ok(example.source.extractionWarnings.some(w=>w.includes('printed p. 521')));
 assert.ok(example.source.blocks.every(block=>block.kind!=='original-figure'));
 const result=await analyzeDatasetStudy(request,[],example.source);assert.equal(result.mode,'reported-only');if(result.mode!=='reported-only')throw Error();
 assert.equal(result.origin,'reported-only-declarations');assert.equal(result.bindings.assetId,null);assert.equal(result.bindings.checksum,null);
 assert.ok(!('observations' in result));assert.ok(!('groups' in result));
 assert.equal(result.cards[0].origin,'reported-by-source');assert.ok(result.cards[0].protocolReferences![0].label.includes('Partial protocol'));
 assert.ok(result.cards[1].summary.includes('Source-calculated curves are not observed'));
 assert.ok(result.cards.every(card=>card.availabilityReason.length>80));
});

test('authored noisy rational OLS reference preserves responses, residuals, SSE and sample spread',async()=>{
 const {asset,request}=await fixture(),result=await dataResult(request,asset),group=result.groups[0],fit=group.fit!;
 assert.equal(result.inputOrigin,'illustrative');assert.equal(fit.status,'ready');near(fit.intercept,2/3);near(fit.slope,2);near(fit.sse,2/3);
 near(fit.residualVariance,2/3);assert.equal(fit.residualDF,1);near(group.y.mean,8/3);near(group.y.sampleSD,Math.sqrt(13/3));
 for(const [index,expected]of [1/3,-2/3,1/3].entries())near(fit.predictions[index].residual,expected);
 assert.deepEqual(fit.predictions.map(point=>point.observed),[1,2,5]);assert.deepEqual(result.observations.map(point=>point.y),[1,2,5]);
 assert.equal(result.replication.independentN,3);assert.ok(!('sem' in group.y));
});

test('complete-case fit exclusion remains distinct from per-variable missingness and group counts',async()=>{
 const {asset,request}=await fixture([[0,1,'A','u1',5,null],[1,null,'A','u2',5,null],[null,7,'B','u3',5,null],[2,5,'B','u4',5,null]]);
 const result=await dataResult(request,asset);
 assert.deepEqual(result.missingness,{selected:4,x:{present:3,missing:1},y:{present:3,missing:1}});
 assert.deepEqual(result.includedRowIds,['r0','r3']);assert.deepEqual(result.excluded,[{rowId:'r1',reasons:['y-missing']},{rowId:'r2',reasons:['x-missing']}]);
 assert.deepEqual(result.groups.map(group=>[group.key,group.y.n,group.usableRowIds.length]),[['A',1,1],['B',2,1]]);
 assert.ok(result.groups.every(group=>group.fit?.status==='unavailable'));
 const filtered=structuredClone(request);filtered.selectedGroups=['B'];const selected=await dataResult(filtered,asset);
 assert.deepEqual(selected.filteredOutRowIds,['r0','r1']);assert.equal(selected.missingness.selected,2);
});

test('repeated or missing unit identities cannot manufacture independent replication or pool source n',async()=>{
 for(const ids of [['plant1','plant1','plant2'],['plant1',null,'plant2']] as const){
  const {asset,request}=await fixture(ids.map((id,i)=>[i,2*i+1,'A',id,5,null]));
  const result=await dataResult(request,asset);assert.equal(result.replication.independentN,null);
  assert.deepEqual(result.replication.sourceNValues.map(row=>row.value),[5,5,5]);
  assert.ok(result.replication.duplicateUnitIds.length>0||result.replication.missingUnitIdRows.length>0);
 }
});

test('singleton/all-missing and constant-predictor inputs retain values with unavailable statistics',async()=>{
 for(const rows of [[[1,2,'A','u1',null,null]],[[null,null,'A','u1',null,null]],[[1,2,'A','u1',null,null],[1,4,'A','u2',null,null]]] as Row[][]){
  const {asset,request}=await fixture(rows),result=await dataResult(request,asset);
  assert.equal(result.groups[0].fit!.status,'unavailable');
  if(rows.length===1)assert.equal(result.groups[0].y.sampleSD,null);
  if(rows[0][1]===null)assert.equal(result.groups[0].y.mean,null);
 }
 const {asset,request}=await fixture([[0,1,'A','u1',null,null],[1,3,'A','u2',null,null]]),result=await dataResult(request,asset);
 assert.equal(result.groups[0].fit!.status,'ready');assert.equal(result.groups[0].fit!.residualDF,0);assert.equal(result.groups[0].fit!.residualVariance,null);
});

test('unit conversions change fit units and supplied spreads without changing selected row identity',async()=>{
 const {asset,request}=await fixture();request.transformations=[{kind:'unit-conversion',axis:'y',to:'cm'}];request.suppliedUncertainty={kind:'sd',column:'spread',meaning:'Authored conformance spread, not empirical uncertainty.'};
 const result=await dataResult(request,asset);assert.equal(result.units.y,'cm');near(result.groups[0].fit!.slope,200);near(result.groups[0].fit!.sse,20000/3,1e-8);
 near(result.observations[0].uncertainty!.spread,50);assert.deepEqual(result.includedRowIds,['r0','r1','r2']);
 const bad=structuredClone(request);bad.transformations=[{kind:'unit-conversion',axis:'y',to:'s'}];await assert.rejects(()=>dataResult(bad,asset));
});

test('absolute Celsius points and Celsius SE use different conversion roles',async()=>{
 const original=await fixture([[0,0,'A','u1',null,2],[1,100,'A','u2',null,2],[2,50,'A','u3',null,2]]);
 if(original.asset.kind!=='table')throw Error();const {checksum:_,...base}=original.asset;
 const asset=await sealScientificAsset({...base,data:{...base.data,columns:base.data.columns.map(column=>column.id==='y'?{...column,unit:'degC',temperatureMode:'absolute'}:column.id==='spread'?{...column,unit:'degC',temperatureMode:'difference'}:column)}});
 const request=structuredClone(original.request);request.checksum=asset.checksum.value;request.method='descriptive';request.transformations=[{kind:'unit-conversion',axis:'y',to:'K'}];request.suppliedUncertainty={kind:'se',column:'spread',meaning:'Synthetic SE used only to check affine temperature roles.'};
 const result=await dataResult(request,asset);near(result.groups[0].y.mean,323.15);near(result.groups[0].y.sampleSD,50);
 near(result.observations[0].y,273.15);near(result.observations[0].uncertainty!.spread,2);near(result.observations[0].uncertainty!.lower,271.15);
});

test('centering resolves large predictor offsets and overflow falls back without losing supplied values',async()=>{
 const centered=await fixture([[1e12,1,'A','u1',null,null],[1e12+1,3,'A','u2',null,null],[1e12+2,5,'A','u3',null,null]]);
 const result=await dataResult(centered.request,centered.asset);near(result.groups[0].fit!.slope,2);near(result.groups[0].fit!.sse,0);
 assert.deepEqual(result.groups[0].fit!.predictions.map(point=>point.predicted),[1,3,5]);
 const extreme=await fixture([[0,1.5e308,'A','u1',null,null],[1,-1.5e308,'A','u2',null,null]]);
 const fallback=await dataResult(extreme.request,extreme.asset);near(fallback.groups[0].y.mean,0);assert.equal(fallback.groups[0].y.sampleSD,null);
 assert.equal(fallback.groups[0].fit!.status,'unavailable');assert.deepEqual(fallback.observations.map(point=>point.y),[1.5e308,-1.5e308]);
});

test('source/checksum changes and copied results never inherit a local computation receipt',async()=>{
 const {asset,request}=await fixture(),result=await dataResult(request,asset);assert.ok(hasDatasetStudyComputation(result));
 const imported=structuredClone(result);assert.equal(hasDatasetStudyComputation(imported),false);
 imported.groups[0].y.mean=999;await assert.rejects(()=>verifyDatasetStudyResult(imported,request,[asset],source),/differ/);
 const recalc=await verifyDatasetStudyResult(structuredClone(result),request,[asset],source);assert.ok(hasDatasetStudyComputation(recalc));
 const changed=structuredClone(source);changed.blocks[0]={id:'fixture',kind:'paragraph',page:1,text:'Changed source body.'};
 await assert.rejects(()=>analyzeDatasetStudy(request,[asset],changed),/fingerprint/);
 const wrong=structuredClone(request);wrong.checksum='0'.repeat(64);await assert.rejects(()=>analyzeDatasetStudy(wrong,[asset],source),/checksum/);
 await assert.rejects(()=>analyzeDatasetStudy(request,[structuredClone(asset)],source),/integrity-checked/);
 const restored=await validateScientificAsset(structuredClone(asset));assert.ok(hasCheckedAssetIntegrity(restored));
 const invalid=structuredClone(request);invalid.variables.xColumn=null;assert.throws(()=>validateDatasetStudyRequest(invalid));
});
