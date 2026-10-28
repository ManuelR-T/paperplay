'use client';
import {ExperienceExport} from './experience-export';
import {CoverageForSource} from './coverage-for-source';
import {RepresentationPreview} from './representation-preview';
import {ScientificAssetImporter} from './scientific-asset-importer';
import {representationFromAsset} from '@/lib/representations/from-asset';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import { useId,useMemo,useRef,useState } from 'react';
import type { SourceDocument } from '@/shared/schema';
import type { ScientificAsset } from '@/shared/scientific-assets';
import { validateRepresentationPlan,type RepresentationPlan } from '@/shared/representations';
import { buildRepresentation } from '@/lib/representations/lifecycle';
import { serializeDataStudy } from '@/lib/representations/data-study';
import { reformatChartRepresentation } from '@/lib/charts/variants';
import type { StatisticalChart } from '@/shared/statistical-charts';
import { useRepresentationSelections } from './use-representation-selections';
import { RepresentationViews,type PlanUpdate } from './representation-views';
import { RepresentationEvidence } from './representation-evidence';
import { ScientificAssetView } from './scientific-asset-importer';
import { Button } from './ui/button';
export type ScientificStudy={source:SourceDocument;plan:RepresentationPlan;assets:readonly ScientificAsset[]};
/** Local host for source-linked scientific views; source and data never enter an inference request. */
export function ScientificStudyView({study}:{study:ScientificStudy}){
 const [plan,setPlan]=useState(study.plan),[error,setError]=useState('');const current=useRef(plan);current.current=plan;
 const [showSourceDetails,setShowSourceDetails]=useState(false),sourceDetailsId=useId();
 const coveragePlans=useMemo(()=>[plan],[plan]),[fallback,setFallback]=useState<{plan:unknown;assets:readonly ScientificAsset[]}|null>(null),[importOpen,setImportOpen]=useState(false);
 const {store,navigation,selectionWarning}=useRepresentationSelections(plan,study.assets);
 const update:PlanUpdate=transform=>{const checked=buildRepresentation(transform(current.current),study.source,{assets:study.assets});if(checked.status!=='ready')throw Error(checked.reason);current.current=checked.value.plan;setPlan(checked.value.plan);setError('');};
 const originalChart=study.plan.views.length===1&&study.plan.views[0].kind==='statistical-chart'?study.plan.views[0]:null,chart=plan.views.length===1&&plan.views[0].kind==='statistical-chart'?plan.views[0]:null;
 function changeForm(kind:StatisticalChart['kind']){try{update(()=>reformatChartRepresentation(study.plan,kind));}catch(problem){setError((problem instanceof Error?problem.message:'Chart form unavailable.')+' The last valid figure was kept.');}}
 function download(){try{const value=validateRepresentationPlan({...plan,navigation:store.getSnapshot()},study.source),url=URL.createObjectURL(new Blob([serializeDataStudy(study.source,value)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='paperplay-data-study.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError('');}catch(problem){setError(problem instanceof Error?problem.message:'Study export failed.');}}
 const blocks=[...new Set(plan.anchors.map(anchor=>anchor.blockId))];
 const returnToSource=(blockId:string)=>{const target=document.getElementById(`study-${study.source.id}-${blockId}`);target?.scrollIntoView({block:'center'});target?.focus();};
 return <><section className="reader-fieldset"><h3>Source attribution</h3>{blocks.map(id=><div key={id} id={`study-${study.source.id}-${id}`} tabIndex={-1}>{plan.anchors.filter(anchor=>anchor.blockId===id).map(anchor=><blockquote key={anchor.id} className="passage-quotation">{anchor.quote}</blockquote>)}</div>)}<p>{study.source.authors.join(' · ')}</p>{study.source.source.url&&<a href={study.source.source.url} target="_blank" rel="noreferrer">Open original source record</a>}{study.source.extractionWarnings.length>0&&<><Button variant="ghost" style={{fontSize:'1rem',minHeight:44,whiteSpace:'normal'}} aria-expanded={showSourceDetails} aria-controls={sourceDetailsId} onClick={()=>setShowSourceDetails(value=>!value)}>Source details</Button><div id={sourceDetailsId} hidden={!showSourceDetails}>{study.source.extractionWarnings.map((warning,index)=><p className="reader-hint" key={index}>{warning}</p>)}</div></>}</section>
 {originalChart&&chart&&<div className="reader-choice" role="group" aria-label="Statistical chart form">{(originalChart.chart.series.every(series=>!!series.yColumn)?['scatter','line','bar','distribution'] as const:['distribution'] as const).map(kind=><Button key={kind} variant={chart.chart.kind===kind?'secondary':'outline'} aria-pressed={chart.chart.kind===kind} onClick={()=>changeForm(kind)}>{({scatter:'Scatter',line:'Lines',bar:'Bars',distribution:'Distribution'})[kind]}</Button>)}</div>}
 {chart?.chart.kind==='distribution'&&<p>Distribution counts supplied observation-summary rows. Fitted/processed/illustrative curves are excluded; no bin uncertainty or independent experimental replicates are inferred.</p>}
 <div className="reader-choice"><Button variant="ghost" onClick={()=>store.undo()}>Undo selection</Button><Button variant="ghost" onClick={()=>store.clear()}>Clear selections</Button><Button variant="outline" onClick={download}>Download data study</Button></div><p className="reader-hint">The downloaded file includes source text, embedded data, attribution and selections. Original images/PDF bytes stay separate; image references retain expected digests when available.</p>
 {error&&<p role="alert">{error}</p>}{selectionWarning&&<p role="alert">{selectionWarning}</p>}
 <ExperienceExport source={study.source} assets={study.assets} entries={[]} getEntries={()=>[{id:current.current.id,kind:'representation',plan:validateRepresentationPlan({...current.current,navigation:store.getSnapshot()},study.source)}]}/>
 <CoverageForSource input={{source:study.source,plans:coveragePlans,assets:study.assets}} onReturn={returnToSource} onFallback={next=>setFallback({plan:next,assets:study.assets})} onAction={(_sectionId,action)=>{if(action==='import-data')setImportOpen(true);else if(action==='inspect-representations'){const target=document.getElementById(`study-views-${study.source.id}-${plan.id}`);target?.scrollIntoView({block:'start'});target?.focus();}else returnToSource(plan.anchors[0].blockId);}}/>
 {importOpen&&<Dialog open onOpenChange={setImportOpen}><DialogContent className="reader-dialog"><DialogTitle>Inspect local data alongside this source</DialogTitle><DialogDescription>Importing a table does not fill a missing publication dataset or establish reproduction. Inspect it as a separate source-linked study.</DialogDescription><ScientificAssetImporter source={study.source} onConfirm={asset=>{setImportOpen(false);setFallback({plan:representationFromAsset(asset,study.source,plan.anchors[0].blockId),assets:[asset]});}}/></DialogContent></Dialog>}
 {fallback&&<RepresentationPreview input={fallback.plan} source={study.source} assets={fallback.assets} onClose={()=>setFallback(null)}/>}
 <div id={`study-views-${study.source.id}-${plan.id}`} tabIndex={-1}><RepresentationViews plan={plan} source={study.source} assets={study.assets} store={store} navigation={navigation} onUpdate={update} onReturn={returnToSource}/></div>
 <RepresentationEvidence plan={plan}/>{study.assets.map(asset=><ScientificAssetView key={asset.id} asset={asset}/>)}
 </>;
}
