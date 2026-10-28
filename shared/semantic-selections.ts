import { z } from 'zod';
import { name } from './widget-primitives';
const base={viewId:name,scopeId:name};
const unit=z.string().trim().min(1).max(100);
const pair=z.tuple([z.number().finite(),z.number().finite()]);
export const semanticSelectionSchema=z.discriminatedUnion('kind',[
 z.strictObject({...base,kind:z.literal('entity'),entityId:z.string().min(1).max(100)}),
 z.strictObject({...base,kind:z.literal('time'),frameId:name.nullable(),value:z.number().finite(),unit,mode:z.enum(['authored-step','physical-time'])}),
 z.strictObject({...base,kind:z.literal('region'),frame:unit,unit,min:pair,max:pair}).refine(v=>v.min.every((value,i)=>value<=v.max[i]),'Region minima must not exceed maxima.'),
 z.strictObject({...base,kind:z.literal('parameter'),parameterId:name}),
 z.strictObject({...base,kind:z.literal('uncertainty'),quantityId:name,index:z.number().int().min(0).max(32767),mode:z.enum(['standard','interval'])}),
]);
export const representationNavigationSchema=z.strictObject({format:z.literal('paperplay-semantic-navigation'),schemaVersion:z.literal(1),revision:z.string().regex(/^[a-f0-9]{16}$/),selections:z.array(semanticSelectionSchema).max(32)});
export type SemanticSelection=z.infer<typeof semanticSelectionSchema>;
export type RepresentationNavigation=z.infer<typeof representationNavigationSchema>;
export function selectionChannel(value:SemanticSelection){return `${value.viewId}/${value.scopeId}/${value.kind}`;}
