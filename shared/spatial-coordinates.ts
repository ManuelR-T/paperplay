import type { SpatialCalibration } from './spatial-views';
import type { SemanticSelection } from './semantic-selections';
export type RasterSize={width:number;height:number};
export type PixelBounds={left:number;top:number;right:number;bottom:number};
export function coordinateAt(index:number,axis:SpatialCalibration['x']){return axis.origin+index*axis.spacing*axis.direction;}
export function regionFromPixels(viewId:string,bounds:PixelBounds,calibration:SpatialCalibration):Extract<SemanticSelection,{kind:'region'}>{if(Object.values(bounds).some(value=>!Number.isInteger(value)||value<0)||bounds.left>bounds.right||bounds.top>bounds.bottom)throw Error('Use increasing inclusive integer pixel bounds.');const x=[coordinateAt(bounds.left,calibration.x),coordinateAt(bounds.right,calibration.x)],y=[coordinateAt(bounds.top,calibration.y),coordinateAt(bounds.bottom,calibration.y)];return {kind:'region',viewId,scopeId:'spatial',frame:calibration.frame,unit:calibration.unit,min:[Math.min(...x),Math.min(...y)],max:[Math.max(...x),Math.max(...y)]};}
export function pixelsFromRegion(region:Extract<SemanticSelection,{kind:'region'}>,calibration:SpatialCalibration,size:RasterSize):PixelBounds{
 if(region.frame!==calibration.frame||region.unit!==calibration.unit)throw Error('Region frame/unit differs from the spatial view.');
 const indices=(axis:SpatialCalibration['x'],min:number,max:number)=>[(min-axis.origin)/(axis.spacing*axis.direction),(max-axis.origin)/(axis.spacing*axis.direction)].sort((a,b)=>a-b);
 const x=indices(calibration.x,region.min[0],region.max[0]),y=indices(calibration.y,region.min[1],region.max[1]);
 if(x[0]<-1e-8||y[0]<-1e-8||x[1]>size.width-1+1e-8||y[1]>size.height-1+1e-8)throw Error('Region lies outside the original raster.');
 const bounds={left:Math.max(0,Math.ceil(x[0]-1e-8)),right:Math.floor(x[1]+1e-8),top:Math.max(0,Math.ceil(y[0]-1e-8)),bottom:Math.floor(y[1]+1e-8)};
 if(bounds.left<0||bounds.top<0||bounds.right>=size.width||bounds.bottom>=size.height||bounds.left>bounds.right||bounds.top>bounds.bottom)throw Error('Region has no valid pixel/grid centers inside this raster.');return bounds;
}
