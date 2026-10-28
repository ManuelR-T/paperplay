'use client';
import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { SourceDocument } from '@/shared/schema';
import { validateRepresentationPlan, MAX_REPRESENTATION_BYTES, type RepresentationPlan } from '@/shared/representations';
import { buildRepresentation } from '@/lib/representations/lifecycle';
import { validateScientificAsset } from '@/lib/assets/local';
import type { ScientificAsset } from '@/shared/scientific-assets';
import { ScientificAssetImporter, ScientificAssetView } from './scientific-asset-importer';
import { bindScientificQuantity } from '@/lib/quantities/convert';
import { ComposedSceneView } from './composed-scene';
import { ScientificQuantityView } from './scientific-quantity-view';
import { RepresentationEvidence } from './representation-evidence';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
const WidgetView=dynamic(()=>import('./widgets/widget-view').then(module=>module.WidgetView),{ssr:false,loading:()=> <p role="status">Loading figure…</p>});

export function RepresentationPreview({input,source,onClose,assets}:{input:unknown;source:SourceDocument;onClose:()=>void;assets?:readonly ScientificAsset[]}) {
  const [working,setWorking]=useState(input);
  const [available,setAvailable]=useState<ScientificAsset[]>([...(assets??[])]);
  const [embedded,setEmbedded]=useState<ScientificAsset[]>([]);const [dataError,setDataError]=useState('');
  const parsed=useMemo(()=>{try{return validateRepresentationPlan(working,source);}catch{return null;}},[working,source]);
  const returnTarget=useRef<HTMLElement|null>(null);
  const built=useMemo(()=>buildRepresentation(working,source,{assets:available}),[working,source,available]);
  function bind(next:ScientificAsset[]){if(!parsed)return;const candidate={...parsed,assets:parsed.assets.map(ref=>{const asset=next.find(asset=>asset.id===ref.id);if(asset&&ref.checksum&&ref.checksum!==asset.checksum.value)throw Error('These data differ from the representation checksum. Supply its matching dataset; the original representation is retained.');return asset?{...ref,checksum:asset.checksum.value}:ref;}),assetManifests:[...(parsed.assetManifests??[]).filter(item=>!next.some(asset=>asset.id===item.id)),...next]};if(new TextEncoder().encode(JSON.stringify(candidate)).length>MAX_REPRESENTATION_BYTES)delete (candidate as {assetManifests?:ScientificAsset[]}).assetManifests;const plan=validateRepresentationPlan(candidate,source);setAvailable(old=>[...old.filter(item=>!next.some(asset=>asset.id===item.id)),...next]);setWorking(plan);setEmbedded([]);}

  function download(){try{const value=JSON.stringify(working,null,2);if(new TextEncoder().encode(value).length>MAX_REPRESENTATION_BYTES)throw Error('This representation exceeds 256 KiB for export. Keep the data files and reduce the selected dataset before exporting a combined representation.');const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='paperplay-representation.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){setDataError(error instanceof Error?error.message:'Export failed.');}}

  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog" onCloseAutoFocus={event=>{if(returnTarget.current){event.preventDefault();const target=returnTarget.current;requestAnimationFrame(()=>{target.scrollIntoView({block:"center"});target.focus();});}}}><DialogTitle>{built.status==='ready'?built.value.plan.title:'Representation unavailable'}</DialogTitle><DialogDescription>Preview a source-linked representation. This does not modify the paper or run a model request.</DialogDescription>
    {built.status==='ready'?<><p>{built.value.plan.objective}</p><p className="reader-hint">{built.value.plan.authorship.label} · Requested evidence: {built.value.plan.requestedEvidence.replaceAll('-',' ')}. No scientific verification is granted by opening this file.</p>
      {built.value.plan.views.map(view=>view.kind==='composed-scene'?<ComposedSceneView key={view.id} scene={view.scene} onReturn={anchorId=>{const anchor=built.value.plan.anchors.find(anchor=>anchor.id===anchorId)!;returnTarget.current=document.getElementById(`source-${source.id}-${anchor.blockId}`);onClose();}}/>:view.kind==='widget'?<WidgetView key={view.id} envelope={view.widget} source={source} onChange={widget=>setWorking({...built.value.plan,views:built.value.plan.views.map(item=>item.id===view.id?{...view,widget}:item)})}/>:view.kind==='quantity'?<ScientificQuantityView key={view.id} quantity={bindScientificQuantity(built.value.plan.quantities.find(quantity=>quantity.id===view.quantityId)!.measurement!,view.requirement)}/>:view.kind==='asset'?<ScientificAssetView key={view.id} asset={available.find(asset=>asset.id===view.assetId)!}/>:<SourceGuide key={view.id} plan={built.value.plan} view={view} source={source} onReturn={blockId=>{returnTarget.current=document.getElementById(`source-${source.id}-${blockId}`);onClose();}}/>)}
      <Button variant="ghost" onClick={()=>{returnTarget.current=document.getElementById(`source-${source.id}-${built.value.plan.anchors[0].blockId}`);onClose();}}>Return to cited passage</Button>
      {built.value.assets?.some(asset=>!built.value.plan.assetManifests?.some(item=>item.id===asset.id))&&<p className="reader-hint">Large datasets stay separate from this representation file. Download their data assets to retain unit conversions and reopen the exact checksum-bound data.</p>}
      <RepresentationEvidence plan={built.value.plan}/>
      <details><summary>Claims and assumptions</summary>{built.value.plan.claims.map(claim=><p key={claim.id}><strong>{claim.kind==='source'?'Source quotation':'Added explanation'}:</strong> {claim.text}</p>)}{built.value.plan.assumptions.map((text,index)=><p key={index}>{text}</p>)}</details>
    </>:<div role="alert"><p>{built.reason}</p><p>{built.nextAction}</p>{built.gaps?.map(gap=><p key={gap}>{gap}</p>)}</div>}
    {built.status==='missing-data'&&parsed&&parsed.assets.some(asset=>built.gaps?.includes(asset.id))&&<section aria-label="Bind scientific data">
      {!!parsed.assetManifests?.length&&<Button variant="outline" onClick={async()=>{setDataError('');try{setEmbedded(await Promise.all(parsed.assetManifests!.map(asset=>validateScientificAsset(asset,source))));}catch(error){setDataError(error instanceof Error?error.message:'Embedded data failed validation.');}}}>Check embedded data</Button>}
      {embedded.length>0&&<>{embedded.map(asset=><ScientificAssetView key={asset.id} asset={asset}/>)}<Button onClick={()=>{try{bind(embedded);}catch(error){setDataError(error instanceof Error?error.message:"Data binding failed.");}}}>Use checked embedded data</Button></>}
      <ScientificAssetImporter source={source} target={parsed.assets.find(asset=>built.gaps?.includes(asset.id))} onConfirm={asset=>bind([asset])}/>
    </section>}
    {dataError&&<p role="alert">{dataError}</p>}
    <Button variant="outline" onClick={download}>Download representation file</Button>
  </DialogContent></Dialog>;
}
function SourceGuide({plan,view,source,onReturn}:{onReturn:(blockId:string)=>void;plan:RepresentationPlan;view:Extract<RepresentationPlan['views'][number],{kind:'source-guide'}>;source:SourceDocument}) {
  const [index,setIndex]=useState(0);const step=view.steps[index];
  return <section aria-label="Source reading guide"><div className="reader-choice" role="group" aria-label="Reading guide steps">{view.steps.map((item,i)=><Button key={item.id} aria-pressed={index===i} variant={index===i?'secondary':'outline'} onClick={()=>setIndex(i)}>{i+1}. {item.title}</Button>)}</div>
    <div aria-live="polite"><h3>{step.title}</h3><p>{step.explanation}</p></div>
    {step.anchorIds.map(id=>{const anchor=plan.anchors.find(anchor=>anchor.id===id)!;return <div key={id}><blockquote className="passage-quotation">{anchor.quote}</blockquote><a href={`#source-${source.id}-${anchor.blockId}`} onClick={event=>{event.preventDefault();onReturn(anchor.blockId);}}>Original source passage · page {anchor.page}</a></div>;})}
  </section>;
}
