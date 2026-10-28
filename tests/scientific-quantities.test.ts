import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScientificQuantity, scientificUnits, type ScientificQuantity, type ScientificCoordinates } from '../shared/scientific-quantities';
import { convertValue, convertQuantity, combineQuantities, bindScientificQuantity, convertCoordinates, compatibleUnits } from '../lib/quantities/convert';
import { importScientificData } from '../lib/assets/import';
import { changeTableUnit } from '../lib/quantities/asset-units';
const base={format:'paperplay-quantity' as const,schemaVersion:1 as const,unitCatalogVersion:'1.0.0' as const,id:'quantity',label:'Synthetic quantity fixture'};
const scalar=(value:number,unit:ScientificQuantity['unit'],temperatureMode?:'absolute'|'difference'):ScientificQuantity=>({...base,kind:'scalar',value,unit,temperatureMode});
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} vs ${expected}`);

test('independent SI examples cover prefixes, volume, concentration and incompatible dimensions',()=>{
 near(convertValue(1,'m','cm'),100);near(convertValue(2500,'mg','g'),2.5);near(convertValue(2,'h','s'),7200);near(convertValue(1,'L','m3'),.001);near(convertValue(1,'mol/L','mmol/L'),1000);near(convertValue(1,'mg/mL','g/L'),1);
 assert.equal(compatibleUnits('Pa','kPa'),true);assert.equal(compatibleUnits('m','s'),false);assert.throws(()=>convertValue(1,'m','s'),/compatible dimensions/);assert.throws(()=>convertValue(1,'index','m'),/calibration/);assert.throws(()=>convertValue(1,'index','1'),/calibration/);
 assert.throws(()=>convertValue(1e308,'m','nm'),/finite/);assert.throws(()=>{scientificUnits.m.scale=9;});
});
test('absolute Celsius temperatures and differences have distinct conversions and arithmetic',()=>{
 near(convertValue(20,'degC','K','absolute'),293.15);near(convertValue(20,'degC','K','difference'),20);near(convertValue(-273.15,'degC','K','absolute'),0);
 assert.throws(()=>convertValue(20,'degC','K'),/interpretation/);assert.throws(()=>validateScientificQuantity(scalar(-274,'degC','absolute')),/zero kelvin/);
 assert.throws(()=>combineQuantities(scalar(20,'degC','absolute'),scalar(10,'degC','absolute')),/absolute temperature/);
 const difference=combineQuantities(scalar(20,'degC','absolute'),scalar(10,'degC','absolute'),'subtract');assert.equal(difference.kind,'scalar');if(difference.kind==='scalar')near(difference.value,10);assert.equal(difference.temperatureMode,'difference');
 const point=combineQuantities(scalar(10,'K','difference'),scalar(20,'degC','absolute'));assert.equal(point.unit,'degC');assert.equal(point.temperatureMode,'absolute');if(point.kind==='scalar')near(point.value,30);
 assert.throws(()=>combineQuantities(scalar(0,'K','absolute'),scalar(1,'K','difference'),'subtract'),/zero kelvin/);
});
test('uncertainty conversion scales standard deviations without adding offsets and retains interval semantics',()=>{
 const q={...scalar(20,'degC','absolute'),uncertainty:{kind:'standard' as const,values:[.5]}};
 const converted=convertQuantity(q,'K');if(converted.kind==='scalar')near(converted.value,293.15);assert.deepEqual(converted.uncertainty,{kind:'standard',values:[.5]});
 const interval=convertQuantity({...scalar(20,'degC','absolute'),uncertainty:{kind:'interval',lower:[19],upper:[21]}},'K');assert.deepEqual(interval.uncertainty,{kind:'interval',lower:[292.15],upper:[294.15]});
 assert.throws(()=>combineQuantities(q,q),/covariance/);assert.throws(()=>validateScientificQuantity({...q,uncertainty:{kind:'standard',values:[.1,.2]}}),/shape/);
});
test('scalar, vector, matrix and field quantity shapes are explicit before an adapter executes',()=>{
 const matrix={...base,kind:'matrix' as const,unit:'cm' as const,values:[[100,200],[300,400]]};
 const converted=bindScientificQuantity(matrix,{kind:'matrix',unit:'m',shape:[2,2]});if(converted.kind==='matrix')assert.deepEqual(converted.values,[[1,2],[3,4]]);
 const vector=bindScientificQuantity({...base,kind:'vector',unit:'m',values:[1,2]},{kind:'vector',unit:'cm',shape:[2]});if(vector.kind==='vector')assert.deepEqual(vector.values,[100,200]);
 assert.throws(()=>bindScientificQuantity(matrix,{kind:'vector',unit:'cm',shape:[4]}),/shape/);assert.throws(()=>validateScientificQuantity({...matrix,values:[[1,2],[3]]}),/rectangular/);
 assert.throws(()=>combineQuantities(scalar(1,'m'),scalar(1,'s')),/physical dimensions/);
});
test('coordinate units preserve origin, direction and frame without rotating or resampling fields',()=>{
 const coordinates:ScientificCoordinates={frame:'sample',system:'cartesian',orientation:'right-handed',axes:[{id:'x',label:'Distance',unit:'cm',origin:100,spacing:10,direction:-1}]};
 const expected=convertCoordinates(coordinates,{x:'m'});near(expected.axes[0].origin,1);near(expected.axes[0].spacing,.1);assert.equal(expected.axes[0].direction,-1);assert.equal(coordinates.axes[0].unit,'cm');
 const field:ScientificQuantity={...base,kind:'field',unit:'g/L',shape:[2],values:[1,2],coordinates};
 const bound=bindScientificQuantity(field,{kind:'field',unit:'kg/m3',shape:[2],coordinates:expected});if(bound.kind==='field'){assert.deepEqual(bound.values,[1,2]);assert.deepEqual(bound.coordinates,expected);}
 assert.throws(()=>bindScientificQuantity(field,{kind:'field',unit:'kg/m3',shape:[2],coordinates:{...expected,frame:'another'}}),/coordinates/);
 assert.throws(()=>bindScientificQuantity(field,{kind:'field',unit:'kg/m3',shape:[2],coordinates:{...expected,axes:[{...expected.axes[0],direction:1}]}}),/coordinates/);
 assert.throws(()=>convertCoordinates(coordinates,{missing:'m'}),/axis/);
});
test('declaring table units preserves values, conversion changes them, and missingness and integrity are retained',async()=>{
 const input=await importScientificData('data.csv','length\n100\n\n'),declared=await changeTableUnit(input,'c0','cm');
 assert.equal(declared.kind,'table');if(declared.kind!=='table')return;assert.deepEqual(declared.data.rows.map(row=>row.values),[[100],[null]]);
 const converted=await changeTableUnit(declared,'c0','m');if(converted.kind==='table')assert.deepEqual(converted.data.rows.map(row=>row.values),[[1],[null]]);
 assert.notEqual(converted.checksum.value,declared.checksum.value);assert.equal(converted.provenance.fileDigest,input.provenance.fileDigest);
 await assert.rejects(()=>changeTableUnit(declared,'c0','s'),/dimensions/);
 const temperatures=await importScientificData('temperature.csv','temperature\n20');await assert.rejects(()=>changeTableUnit(temperatures,'c0','degC'),/temperature/);
 const celsius=await changeTableUnit(temperatures,'c0','degC','absolute'),kelvin=await changeTableUnit(celsius,'c0','K','absolute');if(kelvin.kind==='table')near(kelvin.data.rows[0].values[0] as number,293.15);
 await assert.rejects(()=>changeTableUnit(celsius,'c0','K','difference'),/cannot change/);
});

test('converted data exports preserve exact checksum-bound transformations and uncertainty plans round-trip',async()=>{
 const {validateScientificAsset}=await import('../lib/assets/local');
 const {representationFromAsset}=await import('../lib/representations/from-asset');
 const {preparedPapers}=await import('../data/papers');
 const {validateRepresentationPlan}=await import('../shared/representations');
 const {buildRepresentation,executeRepresentation}=await import('../lib/representations/lifecycle');
 const {createSourceGuide}=await import('../lib/representations/source-guide');
 const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
 const asset=await changeTableUnit(await importScientificData('data.csv','x\n100'),'c0','cm'),converted=await changeTableUnit(asset,'c0','m');
 const artifact=representationFromAsset(converted,source,block.id),restored=await validateScientificAsset(JSON.parse(JSON.stringify(converted)));
 assert.equal(buildRepresentation(JSON.parse(JSON.stringify(artifact)),source,{assets:[restored]}).status,'ready');
 const measurement={...scalar(20,'degC','absolute'),uncertainty:{kind:'standard' as const,values:[.5]}};
 const guide=createSourceGuide(source,block.id),input={...guide,quantities:[{id:measurement.id,symbol:'T',unit:measurement.unit,description:'Synthetic unit fixture, not a source measurement.',measurement}],execution:{kind:'none',capabilities:[{id:'quantity-inspector',version:'1.0.0'}],assetIds:[]},interactions:['inspect-data','return-source'],views:[{id:'quantity-view',kind:'quantity',quantityId:measurement.id,requirement:{kind:'scalar',unit:'K',temperatureMode:'absolute',shape:[]}}]};
 const plan=validateRepresentationPlan(input,source);assert.deepEqual(validateRepresentationPlan(JSON.parse(JSON.stringify(plan)),source),plan);
 const built=buildRepresentation(plan,source);assert.equal(built.status,'ready');if(built.status!=='ready')return;
 const run=await executeRepresentation(built.value,source);assert.equal(run.status,'ready');if(run.status==='ready'){const view=run.value.views[0];assert.equal(view.kind,'quantity');if(view.kind==='quantity'){assert.equal(view.quantity.unit,'K');if(view.quantity.kind==='scalar')near(view.quantity.value,293.15);assert.deepEqual(view.quantity.uncertainty,{kind:'standard',values:[.5]});}}
 const bad=structuredClone(plan);if(bad.views[0].kind==='quantity')bad.views[0].requirement.unit='m';assert.equal(buildRepresentation(bad,source).status,'invalid');
 const missing=structuredClone(plan);delete missing.quantities[0].measurement;assert.equal(buildRepresentation(missing,source).status,'missing-data');
});

test('declaring units never changes fractional values through an identity conversion',async()=>{
 const asset=await importScientificData('temperature.csv','temperature\n20.1');
 const declared=await changeTableUnit(asset,'c0','degC','absolute');if(declared.kind==='table')assert.equal(declared.data.rows[0].values[0],20.1);
 assert.equal(convertValue(1.2,'cm','cm'),1.2);
});

test('large coordinate origins cannot hide a displacement that exceeds the local grid spacing',()=>{
 const coordinates:ScientificCoordinates={frame:'large-origin',system:'cartesian',orientation:'right-handed',axes:[{id:'x',label:'Position',unit:'m',origin:1e12,spacing:.01,direction:1}]};
 const field:ScientificQuantity={...base,kind:'field',unit:'1',shape:[2],values:[1,2],coordinates};
 assert.throws(()=>bindScientificQuantity(field,{kind:'field',unit:'1',shape:[2],coordinates:{...coordinates,axes:[{...coordinates.axes[0],origin:1e12+.5}]}}),/coordinates/);
});
