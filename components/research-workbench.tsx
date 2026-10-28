'use client';

import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import type {SourceDocument} from '@/shared/schema';
import type {ExtractionEvidenceManifest} from '@/shared/extraction-evidence';
import {prepareWidgetSource,validateWidgetEnvelope,type WidgetEnvelope} from '@/shared/widgets';
import {readingWidgets,validateWorkspace,workspaceKey,saveWidgetWorkspace} from '@/lib/experiments/workspace';
import {decodeWidgetSnapshot} from '@/lib/widgets/compatibility';
import {peekWidgetLocation} from '@/lib/experiments/widget-location';
import {listSavedArtifactExperiments} from '@/lib/artifacts/experiment-library';
import {FigureArtifactPreview} from './figure-artifact-preview';
import {InlineSourceWidget} from './inline-source-widget';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {OriginalPdfPage} from './reading/original-pdf-page';
import styles from './research-workbench.module.css';

const ExtractionEvidencePanel=dynamic(()=>import('./extraction-evidence').then(module=>module.ExtractionEvidencePanel),{ssr:false,loading:()=> <p role="status">Loading source inspection…</p>});
type SavedArtifact=Awaited<ReturnType<typeof listSavedArtifactExperiments>>[number];

/** Preserve earlier saved figures and source inspection; authoring belongs to the automatic pipeline. */
export function ResearchWorkbench({source:rawSource,original,originalName,originalUrl,extractionEvidence}:{source:SourceDocument;original?:Blob;originalName?:string;originalUrl?:string;extractionEvidence?:ExtractionEvidenceManifest}){
 const source=useMemo(()=>prepareWidgetSource(rawSource),[rawSource]),identity=`${source.id}:${source.sourceVersion}`;
 const [slot,setSlot]=useState<{identity:string;widgets:WidgetEnvelope[]}>({identity:'',widgets:[]});
 const widgets=slot.identity===identity?slot.widgets:[];
 const [message,setMessage]=useState(''),[saved,setSaved]=useState<SavedArtifact[]>([]),[preview,setPreview]=useState<SavedArtifact|null>(null),[originalPage,setOriginalPage]=useState<number|null>(null);
 const [closed,setClosed]=useState<string[]>([]);
 const returnToSource=(blockId:string)=>{const target=document.getElementById(`source-${source.id}-${blockId}`);target?.scrollIntoView({block:'center'});target?.focus();};
 function save(values:WidgetEnvelope[]){try{const checked=validateWorkspace({format:'paperplay-workspace',version:2,widgets:values},source);saveWidgetWorkspace(checked,source,localStorage);setSlot({identity,widgets:checked});}catch{setMessage('The current interaction could not be saved. The original stored figures were retained.');}}
 useEffect(()=>{let values:WidgetEnvelope[]=[];try{const raw=localStorage.getItem(workspaceKey(source));if(raw){if(raw.length>750000)throw Error('Saved figures exceed this workspace limit.');values=validateWorkspace(JSON.parse(raw),source);}else values=readingWidgets(source);}catch{setMessage('Some saved figures could not be read. Their original records were retained; source reading remains available.');}
  if(location.hash.startsWith('#widget=')){try{const encoded=location.hash.slice(8),reference=peekWidgetLocation(encoded);if(reference.documentId===source.id){const shared=decodeWidgetSnapshot(encoded,source),next=[...values.filter(value=>value.id!==shared.id),shared];if(next.length>24)throw Error('Too many saved figures.');saveWidgetWorkspace(next,source,localStorage);values=next;history.replaceState(history.state,'',location.pathname+location.search);}}catch{setMessage('The shared figure could not be restored safely. Its URL and stored figures were retained.');}}
  setSlot({identity,widgets:values});setClosed([]);
 },[identity]);
 useEffect(()=>{const restore=()=>{if(!location.hash.startsWith('#widget='))return;try{const encoded=location.hash.slice(8);if(peekWidgetLocation(encoded).documentId!==source.id)return;const shared=validateWidgetEnvelope(decodeWidgetSnapshot(encoded,source),source),next=[...widgets.filter(value=>value.id!==shared.id),shared];if(next.length>24)throw Error('Too many saved figures.');save(next);setClosed(old=>old.filter(id=>id!==shared.id));history.replaceState(history.state,'',location.pathname+location.search);}catch{setMessage('The shared figure could not be restored safely. Existing figures were retained.');}};window.addEventListener('hashchange',restore);return()=>window.removeEventListener('hashchange',restore);},[identity,widgets]);
 useEffect(()=>{let active=true;const refresh=()=>{void listSavedArtifactExperiments(source).then(values=>{if(active)setSaved(values);}).catch(()=>{if(active)setMessage('Saved figure records are temporarily unavailable. Their originals were retained.');});};refresh();const changed=(event:Event)=>{if((event as CustomEvent).detail?.documentId===source.id)refresh();};window.addEventListener('paperplay:artifact-library-changed',changed);return()=>{active=false;window.removeEventListener('paperplay:artifact-library-changed',changed);};},[identity]);
 return <>
  {saved.length>0&&<section className={styles.saved} aria-label="Previously saved figures">{saved.map(item=><Button key={item.id} variant="outline" onClick={()=>setPreview(item)}>{item.title}</Button>)}</section>}
  {message&&<p role="status">{message}</p>}
  {extractionEvidence&&<details className={styles.workbench}><summary>Source inspection</summary><ExtractionEvidencePanel source={rawSource} manifest={extractionEvidence} original={{blob:original,url:originalUrl??rawSource.source.url,name:originalName}} onReturn={returnToSource} onOpenOriginal={original||originalUrl&&/\.pdf(?:$|[?#])/i.test(originalUrl)?page=>setOriginalPage(page):undefined}/></details>}
  {originalPage!==null&&<Dialog open onOpenChange={open=>{if(!open)setOriginalPage(null);}}><DialogContent className="reader-dialog"><DialogTitle>Original PDF · page {originalPage}</DialogTitle><DialogDescription>Original source pixels for comparison.</DialogDescription><OriginalPdfPage source={rawSource} blockId={rawSource.blocks[0].id} requestedPage={originalPage} original={original} url={originalUrl}/></DialogContent></Dialog>}
  {preview&&<FigureArtifactPreview readerMode autoStart input={preview.artifact} source={source} assets={preview.assets} recordedReplay={preview.replay} experiment={{input:preview.input,seed:preview.seed,records:[],expectedInputSha256:preview.replay?.inputSha256}} onClose={()=>setPreview(null)}/>}
  {widgets.map(widget=><InlineSourceWidget key={widget.id} envelope={widget} source={source} focused={false} open={!closed.includes(widget.id)} onOpen={open=>setClosed(old=>open?old.filter(id=>id!==widget.id):[...old,widget.id])} onChange={value=>save(widgets.map(widget=>widget.id===value.id?value:widget))}/>)}
 </>;
}
