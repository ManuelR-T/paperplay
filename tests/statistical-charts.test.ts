import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatisticalExample,statisticalExampleVariant } from '../lib/representations/statistical-examples';
import { buildChartModel,chartSegments,chartCoordinate,descriptiveLinearFit } from '../lib/charts/model';
import { sealScientificAsset } from '../lib/assets/local';
import { validateStatisticalChart,type StatisticalChart } from '../shared/statistical-charts';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { representationInputRevision,isRepresentationSelection,selectionAnchorIds } from '../shared/representation-selection';
import { parseDataStudy,serializeDataStudy } from '../lib/representations/data-study';
import { scientificBinding } from '../lib/representations/evidence';
const near=(actual:number,expected:number,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} vs ${expected}`);
async function fixture(rows:(number|null)[][]=[[1,2,.5,1],[2,4,.25,2],[3,null,null,3],[4,8,1,4]]){
 const asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'values',label:'Synthetic conformance values, not empirical measurements',kind:'table',shape:[rows.length,4],coordinates:{system:'Declared test axes',axes:[]},missingValues:'null',provenance:{origin:'illustrative',attribution:'Authored deterministic test fixture',rights:'Project-authored fixture'},transformations:[],data:{columns:[{id:'x',label:'x',type:'number',unit:'s'},{id:'y',label:'y',type:'number',unit:'m'},{id:'error',label:'error',type:'number',unit:'m'},{id:'pair',label:'pair key',type:'number',unit:'index'}],rows:rows.map((values,i)=>({id:`row${i}`,values}))}});
 const chart:StatisticalChart={id:'test',title:'Synthetic chart',kind:'line',anchorIds:['passage'],x:{label:'Time',unit:'s',scale:'linear'},y:{label:'Position',unit:'m',scale:'linear'},series:[{id:'series',label:'Illustrative series',assetId:asset.id,xColumn:'x',yColumn:'y',origin:'illustrative',interpretation:'Explicit synthetic test values, never source observations.',order:'source',uncertainty:{kind:'standard-deviation',column:'error',interpretation:'Declared illustrative SD, not SE or CI.'}}]};return {asset,chart};
}
test('real biological source means and supplied SE preserve units, five-plant counts and rank-matched differences',async()=>{
 const {source,plan,assets}=await createStatisticalExample('biology'),view=plan.views[0];if(view.kind!=='statistical-chart')throw Error();const model=buildChartModel(view.chart,assets);
 assert.equal(model.series.length,2);assert.equal(model.series[0].points.length,10);assert.equal(model.spec.y.unit,'g');near(model.series[0].points[0].y!,0.00042000000000000923);near(model.series[0].points[0].upper!-model.series[0].points[0].y!,0.00012409673645989936);
 assert.equal(model.series[0].points[0].count,5);assert.equal(model.series[0].uncertainty?.kind,'standard-error');assert.equal(model.comparisons.length,10);near(model.comparisons[0].difference,.0012000000000000123-.00042000000000000923);
 assert.ok(model.series.every(s=>s.origin==='observed'));assert.ok(assets[0].provenance.rights.includes('CC0'));assert.ok(model.warnings.some(w=>w.includes('not significance')));
 const built=buildRepresentation(plan,source,{assets});assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();const run=await executeRepresentation(built.value,source,{environment:{facilities:['asset-integrity'],offline:true}});assert.equal(run.status,'ready');if(run.status==='ready')assert.equal(run.value.evidence.verified,false);
});
test('NOAA observations, source processing, descriptive fit and illustration remain four distinct origins',async()=>{
 const {plan,assets}=await createStatisticalExample('physics'),view=plan.views[0];if(view.kind!=='statistical-chart')throw Error();const model=buildChartModel(view.chart,assets);
 assert.deepEqual(model.series.map(s=>s.origin),['observed','processed','fitted','illustrative']);assert.equal(model.spec.y.unit,'ppm');assert.equal(model.series[0].points.length,12);
 assert.equal(model.series[0].points[0].y,413.59);assert.equal(model.series[0].points[11].y,414.23);assert.equal(model.series[0].points[0].count,29);near(model.series[0].points[0].upper!,413.85);
 assert.equal(model.series[0].uncertainty?.kind,'source-uncertainty');assert.ok(!('coverage'in model.series[0].uncertainty!));
 near(model.series[2].method!.intercept,413.1454736904323,1e-9);near(model.series[2].method!.slope,2.1357192858021357,1e-9);assert.equal(model.series[2].uncertainty,undefined);assert.equal(model.series[3].inputOrigin,'illustrative');
 assert.equal(assets[0].provenance.fileDigest,'d895fb5b4a59fb5e4cd98e69b7667fe5bef595c6581f630852b12cb41c07f675');
});
test('missing rows break lines, preserve uncertainty semantics and cannot become zero observations',async()=>{
 const {asset,chart}=await fixture(),model=buildChartModel(chart,[asset]);assert.equal(model.series[0].missing,1);assert.equal(model.series[0].points[2].y,null);assert.deepEqual(chartSegments(model.series[0].points).map(segment=>segment.length),[2,1]);
 assert.equal(model.series[0].points[2].lower,null);assert.deepEqual(model.domains.y,[1.5,9]);assert.equal(model.series[0].uncertainty!.kind,'standard-deviation');
 const invalid=structuredClone(chart);invalid.series[0].origin='observed';assert.throws(()=>buildChartModel(invalid,[asset]),/cannot be relabeled/);
 assert.throws(()=>buildChartModel(chart,[structuredClone(asset)]),/checked table/);
});
test('reference scale/domain checks include uncertainty and retain one shared comparison scale',async()=>{
 const {asset,chart}=await fixture();const log=structuredClone(chart);log.x.scale='log';log.y.scale='log';const model=buildChartModel(log,[asset]);near(chartCoordinate(10,[1,100],'log',0,100),50);assert.equal(model.domains.y[0],1.5);
 const hidden=structuredClone(chart);hidden.y.domain=[2,8];assert.throws(()=>buildChartModel(hidden,[asset]),/hide plotted values or uncertainty/);
 const {asset:zero}=await fixture([[0,1,2,1]]);assert.throws(()=>buildChartModel(log,[zero]),/positive values/);
 const bar=structuredClone(chart);bar.kind='bar';assert.equal(buildChartModel(bar,[asset]).domains.y[0],0);bar.y.domain=[1,10];assert.throws(()=>buildChartModel(bar,[asset]),/including zero/);
 const wrong=structuredClone(chart);wrong.y.unit='cm';assert.throws(()=>buildChartModel(wrong,[asset]),/exactly cm/);
});
test('interval ordering and missing bounds stay explicit without inventing symmetric confidence meaning',async()=>{
 const {asset,chart}=await fixture();const interval=structuredClone(chart);interval.series[0].uncertainty={kind:'confidence-interval',lowerColumn:'error',upperColumn:'y',coverage:.95,interpretation:'Fixture interval supplied by the author, not computed here.'};
 const model=buildChartModel(interval,[asset]);assert.equal(model.series[0].points[0].lower,.5);assert.equal(model.series[0].uncertainty?.kind,'confidence-interval');
 const {asset:negative}=await fixture([[1,2,-.5,1]]);assert.throws(()=>buildChartModel(chart,[negative]),/Negative uncertainty/);
 const swapped=structuredClone(interval);swapped.series[0].uncertainty={kind:'range',lowerColumn:'y',upperColumn:'error',interpretation:'Bad bounds'};assert.throws(()=>buildChartModel(swapped,[asset]),/bounds must increase/);
});
test('distributions use common bin edges, preserve original member values and count missing data separately',async()=>{
 const {plan,assets}=await createStatisticalExample('biology'),variant=statisticalExampleVariant(plan,'distribution'),view=variant.views[0];if(view.kind!=='statistical-chart')throw Error();const model=buildChartModel(view.chart,assets);
 assert.equal(model.spec.y.unit,'count');assert.equal(model.series.length,2);for(const series of model.series){assert.equal(series.derivation,'equal-width-histogram');assert.equal(series.points.reduce((sum,p)=>sum+p.y!,0),10);assert.equal(series.points.flatMap(p=>p.members!).length,10);assert.equal(series.uncertainty,undefined);}
 assert.deepEqual(model.series[0].points.map(p=>[p.binLower,p.binUpper]),model.series[1].points.map(p=>[p.binLower,p.binUpper]));assert.ok(isRepresentationSelection(variant,{kind:'entity',viewId:'chart',scopeId:'chart',entityId:'col:bin0'}));
});
test('descriptive fitting, replicate identity and paired keys refuse ambiguous or nonfinite arithmetic',async()=>{
 assert.deepEqual(descriptiveLinearFit([{x:0,y:1},{x:1,y:3},{x:2,y:5}]),{name:'ordinary-least-squares',intercept:1,slope:2,n:3});assert.throws(()=>descriptiveLinearFit([{x:1,y:1},{x:1,y:2}]),/varying x/);
 const {asset,chart}=await fixture([[1,2,.5,1],[2,4,.5,1]]);chart.series.push({...chart.series[0],id:'other'});chart.comparison={left:'series',right:'other',pairColumn:'pair',interpretation:'Explicit test keys, no aggregation allowed'};assert.throws(()=>buildChartModel(chart,[asset]),/unique within each series/);
 const tooMany=structuredClone(chart);tooMany.series[1].id='series';assert.throws(()=>validateStatisticalChart(tooMany),/unique/);
});
test('complete data studies restore linked selections and exact assets locally without changing scientific evidence',async()=>{
 const {source,plan,assets}=await createStatisticalExample('physics');const selection={kind:'entity' as const,viewId:'chart',scopeId:'chart',entityId:'observed:month1'};
 const selected={...plan,navigation:{format:'paperplay-semantic-navigation' as const,schemaVersion:1 as const,revision:representationInputRevision(plan),selections:[selection]}};
 const restored=await parseDataStudy(serializeDataStudy(source,selected));assert.deepEqual(restored.plan.navigation,selected.navigation);assert.equal(restored.assets[0].checksum.value,assets[0].checksum.value);assert.deepEqual(selectionAnchorIds(plan,[selection]),['record']);assert.equal(await scientificBinding(selected),await scientificBinding(plan));
 const invalid=JSON.parse(serializeDataStudy(source,selected));invalid.representation.assetManifests[0].data.rows[0].values[2]=1;delete invalid.representation.navigation;await assert.rejects(()=>parseDataStudy(JSON.stringify(invalid)),/checksum/);
 const version=JSON.parse(serializeDataStudy(source,selected));version.version=9;await assert.rejects(()=>parseDataStudy(JSON.stringify(version)));
});
