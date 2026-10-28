import type { RepresentationPlan } from './representations';
import type { RepresentationNavigation, SemanticSelection } from './semantic-selections';
import { quantityValues } from './scientific-quantities';
/** Navigation freshness only. This non-cryptographic digest never grants scientific trust. */
export function representationInputRevision(plan:RepresentationPlan){
 const input={...plan,navigation:undefined,reportedChecks:undefined,views:plan.views.map(view=>view.kind==='widget'?{...view,widget:{...view.widget,view:undefined}}:view)};
 let hash=0xcbf29ce484222325n;for(const value of new TextEncoder().encode(JSON.stringify(input)))hash=BigInt.asUintN(64,(hash^BigInt(value))*0x100000001b3n);return hash.toString(16).padStart(16,'0');
}
export function isRepresentationSelection(plan:RepresentationPlan,selection:SemanticSelection):boolean{
 const view=plan.views.find(view=>view.id===selection.viewId);if(!view)return false;
 if(view.kind==='composed-scene'){
   if(selection.kind==='entity')return selection.scopeId==='composition'&&!!view.scene.entities?.some(entity=>entity.id===selection.entityId);
   const node=view.scene.nodes.find(node=>node.id===selection.scopeId);if(!node||(node.kind!=='scene'&&node.kind!=='process'))return false;
   if(selection.kind==='time'){const frames=node.kind==='process'?node.steps:node.frames;const index=frames.findIndex(frame=>frame.id===selection.frameId);return selection.mode==='authored-step'&&selection.unit==='walkthrough-step'&&(selection.frameId===null?selection.value===-1:index>=0&&selection.value===index);}
   if(selection.kind==='region')return node.kind==='scene'&&selection.frame===node.coordinates.frame&&selection.unit===node.coordinates.unit;
   return false;
 }
 if(view.kind==='quantity'&&selection.kind==='uncertainty'){
   const quantity=plan.quantities.find(q=>q.id===view.quantityId)?.measurement;
   return selection.scopeId==='quantity'&&selection.quantityId===view.quantityId&&!!quantity?.uncertainty&&quantity.uncertainty.kind===selection.mode&&selection.index<quantityValues(quantity).length;
 }
 if(view.kind==='widget'){
   if(selection.scopeId!=='widget')return false;
   // Existing selections are typed strings owned by the widget adapter; they are not global entity identities.
   if(selection.kind==='entity')return selection.entityId.length<=100;
   if(selection.kind==='time')return selection.frameId===null&&selection.mode==='authored-step'&&selection.unit==='widget-step'&&Number.isInteger(selection.value)&&selection.value>=0&&selection.value<=1000;
   if(selection.kind==='parameter'){const spec=view.widget.spec;return (spec.kind==='equation'||spec.kind==='function')?spec.variables.some(v=>v.name===selection.parameterId):spec.kind==='custom'?spec.parameters.some(p=>p.name===selection.parameterId):false;}
 }
 return false;
}
export function selectionAnchorIds(plan:RepresentationPlan,selections:readonly SemanticSelection[]){
 const ids=new Set<string>();for(const selection of selections){const view=plan.views.find(v=>v.id===selection.viewId);if(!view)continue;
   if(view.kind==='composed-scene'&&selection.kind==='entity')view.scene.entities?.find(entity=>entity.id===selection.entityId)?.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='composed-scene'&&selection.kind==='time'){const node=view.scene.nodes.find(node=>node.id===selection.scopeId);if(node?.kind==='scene'||node?.kind==='process')(node.kind==='process'?node.steps:node.frames).find(frame=>frame.id===selection.frameId)?.anchorIds?.forEach(id=>ids.add(id));}
   else if(view.kind==='widget')plan.anchors.filter(anchor=>anchor.blockId===view.widget.source.blockId).forEach(anchor=>ids.add(anchor.id));
 }
 return [...ids];
}

export function initialRepresentationNavigation(plan:RepresentationPlan):RepresentationNavigation{
 if(plan.navigation)return plan.navigation;
 const selections:SemanticSelection[]=[];
 for(const view of plan.views)if(view.kind==='widget'){
   if(view.widget.view.selection)selections.push({kind:'entity',viewId:view.id,scopeId:'widget',entityId:view.widget.view.selection});
   if(view.widget.view.step)selections.push({kind:'time',viewId:view.id,scopeId:'widget',frameId:null,value:view.widget.view.step,unit:'widget-step',mode:'authored-step'});
 }
 return {format:'paperplay-semantic-navigation',schemaVersion:1,revision:representationInputRevision(plan),selections};
}
