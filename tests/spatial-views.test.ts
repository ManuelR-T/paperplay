import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectImageBytes } from '../lib/spatial/image-bytes';
import { validateSpatialView,type SpatialView } from '../shared/spatial-views';
import { pixelPoint,regionFromPixels,pixelsFromRegion,regionSummary,preflightSpatialView,scaleBar } from '../lib/spatial/model';
import { createSpatialExample } from '../lib/representations/spatial-examples';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { serializeDataStudy,parseDataStudy } from '../lib/representations/data-study';
import { scientificBinding } from '../lib/representations/evidence';
import { representationInputRevision,isRepresentationSelection } from '../shared/representation-selection';
import { loadSpatialImage } from '../lib/spatial/images';
import { sealScientificAsset } from '../lib/assets/local';
const base:SpatialView={id:'spatial',title:'Illustrative scalar grid',anchorIds:['passage'],input:{kind:'field',assetId:'field',valueUnit:'K',temperatureMode:'absolute'},calibration:{frame:'sample',kind:'declared',unit:'mm',x:{origin:10,spacing:.5,direction:1},y:{origin:20,spacing:1,direction:-1},anchorIds:['passage'],interpretation:'Authored coordinate fixture, not an experimental calibration.'},overlays:[]};
async function field(){return sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'field',label:'Synthetic coordinate fixture',kind:'tensor',shape:[2,3],coordinates:{system:'Row-major y,x',axes:[{label:'y',unit:'mm',direction:'decreasing'},{label:'x',unit:'mm',direction:'increasing'}]},missingValues:'null',provenance:{origin:'illustrative',attribution:'Authored conformance fixture',rights:'Project-authored'},transformations:[],data:{values:[300,null,302,303,304,305]}});}
test('admitted CDC archive bytes remain unchanged and identify one bounded baseline JPEG raster',()=>{
 const bytes=readFileSync('public/scientific-images/cdc-phil-259.jpg');assert.equal(bytes.length,47880);assert.equal(createHash('sha256').update(bytes).digest('hex'),'821ee79de51d29f154970eef816521388caa11335c1ac6339e86e38d53839565');assert.deepEqual(inspectImageBytes(bytes),{width:700,height:412,mime:'image/jpeg'});
 const app1=Buffer.concat([bytes.subarray(0,2),Buffer.from([255,225,0,4,0,0]),bytes.subarray(2)]);assert.throws(()=>inspectImageBytes(app1),/orientation/);
 assert.throws(()=>inspectImageBytes(bytes.subarray(0,bytes.length-2)),/end marker/);
 assert.throws(()=>inspectImageBytes(Buffer.from('<svg onload="throw Error()"/>')),/PNG/);
});
test('pixel selection stays in the original frame under zoom, pan and reversed calibrated axes',()=>{
 assert.deepEqual(pixelPoint(150,100,{left:-50,top:0,width:400,height:200},{width:200,height:100}),{column:100,row:50});
 const bounds={left:0,top:0,right:2,bottom:1},region=regionFromPixels('view',bounds,base.calibration);assert.deepEqual(region.min,[10,19]);assert.deepEqual(region.max,[11,20]);assert.deepEqual(pixelsFromRegion(region,base.calibration,{width:3,height:2}),bounds);
 assert.throws(()=>pixelsFromRegion({...region,frame:'different'},base.calibration,{width:3,height:2}),/differs/);
 const bar=scaleBar(base.calibration,100);assert.equal(bar.unit,'mm');assert.equal(bar.length/bar.pixels,.5);
});
test('field missing cells remain unknown and ROI summaries do not incorporate overlay pixels',async()=>{
 const asset=await field();if(asset.kind!=='tensor')throw Error();const prepared=preflightSpatialView(base,[asset]);assert.deepEqual(prepared.size,{width:3,height:2});
 const summary=regionSummary({left:0,top:0,right:2,bottom:1},{width:3,height:2},asset.data.values,'field');assert.equal(summary.pixels,6);assert.equal(summary.sampled,5);assert.equal(summary.missing,1);assert.equal(summary.mean,(300+302+303+304+305)/5);
 assert.equal(regionSummary({left:1,top:0,right:1,bottom:0},{width:3,height:2},asset.data.values,'field').mean,null);
 assert.throws(()=>regionSummary({left:-1,top:0,right:1,bottom:0},{width:3,height:2},asset.data.values,'field'),/inside/);
 const large=regionSummary({left:0,top:0,right:255,bottom:255},{width:256,height:256},[],'field');assert.equal(large.limited,true);assert.equal(large.mean,null);
});
test('calibration and masks cannot invent physical units, segmentation truth or mismatched raster shapes',async()=>{
 const pixel=structuredClone(base);pixel.calibration.kind='pixel';assert.throws(()=>validateSpatialView(pixel,['passage']),/Pixel coordinates/);
 const incompatible=structuredClone(base);incompatible.calibration.unit='s';assert.throws(()=>validateSpatialView(incompatible,['passage']),/length units/);
 const fake=structuredClone(base);fake.overlays=[{id:'mask',kind:'mask',assetId:'field',label:'Declared generated mask',origin:'generated-overlay',opacity:.4,anchorIds:['passage'],interpretation:'Not verified segmentation.'}];await assert.rejects(async()=>preflightSpatialView(fake,[await field()]),/binary/);
 const outside=structuredClone(base);outside.overlays=[{id:'box',kind:'rectangle',bounds:[0,0,4,4],label:'Authored ROI',origin:'authored-annotation',opacity:.3,anchorIds:['passage'],interpretation:'Authored illustration only.'}];await assert.rejects(async()=>preflightSpatialView(outside,[await field()]),/outside/);
 assert.throws(()=>validateSpatialView({...base,verifiedSegmentation:true}),/Unrecognized/);
});

