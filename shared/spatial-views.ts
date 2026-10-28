import { z } from 'zod';
import { name,text } from './widget-primitives';
import { unitIdSchema,temperatureModeSchema,scientificUnits } from './scientific-quantities';
const coordinate=z.number().finite();
const axis=z.strictObject({origin:coordinate,spacing:z.number().finite().positive(),direction:z.union([z.literal(1),z.literal(-1)])});
export const spatialCalibrationSchema=z.strictObject({frame:name,kind:z.enum(['pixel','declared']),unit:unitIdSchema,x:axis,y:axis,anchorIds:z.array(name).min(1).max(8),interpretation:text.max(600)});
const bounds=z.tuple([coordinate,coordinate,coordinate,coordinate]);
const overlayBase={id:name,label:text.max(200),origin:z.enum(['authored-annotation','source-extracted','generated-overlay']),anchorIds:z.array(name).min(1).max(8),interpretation:text.max(600),opacity:z.number().min(.05).max(.8)};
export const spatialViewSchema=z.strictObject({id:name,title:text.max(200),anchorIds:z.array(name).min(1).max(8),input:z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('image'),assetId:name,expectedImageSha256:z.string().regex(/^[a-f0-9]{64}$/).optional()}),
 z.strictObject({kind:z.literal('field'),assetId:name,valueUnit:unitIdSchema,temperatureMode:temperatureModeSchema.optional()}),
 ]),calibration:spatialCalibrationSchema,
 overlays:z.array(z.discriminatedUnion('kind',[
 z.strictObject({...overlayBase,kind:z.literal('rectangle'),bounds}),
 z.strictObject({...overlayBase,kind:z.literal('mask'),assetId:name}),
 ])).max(8),
 viewport:z.strictObject({zoom:z.number().min(.05).max(8),panX:z.number().finite().min(0).max(16384),panY:z.number().finite().min(0).max(16384),palette:z.enum(['grayscale','blue-gold']),visibleOverlayIds:z.array(name).max(8)}).optional(),
});
export type SpatialView=z.infer<typeof spatialViewSchema>;
export type SpatialCalibration=z.infer<typeof spatialCalibrationSchema>;
export function validateSpatialView(input:unknown,anchorIds?:readonly string[]):SpatialView{
 const view=spatialViewSchema.parse(input),unit=scientificUnits[view.calibration.unit];
 if(unit.semantic!=='index'&&JSON.stringify(unit.dimensions)!==JSON.stringify([1,0,0,0,0,0,0]))throw Error('Spatial calibration needs length units or an explicit pixel/index frame.');
 if(view.calibration.kind==='pixel'&&(view.calibration.unit!=='index'||[view.calibration.x,view.calibration.y].some(axis=>axis.origin!==0||axis.spacing!==1||axis.direction!==1)))throw Error('Pixel coordinates use zero-based pixel centers, unit spacing and increasing x/y.');
 if(new Set(view.overlays.map(layer=>layer.id)).size!==view.overlays.length)throw Error('Duplicate spatial overlay.');
 for(const layer of view.overlays)if(layer.kind==='rectangle'&&(layer.bounds[0]>layer.bounds[2]||layer.bounds[1]>layer.bounds[3]))throw Error('Overlay pixel bounds must increase.');
 if(view.viewport&&(new Set(view.viewport.visibleOverlayIds).size!==view.viewport.visibleOverlayIds.length||view.viewport.visibleOverlayIds.some(id=>!view.overlays.some(layer=>layer.id===id))))throw Error('Visible overlays must refer to distinct declared layers.');
 const anchors=[...view.anchorIds,...view.calibration.anchorIds,...view.overlays.flatMap(layer=>layer.anchorIds)];if(anchorIds&&anchors.some(id=>!anchorIds.includes(id)))throw Error('Spatial source/calibration/overlay anchors must be declared.');
 return view;
}
