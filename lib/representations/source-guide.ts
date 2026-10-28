import type { SourceDocument } from '../../shared/schema';
import { validateRepresentationPlan, type RepresentationPlan } from '../../shared/representations';

/** A provider-free reading scaffold, explicitly added rather than attributed to authors. */
export function createSourceGuide(source:SourceDocument,blockId:string,title?:string):RepresentationPlan {
  const block=source.blocks.find(block=>block.id===blockId);
  if(!block)throw Error('Choose an existing passage.');
  const content=block.kind==='equation'?block.latex:block.kind==='original-figure'?block.caption:block.text;
  const quote=content.trim().slice(0,1000);
  return validateRepresentationPlan({
    format:'paperplay-representation',schemaVersion:1,id:`guide-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`,title:title?.trim()||'Explore this passage',
    source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:{kind:'user',label:'Reader-created reading scaffold'},
    objective:'Read a source claim, inspect its assumptions and connect its meaning to the original paper.',
    anchors:[{id:'passage',blockId,page:block.page,quote}],claims:[{id:'source-quote',kind:'source',text:quote,anchorIds:['passage']},{id:'reading-scaffold',kind:'pedagogical-addition',text:'These prompts are a reading scaffold, not a claim that the mechanism has been executed or verified.',anchorIds:['passage']}],
    assumptions:['The scaffold does not infer missing experimental data, equations or proof steps.'],requestedEvidence:'illustrative-walkthrough',assets:[],quantities:[],
    execution:{kind:'none',capabilities:[{id:'source-guide',version:'1.0.0'}],assetIds:[]},interactions:['select-step','return-source'],
    views:[{id:'reading',kind:'source-guide',steps:[{id:'read',title:'Read the claim',explanation:'Read the quoted passage. Identify what the authors state and which question it answers.',anchorIds:['passage']},{id:'assumptions',title:'Inspect the assumptions',explanation:'Check which conditions, definitions and inputs the surrounding paper requires. Keep anything missing as an open question.',anchorIds:['passage']},{id:'connect',title:'Connect to the source',explanation:'Compare your interpretation with the original passage and figures. Distinguish an observation, an explanation and a demonstrated result.',anchorIds:['passage']}]}],
  },source);
}
