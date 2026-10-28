import { z } from 'zod';
import { name,text } from './widget-primitives';
const finite=z.number().finite().min(-1000000).max(1000000),point=z.tuple([finite,finite]);
const paint=z.enum(['ink','muted','accent','positive','warning']);
const markBase={id:name,label:text.max(300),anchorId:name.optional(),entityId:name.optional()};
export const sdkFrameSchema=z.strictObject({format:z.literal('paperplay-sdk-frame'),schemaVersion:z.literal(1),title:text.max(200),description:text.max(1000),coordinateSpace:z.strictObject({width:z.number().positive().max(2048),height:z.number().positive().max(2048)}),marks:z.array(z.discriminatedUnion('kind',[
 z.strictObject({...markBase,kind:z.literal('circle'),center:point,radius:z.number().positive().max(2048),paint}),
 z.strictObject({...markBase,kind:z.literal('line'),from:point,to:point,paint}),
 z.strictObject({...markBase,kind:z.literal('rectangle'),at:point,size:z.tuple([z.number().positive().max(2048),z.number().positive().max(2048)]),paint}),
 z.strictObject({...markBase,kind:z.literal('text'),at:point,text:text.max(300)}),
 ])).max(512),controls:z.array(z.discriminatedUnion('kind',[
 z.strictObject({id:name,kind:z.literal('button'),label:text.max(100),disabled:z.boolean()}),
 z.strictObject({id:name,kind:z.literal('slider'),label:text.max(100),min:finite,max:finite,step:z.number().positive().max(1000000),value:finite}),
 ])).max(16),table:z.strictObject({caption:text.max(400),columns:z.array(text.max(100)).min(1).max(8),rows:z.array(z.array(z.union([z.number().finite(),text.max(300),z.boolean(),z.null()])).max(8)).max(512)}),state:z.unknown()});
export const sdkEventSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('initialize')}),
 z.strictObject({kind:z.literal('control'),id:name,value:finite.optional()}),
 z.strictObject({kind:z.literal('entity'),id:name}),
]);
export type SdkFrame=z.infer<typeof sdkFrameSchema>;
export type SdkEvent=z.infer<typeof sdkEventSchema>;
export type SdkUpdate=(input:unknown,state:unknown,event:SdkEvent)=>SdkFrame;
export function validateSdkFrame(input:unknown,limits:{maxOutputBytes:number;maxStateBytes:number;maxMarks:number;maxControls:number},anchors:readonly string[],capabilities:readonly string[]):SdkFrame{
 const json=JSON.stringify(input);if(new TextEncoder().encode(json).length>limits.maxOutputBytes)throw Error('SDK output exceeds its byte budget.');const frame=sdkFrameSchema.parse(input);
 if(new TextEncoder().encode(JSON.stringify(frame.state)).length>limits.maxStateBytes||frame.marks.length>limits.maxMarks||frame.controls.length>limits.maxControls)throw Error('SDK frame exceeds declared state/mark/control budgets.');
 for(const ids of [frame.marks.map(m=>m.id),frame.controls.map(c=>c.id)])if(new Set(ids).size!==ids.length)throw Error('Duplicate SDK mark/control.');
 if(frame.marks.length&&!capabilities.includes('draw-2d')||frame.controls.length&&!capabilities.includes('controls'))throw Error('SDK frame requests an undeclared drawing/control capability.');
 for(const mark of frame.marks){if(mark.anchorId&&(!capabilities.includes('source-return')||!anchors.includes(mark.anchorId)))throw Error('SDK mark source is undeclared.');if(mark.entityId&&!capabilities.includes('entity-selection'))throw Error('SDK entity interaction is undeclared.');}
 const inside=(point:readonly number[])=>point[0]>=0&&point[1]>=0&&point[0]<=frame.coordinateSpace.width&&point[1]<=frame.coordinateSpace.height;
 for(const mark of frame.marks){const bounds=mark.kind==='circle'?[[mark.center[0]-mark.radius,mark.center[1]-mark.radius],[mark.center[0]+mark.radius,mark.center[1]+mark.radius]]:mark.kind==='line'?[mark.from,mark.to]:mark.kind==='rectangle'?[mark.at,[mark.at[0]+mark.size[0],mark.at[1]+mark.size[1]]]:[mark.at];if(bounds.some(point=>!inside(point)))throw Error('SDK marks must fit their declared drawing area; reserve space for padding.');}
 for(const control of frame.controls)if(control.kind==='slider'&&(control.min>=control.max||control.value<control.min||control.value>control.max))throw Error('SDK slider is outside its declared domain.');
 if(frame.table.rows.some(row=>row.length!==frame.table.columns.length))throw Error('SDK table rows must match columns.');
 return frame;
}
/** SDK values are plain JSON. There are no DOM, HTML, URL, network or inference handles. */
export const FIGURE_SDK_VERSION='1.0.0' as const;
