import { z } from 'zod';
import { name, text } from './widget-primitives';
export const capabilityReferenceSchema=z.strictObject({id:name,version:z.string().regex(/^\d+\.\d+\.\d+$/)});
export const representationKindSchema=z.enum(['widget','source-guide','asset','quantity','composed-scene','statistical-chart','spatial-view']);
export type RepresentationKind=z.infer<typeof representationKindSchema>;
export const defaultViewCapabilities={widget:{id:'widget-v2',version:'2.1.0'},'source-guide':{id:'source-guide',version:'1.0.0'},asset:{id:'asset-inspector',version:'1.0.0'},quantity:{id:'quantity-inspector',version:'1.0.0'},'composed-scene':{id:'composed-scene',version:'1.0.0'},'statistical-chart':{id:'statistical-chart',version:'1.0.0'},'spatial-view':{id:'spatial-field',version:'1.0.0'}} as const;
export function viewCapability(view:{kind:RepresentationKind;adapter?:z.infer<typeof capabilityReferenceSchema>;spatial?:{input:{kind:string}}}){return view.adapter??(view.kind==='spatial-view'&&view.spatial?.input.kind==='image'?{id:'spatial-image',version:'1.0.0'}:defaultViewCapabilities[view.kind]);}
export const representationInteractionSchema=z.enum(['widget-controls','select-step','return-source','inspect-data','select-entity','select-region']);
export const facilitySchema=z.enum(['trusted-computation','asset-integrity','webgl','network']);
export const capabilityDescriptorSchema=z.strictObject({
 id:name,version:z.string().regex(/^\d+\.\d+\.\d+$/),label:text.max(160),viewKinds:z.array(representationKindSchema).min(1).max(7),
 roles:z.array(z.enum(['view','data','execution'])).min(1).max(3),behaviors:z.array(name).min(1).max(32),
 assetKinds:z.array(z.enum(['table','tensor','image','sequence','graph','geometry'])).max(6),
 interactions:z.array(representationInteractionSchema).max(6),
 facilities:z.array(facilitySchema).max(4),optionalFacilities:z.array(facilitySchema).max(4).optional(),permissions:z.strictObject({network:z.boolean(),generatedCode:z.literal(false)}),
 limits:z.strictObject({maxInputBytes:z.number().int().positive().max(2*1024*1024),maxOutputBytes:z.number().int().positive().max(3*1024*1024),maxExecutionMs:z.number().int().positive().max(30000)}),
 evidencePolicy:z.literal('no-automatic-verification'),description:text.max(1000),
});
export type CapabilityDescriptor=z.infer<typeof capabilityDescriptorSchema>;
export const capabilityNeedSchema=z.strictObject({behaviors:z.array(name).max(32),assetKinds:z.array(z.enum(['table','tensor','image','sequence','graph','geometry'])).max(6),interactions:z.array(representationInteractionSchema).max(6),inputBytes:z.number().int().nonnegative().max(2*1024*1024),requestedEvidence:z.enum(['illustration','mechanism-reproduction','experiment-reproduction'])});
export type CapabilityNeed=z.infer<typeof capabilityNeedSchema>;
export type CapabilityGap={kind:'capability'|'environment'|'resource'|'evidence';requirement:string;reason:string;nextAction:string};
export type CapabilityEnvironment={facilities:readonly z.infer<typeof facilitySchema>[];offline:boolean;maxInputBytes?:number};

export const capabilityEnvironmentSchema=z.strictObject({facilities:z.array(facilitySchema).max(4),offline:z.boolean(),maxInputBytes:z.number().int().nonnegative().max(2*1024*1024).optional()});
