import { z } from 'zod';
import { name, text } from './widget-primitives';
const refs=z.array(name).min(1).max(8);
const support=z.strictObject({origin:z.enum(['source-reported','authored-assumption']),anchorIds:refs,conditions:z.array(text.max(400)).min(1).max(8)});
export const processNetworkSchema=z.strictObject({
 id:name,kind:z.literal('process'),mode:z.enum(['network','state-machine']),title:text.max(200),description:text.max(1000),
 compartments:z.array(z.strictObject({id:name,label:text.max(200),description:text.max(400)})).max(12),
 entities:z.array(z.strictObject({id:name,label:text.max(200),compartmentId:name.nullable()})).min(1).max(64),
 relationships:z.array(z.strictObject({id:name,from:name,to:name,label:text.max(300),meaning:z.enum(['association','flow','causal','reaction','transition']),support,guard:text.max(400).optional(),rate:z.strictObject({kind:z.literal('first-order'),value:z.number().finite().nonnegative().max(1e12),unit:z.literal('Hz'),support}).optional()})).max(64),
 steps:z.array(z.strictObject({id:name,title:text.max(200),explanation:text.max(1000),origin:z.literal('authored-walkthrough'),anchorIds:refs,activeEntityIds:z.array(name).max(64),activeRelationshipIds:z.array(name).max(64)})).max(24),
});
export type ProcessNetwork=z.infer<typeof processNetworkSchema>;
export function validateProcessNetwork(input:unknown,anchorIds?:readonly string[]):ProcessNetwork{
 const network=processNetworkSchema.parse(input);
 function unique(ids:string[],label:string){if(new Set(ids).size!==ids.length)throw Error(`Duplicate process ${label}.`);}
 unique(network.entities.map(e=>e.id),'entity');unique(network.compartments.map(c=>c.id),'compartment');unique(network.relationships.map(r=>r.id),'relationship');unique(network.steps.map(s=>s.id),'step');
 const entities=new Set(network.entities.map(e=>e.id)),compartments=new Set(network.compartments.map(c=>c.id)),relationships=new Set(network.relationships.map(r=>r.id));
 const anchors=(ids:string[])=>{unique(ids,'anchor');if(anchorIds&&ids.some(id=>!anchorIds.includes(id)))throw Error('A process declaration refers to an unavailable source anchor.');};
 for(const entity of network.entities)if(entity.compartmentId&&!compartments.has(entity.compartmentId))throw Error('Unknown process compartment.');
 for(const relation of network.relationships){
   if(!entities.has(relation.from)||!entities.has(relation.to))throw Error('A process relationship requires existing endpoints.');
   anchors(relation.support.anchorIds);if(relation.rate)anchors(relation.rate.support.anchorIds);
   if(network.mode==='state-machine'&&relation.meaning!=='transition')throw Error('A state machine relationship must declare transition meaning.');
 }
 for(const step of network.steps){
   anchors(step.anchorIds);unique(step.activeEntityIds,'active entity');unique(step.activeRelationshipIds,'active relationship');
   if(step.activeEntityIds.some(id=>!entities.has(id))||step.activeRelationshipIds.some(id=>!relationships.has(id)))throw Error('A process step refers to an unknown entity or relationship.');
   if(network.mode==='state-machine'&&step.activeEntityIds.length>1)throw Error('This state-machine walkthrough declares at most one active state per step.');
 }
 return network;
}
