import type { SourceDocument } from '../../shared/schema';
import { validateProcessNetwork, type ProcessNetwork } from '../../shared/process-networks';
import { validateRepresentationPlan, type RepresentationPlan } from '../../shared/representations';
import { createSourceGuide } from './source-guide';
export function representationFromProcess(input:ProcessNetwork,source:SourceDocument,blockId:string):RepresentationPlan{
 const guide=createSourceGuide(source,blockId),network=validateProcessNetwork(input,['passage']);
 const rootId=network.id==='root'?'layout-root':'root',quoteId=network.id==='quotation'?'layout-quotation':'quotation';
 return validateRepresentationPlan({...guide,title:network.title,objective:network.description,assumptions:[...guide.assumptions,'The process uses authored explanatory transitions, not computed execution events. No rate or causal effect is inferred.'],interactions:[...(network.steps.length?['select-step' as const]:[]),'select-entity','return-source'],execution:{kind:'none',capabilities:[{id:'composed-scene',version:'1.0.0'}],assetIds:[]},views:[{id:'composition',kind:'composed-scene',scene:{format:'paperplay-composed-scene',schemaVersion:1,rootId,entities:network.entities.map(entity=>({id:entity.id,label:entity.label,anchorIds:['passage']})),nodes:[{id:rootId,kind:'panel',title:'Source-linked process explanation',children:[quoteId,network.id]},{id:quoteId,kind:'annotation',role:'source',text:guide.anchors[0].quote,anchorIds:['passage']},network]}}]},source);
}
