import { z } from 'zod';
import { name } from './widget-primitives';
const label=z.string().trim().min(1).max(400);
const coordinate=z.number().finite().min(-1e6).max(1e6);
export const sceneColorSchema=z.enum(['ink','blue','green','amber','red','purple']);
const point=z.strictObject({id:name,entityId:name.optional(),label,x:coordinate,y:coordinate,value:z.number().finite().optional(),unit:label.optional()});
const mark=z.discriminatedUnion('kind',[
 point.extend({kind:z.literal('point'),color:sceneColorSchema}),
 point.extend({kind:z.literal('box'),color:sceneColorSchema,width:z.number().positive().max(1e5),height:z.number().positive().max(1e5)}),
 z.strictObject({id:name,kind:z.literal('repeat'),label,color:sceneColorSchema,items:z.array(point).min(1).max(64)}),
]);
const nodeBase={id:name};
const children=z.array(name).min(1).max(16);
const sceneNode=z.strictObject({...nodeBase,kind:z.literal('scene'),title:label,description:label,coordinates:z.strictObject({frame:label,xAxis:label,yAxis:label,unit:label}),marks:z.array(mark).min(1).max(64),relationships:z.array(z.strictObject({id:name,from:name,to:name,label})).max(64),frames:z.array(z.strictObject({id:name,label,anchorIds:z.array(name).max(8).optional(),changes:z.array(z.strictObject({markId:name,x:coordinate,y:coordinate,visible:z.boolean().optional()})).max(128)})).max(24)});
export const composedNodeSchema=z.discriminatedUnion('kind',[
 z.strictObject({...nodeBase,kind:z.literal('panel'),title:label,children}),
 z.strictObject({...nodeBase,kind:z.literal('row'),children}),
 z.strictObject({...nodeBase,kind:z.literal('grid'),columns:z.number().int().min(1).max(4),children}),
 z.strictObject({...nodeBase,kind:z.literal('text'),text:label}),
 z.strictObject({...nodeBase,kind:z.literal('annotation'),entityIds:z.array(name).max(32).optional(),text:z.string().trim().min(1).max(1000),anchorIds:z.array(name).min(1).max(8),role:z.enum(['source','added-assumption'])}),
 z.strictObject({...nodeBase,kind:z.literal('legend'),items:z.array(z.strictObject({label,color:sceneColorSchema})).min(1).max(16)}),
 z.strictObject({...nodeBase,kind:z.literal('slot'),slot:z.enum(['chart','equation','data']),title:label,description:label,values:z.array(z.strictObject({label,entityId:name.optional(),value:z.number().finite(),unit:label})).max(32)}),
 sceneNode,
]);
export const composedSceneSchema=z.strictObject({format:z.literal('paperplay-composed-scene'),schemaVersion:z.literal(1),entities:z.array(z.strictObject({id:name,label,anchorIds:z.array(name).min(1).max(8)})).max(128).optional(),rootId:name,nodes:z.array(composedNodeSchema).min(1).max(80)});
export type ComposedScene=z.infer<typeof composedSceneSchema>;
export type ComposedNode=ComposedScene['nodes'][number];
export type ScientificScene=Extract<ComposedNode,{kind:'scene'}>;
export type SceneMark={id:string;entityId?:string;label:string;x:number;y:number;value?:number;unit?:string;color:z.infer<typeof sceneColorSchema>;width?:number;height?:number;visible:boolean};
export function sceneMarks(scene:ScientificScene):SceneMark[]{return scene.marks.flatMap(mark=>mark.kind==='repeat'?mark.items.map(item=>({...item,color:mark.color,visible:true})): [{...mark,visible:true}]);}
export function validateComposedScene(input:unknown,anchorIds?:readonly string[]):ComposedScene{
 const scene=composedSceneSchema.parse(input),nodes=new Map(scene.nodes.map(node=>[node.id,node]));
 if(nodes.size!==scene.nodes.length)throw Error('Duplicate layout node ID.');
 const entities=new Map(scene.entities?.map(entity=>[entity.id,entity])??[]);
 if(entities.size!==(scene.entities?.length??0))throw Error('Duplicate semantic entity.');
 const checkAnchors=(ids:readonly string[])=>{if(anchorIds&&ids.some(id=>!anchorIds.includes(id)))throw Error('A semantic link requires declared source anchors.');};
 const checkEntities=(ids:readonly string[])=>{if(ids.some(id=>!entities.has(id)))throw Error('A semantic link requires a declared entity.');};
 for(const entity of entities.values())checkAnchors(entity.anchorIds);
 const seen=new Set<string>(),active=new Set<string>();let totalMarks=0,totalChanges=0;
 function visit(id:string,depth:number){
   if(depth>5)throw Error('Layout nesting exceeds five levels.');
   if(active.has(id)||seen.has(id))throw Error('Layout must be a tree without cycles or reused nodes.');
   const node=nodes.get(id);if(!node)throw Error('Layout refers to a missing node.');seen.add(id);active.add(id);
   if('children'in node)node.children.forEach(child=>visit(child,depth+1));
   if(node.kind==='annotation'&&anchorIds&&node.anchorIds.some(id=>!anchorIds.includes(id)))throw Error('An annotation requires declared source anchors.');
   if(node.kind==='annotation')checkEntities(node.entityIds??[]);
   if(node.kind==='slot')checkEntities(node.values.flatMap(value=>value.entityId?[value.entityId]:[]));
   if(node.kind==='scene'){
     const marks=sceneMarks(node),ids=new Set(marks.map(m=>m.id));totalMarks+=marks.length;checkEntities(marks.flatMap(mark=>mark.entityId?[mark.entityId]:[]));
     if(ids.size!==marks.length||marks.length>128)throw Error('Scene marks need unique IDs and at most 128 expanded marks.');
     if(new Set(node.relationships.map(r=>r.id)).size!==node.relationships.length||node.relationships.some(r=>!ids.has(r.from)||!ids.has(r.to)))throw Error('Scene relationships need unique IDs and existing endpoints.');
     if(new Set(node.frames.map(f=>f.id)).size!==node.frames.length)throw Error('Duplicate scene frame.');
     for(const frame of node.frames){checkAnchors(frame.anchorIds??[]);totalChanges+=frame.changes.length;if(new Set(frame.changes.map(c=>c.markId)).size!==frame.changes.length||frame.changes.some(c=>!ids.has(c.markId)))throw Error('Frames must update existing mark IDs once per frame.');}
   }
   active.delete(id);
 }
 visit(scene.rootId,1);
 if(seen.size!==nodes.size)throw Error('Layout contains unreachable nodes.');
 if(totalMarks>256||totalChanges>3072)throw Error('Composed figure exceeds expanded mark/frame budgets.');
 return scene;
}
