import type { ProcessNetwork } from '../../shared/process-networks';
import type { ScientificScene } from '../../shared/composed-scene';
/** Deterministic illustrative layout; compartments are declared groups, never inferred physical geometry. */
export function processScene(network:ProcessNetwork):ScientificScene{
 const groups=[...network.compartments.map(c=>({id:c.id,label:c.label})),...(network.entities.some(e=>e.compartmentId===null)?[{id:null,label:'Ungrouped entities'}]:[])];
 const marks:ScientificScene['marks']=[];const ids=new Map<string,string>();
 groups.forEach((group,groupIndex)=>{
   const members=network.entities.filter(entity=>entity.compartmentId===group.id);if(!members.length)return;
   const x=groupIndex*4,y=Math.max(0,members.length-1)*1.5;
   marks.push({id:`group${groupIndex}`,kind:'box',role:'group-boundary',label:`Compartment: ${group.label}`,x,y,width:3,height:Math.max(2,members.length*3),color:'ink'});
   members.forEach((entity,index)=>{const id=`entity${network.entities.indexOf(entity)}`;ids.set(entity.id,id);marks.push({id,entityId:entity.id,kind:'point',label:entity.label,x,y:index*3,color:'blue'});});
 });
 const entities=marks.filter(mark=>mark.kind==='point');
 return {id:network.id,kind:'scene',title:network.title,description:network.description,coordinates:{frame:'conceptual process layout; not physical geometry',xAxis:'Compartment placement',yAxis:'Entity placement',unit:'illustrative layout units'},marks,
   relationships:network.relationships.map((relation,index)=>({id:`relation${index}`,from:ids.get(relation.from)!,to:ids.get(relation.to)!,label:`${relation.meaning}: ${relation.label}`})),
   frames:network.steps.map(step=>({id:step.id,label:step.title,explanation:step.explanation,anchorIds:step.anchorIds,activeRelationshipIds:step.activeRelationshipIds.map(id=>`relation${network.relationships.findIndex(r=>r.id===id)}`),changes:entities.map(mark=>({markId:mark.id,x:mark.x,y:mark.y,active:step.activeEntityIds.includes(mark.entityId!)}))})),
 };
}
