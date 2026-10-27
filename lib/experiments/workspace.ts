import { z } from 'zod';
import type { SourceDocument } from '../../shared/schema';
import { validateWidgetEnvelope, type WidgetEnvelope, type WidgetKind } from '../../shared/widgets';
import { createWidgetForSource } from '../widgets/presets';

export const workspaceKey=(source:SourceDocument)=>`paperplay:widgets:v2:${source.id}:${source.sourceVersion}`;
export function validateWorkspace(input:unknown,source:SourceDocument) {
  const data=z.strictObject({format:z.literal('paperplay-workspace'),version:z.literal(2),widgets:z.array(z.unknown()).max(24)}).parse(input);
  const widgets=data.widgets.map(x=>validateWidgetEnvelope(x,source));if(new Set(widgets.map(x=>x.id)).size!==widgets.length)throw Error('Duplicate widget identity.');return widgets;
}
export function saveWidgetWorkspace(values:WidgetEnvelope[],source:SourceDocument,storage:Pick<Storage,'getItem'|'setItem'>) {
  const widgets=validateWorkspace({format:'paperplay-workspace',version:2,widgets:values},source);
  const raw=JSON.stringify({format:'paperplay-workspace',version:2,widgets});if(new TextEncoder().encode(raw).length>750000)throw Error('The workspace exceeds its 750 kB allowance.');
  const key=workspaceKey(source),prior=storage.getItem(key);let recoveryKey:string|undefined;
  if(prior){try{validateWorkspace(JSON.parse(prior),source);}catch{recoveryKey=`${key}:recovery:${crypto.randomUUID()}`;storage.setItem(recoveryKey,prior);}}
  // A failed recovery copy throws before changing the original record.
  storage.setItem(key,raw);return {widgets,recoveryKey};
}
export function authoredWidget(kind:WidgetKind,source:SourceDocument,blockId:string,title?:string):WidgetEnvelope {
  const base=createWidgetForSource(kind,source,blockId);
  return validateWidgetEnvelope({...base,id:`authored-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`,title:title?.trim()||base.title,authorship:{kind:'user',label:'Reader-authored teaching model'}},source);
}
export function readingWidgets(source:SourceDocument):WidgetEnvelope[] {
  if(source.source.kind!=='prepared')return[];
  const equation=source.blocks.find(b=>b.kind==='equation'&&/Aw|quadratic/i.test(b.latex));
  if(equation)return[createWidgetForSource('equation',source,equation.id),createWidgetForSource('function',source,equation.id)];
  const graph=source.blocks.find(b=>b.kind==='paragraph'&&/Dijkstra/.test(b.text));
  if(graph){const item=createWidgetForSource('graph',source,graph.id);item.spec.mapping='Prepared small nonnegative Dijkstra teaching graph beside the cited application. It does not implement the source’s verified functional priority search tree or proof.';return[item];}
  const merge=source.blocks.find(b=>b.kind==='paragraph'&&/Powersort|mergesort/i.test(b.text));
  if(merge){const item=createWidgetForSource('diagram',source,merge.id);if(item.spec.kind==='diagram')item.spec={...item.spec,nodes:[{id:'runs',label:'Existing sorted runs',x:15,y:50},{id:'order',label:'Choose adjacent merge order',x:50,y:50},{id:'merge',label:'Stable merged output',x:85,y:50}],edges:[{id:'discover',source:'runs',target:'order',label:'schedule',weight:1},{id:'combine',source:'order',target:'merge',label:'merge',weight:1}],steps:[{label:'Runs',description:'Identify increasing runs in the explicit input.',activeNodeIds:['runs']},{label:'Schedule',description:'The source discusses which adjacent runs to merge; this schematic does not execute a scheduler.',activeNodeIds:['order']},{label:'Merge',description:'The checked sorting figure elsewhere computes an actual merge trace.',activeNodeIds:['merge']}],mapping:'Authored source-linked schematic of adaptive merging, not an execution trace.'};return[item];}
  return[];
}