test('real microscopy and an authored physical field use the same lifecycle and portable local study host',async()=>{
 for(const kind of ['microscopy','field'] as const){
   const {source,plan,assets}=await createSpatialExample(kind),built=buildRepresentation(plan,source,{assets,environment:{facilities:['asset-integrity'],offline:true}});assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();
   const execute=await executeRepresentation(built.value,source,{environment:{facilities:['asset-integrity'],offline:true}});assert.equal(execute.status,'ready');if(execute.status==='ready')assert.equal(execute.value.evidence.verified,false);
   const view=plan.views[0];if(view.kind!=='spatial-view')throw Error();const region=regionFromPixels(view.id,{left:1,top:1,right:3,bottom:3},view.spatial.calibration);
   assert.ok(isRepresentationSelection(plan,region));const saved={...plan,navigation:{format:'paperplay-semantic-navigation' as const,schemaVersion:1 as const,revision:representationInputRevision(plan),selections:[region]}};
   const text=serializeDataStudy(source,saved);assert.equal(JSON.parse(text).version,2);const restored=await parseDataStudy(text);assert.deepEqual(restored.plan.navigation,saved.navigation);assert.deepEqual(restored.assets.map(a=>a.checksum.value),assets.map(a=>a.checksum.value));
   const zoomed=structuredClone(saved);if(zoomed.views[0].kind!=='spatial-view')throw Error();zoomed.views[0].spatial.viewport={zoom:2,panX:10,panY:20,palette:'grayscale',visibleOverlayIds:[]};assert.equal(representationInputRevision(zoomed),representationInputRevision(saved));assert.equal(await scientificBinding(zoomed),await scientificBinding(saved));
   if(kind==='microscopy'){assert.equal(view.spatial.calibration.kind,'pixel');assert.equal(view.spatial.calibration.unit,'index');assert.ok(assets[0].provenance.rights.includes('Public domain'));}else assert.ok(assets.some(a=>a.kind==='tensor'&&a.data.values.includes(null)));
 }
});
test('source image bytes are loaded only explicitly, with streaming budgets, cancellation and digest checks',async()=>{
 const {source,plan,assets}=await createSpatialExample('microscopy'),originalFetch=globalThis.fetch;let calls=0;
 try{
   globalThis.fetch=(async()=>{calls++;return new Response(readFileSync('public/scientific-images/cdc-phil-259.jpg'),{headers:{'content-length':'47880'}});}) as typeof fetch;
   const built=buildRepresentation(plan,source,{assets});if(built.status!=='ready')throw Error(built.reason);assert.equal((await executeRepresentation(built.value,source)).status,'ready');assert.equal(calls,0);
   const loaded=await loadSpatialImage(assets[0]);assert.equal(calls,1);assert.equal(loaded.width,700);assert.equal(loaded.bundled,true);assert.equal(loaded.sha256,'821ee79de51d29f154970eef816521388caa11335c1ac6339e86e38d53839565');
   await assert.rejects(()=>loadSpatialImage(assets[0],'0'.repeat(64)),/digests disagree/);
   globalThis.fetch=(async()=>new Response(new Uint8Array(2*1024*1024+1))) as typeof fetch;await assert.rejects(()=>loadSpatialImage(assets[0]),/budget/);
   const controller=new AbortController();controller.abort();globalThis.fetch=(async()=>new Response(readFileSync('public/scientific-images/cdc-phil-259.jpg'))) as typeof fetch;await assert.rejects(()=>loadSpatialImage(assets[0],undefined,controller.signal),/cancelled/);
 }finally{globalThis.fetch=originalFetch;}
});
