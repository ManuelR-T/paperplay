import { z } from 'zod';
import { name,text } from './widget-primitives';
const refs=z.array(name).max(16);
export const reasoningStepSchema=z.strictObject({
 id:name,title:text.max(160),kind:z.enum(['definition','assumption','equation','inference','procedure','observation','gap']),
 sourceLocator:text.max(400),origin:z.enum(['source-quotation','source-summary','authored-explanation','missing-detail']),text,
 anchorIds:z.array(name).min(1).max(8),dependsOn:refs,assumptions:z.array(text.max(500)).max(8),missingDetails:z.array(text.max(500)).max(8),
 equation:z.strictObject({latex:z.string().min(1).max(2000),plainText:text,notation:z.enum(['transcribed','uncertain','unsupported'])}).optional(),
});
export const reasoningGuideSchema=z.strictObject({id:name,title:text.max(200),kind:z.enum(['argument','derivation','protocol']),anchorIds:z.array(name).min(1).max(8),scope:text.max(1000),steps:z.array(reasoningStepSchema).min(1).max(48)});
export type ReasoningGuide=z.infer<typeof reasoningGuideSchema>;
export type ReasoningStep=z.infer<typeof reasoningStepSchema>;
export function validateReasoningGuide(input:unknown,anchors?:readonly {id:string;quote:string}[]):ReasoningGuide{
 const guide=reasoningGuideSchema.parse(input),steps=new Map(guide.steps.map(step=>[step.id,step]));
 if(steps.size!==guide.steps.length)throw Error('Duplicate reasoning step.');
 const normalized=(s:string)=>s.replace(/\s+/g,' ').trim();
 for(const step of guide.steps){
   if(new Set(step.anchorIds).size!==step.anchorIds.length||new Set(step.dependsOn).size!==step.dependsOn.length)throw Error('Duplicate reasoning source/dependency.');
   if(step.dependsOn.some(id=>!steps.has(id)))throw Error('Missing reasoning dependency.');
   if(step.origin==='authored-explanation'&&!step.assumptions.length)throw Error('Authored reasoning requires explicit added assumptions.');
   if((step.origin==='missing-detail'||step.kind==='gap')&&!step.missingDetails.length)throw Error('A protocol/reasoning gap needs explicit missing details.');
   if(step.kind==='gap'&&step.origin!=='missing-detail')throw Error('A gap cannot be labeled source-reported or verified.');
   if(step.equation&&step.kind!=='equation')throw Error('Only an equation step carries mathematical notation.');
   if(step.equation?.notation!=='transcribed'&&step.equation&&!step.missingDetails.length)throw Error('Uncertain or unsupported notation must keep its missing details visible.');
   if(anchors&&step.origin==='source-quotation'&&!step.anchorIds.some(id=>normalized(anchors.find(anchor=>anchor.id===id)?.quote??'').includes(normalized(step.text))))throw Error('A source-quotation step must quote its declared source.');
 }
 const visiting=new Set<string>(),visited=new Set<string>();
 function visit(id:string){if(visiting.has(id))throw Error('Reasoning dependencies contain a cycle.');if(visited.has(id))return;visiting.add(id);steps.get(id)!.dependsOn.forEach(visit);visiting.delete(id);visited.add(id);}
 guide.steps.forEach(step=>visit(step.id));
 if(anchors&&[...guide.anchorIds,...guide.steps.flatMap(step=>step.anchorIds)].some(id=>!anchors.some(anchor=>anchor.id===id)))throw Error('A reasoning guide refers to an undeclared source.');
 return guide;
}
