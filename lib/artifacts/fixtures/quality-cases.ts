import { createDynamicSequenceArtifact } from './dynamic-sequence';
import { sha256Text } from '../sdk-source';
import type { FigureQualityCode } from '../../../shared/figure-quality';
export const QUALITY_CASE_IDS=['healthy','clipped-label','unreachable-control','blank-after-action','runaway'] as const;
export type QualityCaseId=typeof QUALITY_CASE_IDS[number];
/** Project-authored teaching cases. These are not a held-out scientific evaluation. */
export async function createQualityCase(id:QualityCaseId){
 const {source,artifact}=await createDynamicSequenceArtifact();
 const labels:Record<QualityCaseId,string>={healthy:'Growing sequence','clipped-label':'Clipped label','unreachable-control':'Unavailable interaction','blank-after-action':'Blank after interaction',runaway:'Runaway after repeated interaction'};
 const expected:Record<QualityCaseId,FigureQualityCode[]>={healthy:[],'clipped-label':['text-clipped'],'unreachable-control':['unreachable-control'],'blank-after-action':['blank-scene'],runaway:['execution']};
 if(id!=='healthy'){
  const code=`function update(input,previous,event){
   const n=(previous?previous.nextId:0)+(event.kind==='control'?1:0);
   ${id==='runaway'?'if(n>=2){while(true){}}':''}
   const empty=${id==='blank-after-action'?'n>0':'false'};
   return sdk.frame({title:'Authored quality fixture',description:'Project-owned local quality check.',coordinateSpace:{width:120,height:80},marks:empty?[]:[${id==='clipped-label'?"sdk.text({id:'label',at:[110,40],text:'This deliberately long authored label extends beyond the drawing',label:'Authored long label'})":"sdk.circle({id:'node',center:[40,40],radius:20,label:'Authored node'})"}],controls:empty?[]:[sdk.button({id:'next',label:'Next',disabled:${id==='unreachable-control'}})],table:{caption:'Authored state',columns:['Step'],rows:[]},state:{items:[],nextId:n}});
  }`;
  artifact.entry={...artifact.entry,source:code,sha256:await sha256Text(code)};
 }
 artifact.id='quality-'+id;artifact.title=labels[id];
 return {id,label:labels[id],source,artifact,promisedInteractions:true,expectedCodes:expected[id]};
}
