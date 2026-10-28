import { hasCheckedAssetIntegrity } from '../assets/local';
import type { ScientificAsset } from '../../shared/scientific-assets';
import { scientificUnits } from '../../shared/scientific-quantities';
import { validateSpatialView,type SpatialView,type SpatialCalibration } from '../../shared/spatial-views';
import { coordinateAt } from '../../shared/spatial-coordinates';
import type { RasterSize,PixelBounds } from '../../shared/spatial-coordinates';
export { coordinateAt,regionFromPixels,pixelsFromRegion } from '../../shared/spatial-coordinates';
export type { RasterSize,PixelBounds } from '../../shared/spatial-coordinates';
export const MAX_SPATIAL_PIXELS=1024*1024,MAX_REGION_SAMPLES=16384;
export function spatialAssets(view:SpatialView){return [view.input.assetId,...view.overlays.flatMap(layer=>layer.kind==='mask'?[layer.assetId]:[])];}
export function validateRasterSize(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048||width*height>MAX_SPATIAL_PIXELS)throw Error('Spatial preview supports at most 2048 pixels per side and one million pixels. Open the original for a larger image.');return {width,height};}
export function validateSpatialGeometry(view:SpatialView,size:RasterSize,assets:readonly ScientificAsset[]){
 validateRasterSize(size.width,size.height);
 for(const [axis,count]of [[view.calibration.x,size.width],[view.calibration.y,size.height]] as const){const first=coordinateAt(0,axis),next=coordinateAt(1,axis),last=coordinateAt(count-1,axis);if(!Number.isFinite(first)||!Number.isFinite(last)||!Number.isFinite(last-first)||next===first)throw Error('Spatial coordinates lose numeric precision; use explicitly rescaled coordinates.');}
 for(const overlay of view.overlays){if(overlay.kind==='rectangle'){const [left,top,right,bottom]=overlay.bounds;if(left<0||top<0||right>=size.width||bottom>=size.height)throw Error('An overlay lies outside the original pixel/grid coordinates.');}else{const asset=assets.find(asset=>asset.id===overlay.assetId);if(!asset||asset.kind!=='tensor'||JSON.stringify(asset.shape)!==JSON.stringify([size.height,size.width])||asset.data.values.some(value=>value!==null&&value!==0&&value!==1))throw Error('A declared mask requires a matching binary/null tensor; no segmentation is inferred.');}}
}
export function preflightSpatialView(input:unknown,assets:readonly ScientificAsset[]){
 const view=validateSpatialView(input);for(const id of spatialAssets(view)){const asset=assets.find(asset=>asset.id===id);if(!asset||!hasCheckedAssetIntegrity(asset))throw Error(`Spatial view requires checked asset ${id}.`);}
 const asset=assets.find(asset=>asset.id===view.input.assetId)!;
 if(view.input.kind==='image'){if(asset.kind!=='image')throw Error('An image view requires an original image-reference asset.');if(asset.shape.length)validateSpatialGeometry(view,{width:asset.shape[1],height:asset.shape[0]},assets);return {view,asset,size:null};}
 if(asset.kind!=='tensor'||asset.shape.length!==2)throw Error('A scalar field requires a two-dimensional checked tensor.');
 const size=validateRasterSize(asset.shape[1],asset.shape[0]);validateSpatialGeometry(view,size,assets);
 const finiteValues=asset.data.values.filter((value):value is number=>value!==null);if(finiteValues.length&&!Number.isFinite(Math.max(...finiteValues)-Math.min(...finiteValues)))throw Error('Field range needs explicit numeric rescaling before color mapping.');
 const unit=scientificUnits[view.input.valueUnit],temperature=unit.dimensions[4]===1;
 if(temperature&&!view.input.temperatureMode||!temperature&&view.input.temperatureMode)throw Error('Field temperatures require an explicit absolute/difference convention.');
 if(view.input.temperatureMode==='absolute'&&asset.data.values.some(value=>value!==null&&value*unit.scale+unit.offset<0))throw Error('Field absolute temperature is below zero kelvin.');
 if(asset.coordinates.axes.length&&asset.coordinates.axes.some((axis,index)=>axis.direction!=='unspecified'&&axis.direction!==([view.calibration.y,view.calibration.x][index].direction===1?'increasing':'decreasing')))throw Error('Field axis directions must retain the declared source orientation.');
 if(asset.coordinates.axes.length&&asset.coordinates.axes.some(axis=>axis.unit!==view.calibration.unit))throw Error('Field axis units must match the declared calibration; convert them explicitly first.');
 return {view,asset,size};
}
export function pixelPoint(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number},size:RasterSize){if(rect.width<=0||rect.height<=0)throw Error('The raster is not laid out.');return {column:Math.max(0,Math.min(size.width-1,Math.floor((clientX-rect.left)/rect.width*size.width))),row:Math.max(0,Math.min(size.height-1,Math.floor((clientY-rect.top)/rect.height*size.height)))};}
export function regionSummary(bounds:PixelBounds,size:RasterSize,values:readonly (number|null)[]|Uint8ClampedArray,kind:'field'|'image'){
 if(Object.values(bounds).some(value=>!Number.isInteger(value))||bounds.left<0||bounds.top<0||bounds.right>=size.width||bounds.bottom>=size.height||bounds.left>bounds.right||bounds.top>bounds.bottom)throw Error('Select an inclusive integer region inside the original raster.');
 const pixels=(bounds.right-bounds.left+1)*(bounds.bottom-bounds.top+1);if(pixels>MAX_REGION_SAMPLES)return {pixels,sampled:0,missing:null,mean:null,min:null,max:null,rgb:null,limited:true};
 let count=0,missing=0,mean=0,min=Infinity,max=-Infinity;const rgb=[0,0,0];
 for(let row=bounds.top;row<=bounds.bottom;row++)for(let column=bounds.left;column<=bounds.right;column++){
   const index=row*size.width+column;
   if(kind==='image'){if(values[index*4+3]===0){missing++;continue;}rgb.forEach((_,channel)=>{rgb[channel]+=values[index*4+channel]!;});count++;}
   else{const value=values[index];if(value===null){missing++;continue;}if(value===undefined||!Number.isFinite(value))throw Error('Unavailable field sample.');count++;mean+=(value-mean)/count;min=Math.min(min,value);max=Math.max(max,value);}
 }
 if(!Number.isFinite(mean)||rgb.some(value=>!Number.isFinite(value)))throw Error('Region arithmetic exceeded finite bounds.');
 return {pixels,sampled:count,missing,mean:kind==='field'&&count?mean:null,min:kind==='field'&&count?min:null,max:kind==='field'&&count?max:null,rgb:kind==='image'&&count?rgb.map(value=>value/count):null,limited:false};
}
export function scaleBar(calibration:SpatialCalibration,visiblePixels:number){const target=Math.max(1,visiblePixels/4)*calibration.x.spacing,power=10**Math.floor(Math.log10(target))||Number.MIN_VALUE;const length=[1,2,5].map(n=>n*power).filter(n=>n<=target).at(-1)??power;return {length,pixels:length/calibration.x.spacing,unit:calibration.unit==='index'?(calibration.kind==='pixel'?'pixels':'index units'):scientificUnits[calibration.unit].symbol,declared:calibration.kind==='declared'};}
