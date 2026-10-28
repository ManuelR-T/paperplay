import { activeMolecularAtoms,validateMolecularGeometry } from './molecular-geometry';
import type { ScientificAsset } from './scientific-assets';
import { fieldGridGeometry } from './physical-fields';
import { convertValue } from '../lib/quantities/convert';
import { pixelsFromRegion } from './spatial-coordinates';
import type { RepresentationPlan } from './representations';
import type { RepresentationNavigation, SemanticSelection } from './semantic-selections';
import { quantityValues } from './scientific-quantities';
/** Navigation freshness only. This non-cryptographic digest never grants scientific trust. */
export function representationInputRevision(plan:RepresentationPlan){
 const input={...plan,navigation:undefined,reportedChecks:undefined,views:plan.views.map(view=>view.kind==='molecular-view'?{...view,molecule:{...view.molecule,settings:undefined}}:view.kind==='spatial-view'?{...view,spatial:{...view.spatial,viewport:undefined}}:view.kind==='widget'?{...view,widget:{...view.widget,view:undefined}}:view)};
 let hash=0xcbf29ce484222325n;for(const value of new TextEncoder().encode(JSON.stringify(input)))hash=BigInt.asUintN(64,(hash^BigInt(value))*0x100000001b3n);return hash.toString(16).padStart(16,'0');
}
export function isRepresentationSelection(plan:RepresentationPlan,selection:SemanticSelection,resolvedAssets?:readonly ScientificAsset[]):boolean{
 const view=plan.views.find(view=>view.id===selection.viewId);if(!view)return false;
 if(view.kind==='molecular-view'){
   if(selection.kind!=='entity'||selection.scopeId!=='molecular')return false;
   const asset=resolvedAssets?.find(asset=>asset.id===view.molecule.assetId)??plan.assetManifests?.find(asset=>asset.id===view.molecule.assetId);
   if(!asset)return /^(atom|residue)-[a-f0-9]{64}-[A-Za-z0-9_-]{1,24}$/.test(selection.entityId);
   try{const atoms=activeMolecularAtoms(validateMolecularGeometry(asset),view.molecule);return atoms.some(atom=>atom.id===selection.entityId||atom.residueId===selection.entityId);}catch{return false;}
 }
 if(view.kind==='physical-field'){
   const interval=view.field.request.interval;
   if(selection.kind==='time')return selection.scopeId==='physical-field'&&selection.mode==='physical-time'&&selection.unit==='s'&&selection.frameId===null&&selection.value>=convertValue(interval.start,interval.unit,'s')&&selection.value<=convertValue(interval.end,interval.unit,'s');
   if(selection.kind!=='region'||selection.scopeId!=='physical-field'||selection.unit!=='m')return false;
   const grid=fieldGridGeometry(view.field.request);if(selection.frame!==grid.frame||grid.syntheticRow&&(selection.min[1]!==0||selection.max[1]!==0))return false;
   try{pixelsFromRegion(selection,{frame:grid.frame,kind:'declared',unit:'m',x:{origin:grid.origin[0],spacing:grid.spacing[0],direction:1},y:{origin:grid.origin[1],spacing:grid.spacing[1],direction:1},anchorIds:view.field.anchorIds,interpretation:'Cell-center coordinates; a 1D row uses the explicit zero display sentinel.'},{width:grid.nx,height:grid.ny});return true;}catch{return false;}
 }
 if(view.kind==='stochastic'){const interval=view.stochastic.request.interval;return selection.kind==='time'&&selection.scopeId==='stochastic'&&selection.mode==='physical-time'&&selection.unit==='s'&&selection.frameId===null&&selection.value>=convertValue(interval.start,interval.unit,'s')&&selection.value<=convertValue(interval.end,interval.unit,'s');}
 if(view.kind==='dynamics'){const interval=view.dynamics.request.interval;return selection.kind==='time'&&selection.scopeId==='dynamics'&&selection.mode==='physical-time'&&selection.unit==='s'&&selection.frameId===null&&selection.value>=convertValue(interval.start,interval.unit,'s')&&selection.value<=convertValue(interval.end,interval.unit,'s');}
 if(view.kind==='reasoning-guide'){const index=view.guide.steps.findIndex(step=>step.id===(selection.kind==='time'?selection.frameId:null));return selection.kind==='time'&&selection.scopeId==='reasoning'&&selection.mode==='authored-step'&&selection.unit==='guide-step'&&index>=0&&selection.value===index;}
 if(view.kind==='spatial-view'){
   if(selection.kind!=='region'||selection.scopeId!=='spatial'||selection.frame!==view.spatial.calibration.frame||selection.unit!==view.spatial.calibration.unit)return false;
   const asset=plan.assetManifests?.find(asset=>asset.id===view.spatial.input.assetId);
   if(asset&&asset.shape.length===2){try{pixelsFromRegion(selection,view.spatial.calibration,{width:asset.shape[1],height:asset.shape[0]});}catch{return false;}}return true;
 }
 if(view.kind==='statistical-chart'){
   if(selection.kind!=='entity'||selection.scopeId!=='chart')return false;const [seriesId,rowId,...extra]=selection.entityId.split(':');if(extra.length||!rowId)return false;const series=view.chart.series.find(s=>s.id===seriesId);if(!series)return false;
   if(view.chart.kind==='distribution')return /^bin\d+$/.test(rowId)&&Number(rowId.slice(3))<(view.chart.bins??0);
   const asset=plan.assetManifests?.find(asset=>asset.id===series.assetId);return asset?.kind==='table'?asset.data.rows.some(row=>row.id===rowId&&(!series.filter||row.values[asset.data.columns.findIndex(column=>column.id===series.filter!.column)]===series.filter.equals)):/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(rowId);
 }
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
   if(view.kind==='molecular-view'&&selection.kind==='entity')view.molecule.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='physical-field'&&(selection.kind==='time'||selection.kind==='region'))view.field.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='stochastic'&&selection.kind==='time')view.stochastic.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='dynamics'&&selection.kind==='time')view.dynamics.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='reasoning-guide'&&selection.kind==='time')view.guide.steps.find(step=>step.id===selection.frameId)?.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='spatial-view'&&selection.kind==='region')view.spatial.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='statistical-chart'&&selection.kind==='entity')view.chart.anchorIds.forEach(id=>ids.add(id));
   else if(view.kind==='composed-scene'&&selection.kind==='entity')view.scene.entities?.find(entity=>entity.id===selection.entityId)?.anchorIds.forEach(id=>ids.add(id));
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
