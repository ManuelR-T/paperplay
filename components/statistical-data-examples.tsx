'use client';
import { useEffect,useRef,useState } from 'react';
import { createStatisticalExample,statisticalExampleVariant,type StatisticalExampleKind } from '@/lib/representations/statistical-examples';
import { parseDataStudy,serializeDataStudy,MAX_DATA_STUDY_BYTES } from '@/lib/representations/data-study';
import { buildChartModel } from '@/lib/charts/model';
import { validateRepresentationPlan } from '@/shared/representations';
import { useRepresentationSelections } from './use-representation-selections';
import { StatisticalChartView } from './statistical-chart';
import { RepresentationEvidence } from './representation-evidence';
import { ScientificAssetView } from './scientific-asset-importer';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
import type { StatisticalChart } from '@/shared/statistical-charts';
export function StatisticalDataExamples(){
 const [choice,setChoice]=useState<{kind:StatisticalExampleKind;study?:Awaited<ReturnType<typeof parseDataStudy>>}|null>(null),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 return <section aria-label="Empirical scientific chart examples"><h3>Explore real measurements</h3><p>Attributed public data, supplied uncertainty and explicit local fits. These examples open their own source cards.</p><div className="reader-choice"><Button variant="outline" onClick={()=>setChoice({kind:'biology'})}>Biological measurements</Button><Button variant="outline" onClick={()=>setChoice({kind:'physics'})}>Physical measurements</Button><Button variant="outline" onClick={()=>input.current?.click()}>Open data study</Button><input ref={input} type="file" hidden accept="application/json,.json" aria-label="Import scientific data study" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');try{if(file.size>MAX_DATA_STUDY_BYTES)throw Error('Choose a data study below 512 KiB.');setChoice({kind:'biology',study:await parseDataStudy(await file.text())});}catch(problem){setError(problem instanceof Error?problem.message:'The data study could not be checked.');}}}/></div>{error&&<p role="alert">{error}</p>}{choice&&<DataExample key={choice.study?.plan.id??choice.kind} kind={choice.kind} initial={choice.study} onClose={()=>setChoice(null)}/>}</section>;
}
function DataExample({kind,initial,onClose}:{kind:StatisticalExampleKind;initial?:Awaited<ReturnType<typeof parseDataStudy>>;onClose:()=>void}){
 const [data,setData]=useState<Awaited<ReturnType<typeof createStatisticalExample>>|null>(initial??null),[error,setError]=useState('');
 useEffect(()=>{if(initial)return;let active=true;void createStatisticalExample(kind).then(value=>{if(active)setData(value);}).catch(problem=>{if(active)setError(problem instanceof Error?problem.message:'The data example could not be checked.');});return()=>{active=false;};},[kind,initial]);
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{initial?'Imported scientific data study':kind==='biology'?'Arabidopsis biomass observations':'Mauna Loa atmospheric observations'}</DialogTitle><DialogDescription>Dataset exploration. Source summaries, processing and teaching additions remain separate. No inference or original experiment reproduction.</DialogDescription>{error&&<p role="alert">{error}</p>}{data?<ReadyExample data={data}/>:!error&&<p role="status">Checking local data integrity…</p>}</DialogContent></Dialog>;
}

function ReadyExample({data}:{data:Awaited<ReturnType<typeof createStatisticalExample>>}){
 const [exportError,setExportError]=useState('');const [configured,setConfigured]=useState<StatisticalChart|null>(null);
 const [mode,setMode]=useState<StatisticalChart['kind']>((data.plan.views[0] as {chart:StatisticalChart}).chart.kind);
 const variant=statisticalExampleVariant(data.plan,mode),plan=validateRepresentationPlan(configured?{...variant,navigation:undefined,views:variant.views.map(view=>view.kind==='statistical-chart'?{...view,chart:configured}:view)}:variant,data.source),{store,navigation,selectionWarning}=useRepresentationSelections(plan),view=plan.views[0];
 if(view.kind!=='statistical-chart')throw Error('Expected statistical example.');
 const model=buildChartModel(view.chart,data.assets),sourceId=`study-source-${data.source.id}`;
 function returnToSource(anchorId:string){const target=document.getElementById(`${sourceId}-${anchorId}`);target?.scrollIntoView({block:'center'});target?.focus();}
 function changeForm(kind:StatisticalChart['kind']){try{const candidate=validateRepresentationPlan(statisticalExampleVariant(data.plan,kind),data.source);const candidateView=candidate.views[0];if(candidateView.kind!=='statistical-chart')throw Error('Expected a chart view.');buildChartModel(candidateView.chart,data.assets);setConfigured(null);setMode(kind);setExportError('');}catch(error){setExportError((error instanceof Error?error.message:'The chart form is unavailable.')+' The last valid chart was kept.');}}
 function exportPlan(){setExportError('');try{const exported=validateRepresentationPlan({...plan,navigation:store.getSnapshot()},data.source);const url=URL.createObjectURL(new Blob([serializeDataStudy(data.source,exported)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='paperplay-data-study.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(problem){setExportError(problem instanceof Error?problem.message:'The data study could not be exported.');}}

 return <><section className="reader-fieldset"><h3>Source attribution</h3>{plan.anchors.map(anchor=><blockquote key={anchor.id} id={`${sourceId}-${anchor.id}`} tabIndex={-1} className="passage-quotation">{anchor.quote}</blockquote>)}<p>{data.source.authors.join(' · ')}</p><p>{data.source.source.kind==='prepared'?'Prepared attribution card; not the full research paper or a physical PDF page.':'Selected source passages; open the original for full context.'}</p><a href={data.source.source.url} target="_blank" rel="noreferrer">Open official dataset record</a></section>
 <div className="reader-choice" role="group" aria-label="Statistical chart form">{((data.plan.views[0] as {chart:StatisticalChart}).chart.series.every(series=>!!series.yColumn)?['scatter','line','bar','distribution'] as const:['distribution'] as const).map(kind=><Button key={kind} variant={mode===kind?'secondary':'outline'} aria-pressed={mode===kind} onClick={()=>changeForm(kind)}>{({scatter:'Scatter',line:'Lines',bar:'Bars',distribution:'Distribution'})[kind]}</Button>)}</div>{mode==='distribution'&&<p>Distribution counts observed summary rows. Fitted, processed and illustrative curves are excluded; source uncertainty is not repurposed as bin uncertainty.</p>}
 <div className="reader-choice"><Button variant="ghost" onClick={()=>store.undo()}>Undo selection</Button><Button variant="ghost" onClick={()=>store.clear()}>Clear selections</Button><Button variant="outline" onClick={exportPlan}>Download data study</Button></div>{selectionWarning&&<p role="alert">{selectionWarning}</p>}{exportError&&<p role="alert">{exportError}</p>}
 <StatisticalChartView onConfigure={chart=>{buildChartModel(chart,data.assets);setConfigured(chart);setExportError('');}} model={model} viewId={view.id} store={store} navigation={navigation} onReturn={returnToSource}/>
 <RepresentationEvidence plan={plan}/>{data.assets.map(asset=><ScientificAssetView key={asset.id} asset={asset}/>)}
 </>;
}
