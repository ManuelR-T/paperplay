'use client';
import { useEffect,useRef,useState } from 'react';
import { createStatisticalExample,type StatisticalExampleKind } from '@/lib/representations/statistical-examples';
import { parseDataStudy,MAX_DATA_STUDY_BYTES } from '@/lib/representations/data-study';
import { ScientificStudyView } from './scientific-study';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
export function StatisticalDataExamples(){
 const [choice,setChoice]=useState<{kind:StatisticalExampleKind;study?:Awaited<ReturnType<typeof parseDataStudy>>}|null>(null),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 return <section aria-label="Empirical scientific chart examples"><h3>Explore real measurements</h3><p>Attributed public data, supplied uncertainty and explicit local fits. These examples open their own source cards.</p><div className="reader-choice"><Button variant="outline" onClick={()=>setChoice({kind:'biology'})}>Biological measurements</Button><Button variant="outline" onClick={()=>setChoice({kind:'physics'})}>Physical measurements</Button><Button variant="outline" onClick={()=>input.current?.click()}>Open data study</Button><input ref={input} type="file" hidden accept="application/json,.json" aria-label="Import scientific data study" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');try{if(file.size>MAX_DATA_STUDY_BYTES)throw Error('Choose a data study below 512 KiB.');setChoice({kind:'biology',study:await parseDataStudy(await file.text())});}catch(problem){setError(problem instanceof Error?problem.message:'The data study could not be checked.');}}}/></div>{error&&<p role="alert">{error}</p>}{choice&&<DataExample key={choice.study?.plan.id??choice.kind} kind={choice.kind} initial={choice.study} onClose={()=>setChoice(null)}/>}</section>;
}
function DataExample({kind,initial,onClose}:{kind:StatisticalExampleKind;initial?:Awaited<ReturnType<typeof parseDataStudy>>;onClose:()=>void}){
 const [data,setData]=useState<Awaited<ReturnType<typeof createStatisticalExample>>|null>(initial??null),[error,setError]=useState('');
 useEffect(()=>{if(initial)return;let active=true;void createStatisticalExample(kind).then(value=>{if(active)setData(value);}).catch(problem=>{if(active)setError(problem instanceof Error?problem.message:'The data example could not be checked.');});return()=>{active=false;};},[kind,initial]);
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog"><DialogTitle>{initial?'Imported scientific data study':kind==='biology'?'Arabidopsis biomass observations':'Mauna Loa atmospheric observations'}</DialogTitle><DialogDescription>Dataset exploration. Source summaries, processing and teaching additions remain separate. No inference or original experiment reproduction.</DialogDescription>{error&&<p role="alert">{error}</p>}{data?<ScientificStudyView study={data}/>:!error&&<p role="status">Checking local data integrity…</p>}</DialogContent></Dialog>;
}
