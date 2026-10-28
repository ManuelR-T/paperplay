'use client';
import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { SourceDocument } from '@/shared/schema';
import type { RepresentationPlan } from '@/shared/representations';
import { buildRepresentation } from '@/lib/representations/lifecycle';
import { RepresentationEvidence } from './representation-evidence';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
const WidgetView=dynamic(()=>import('./widgets/widget-view').then(module=>module.WidgetView),{ssr:false,loading:()=> <p role="status">Loading figure…</p>});

export function RepresentationPreview({input,source,onClose}:{input:unknown;source:SourceDocument;onClose:()=>void}) {
  const [working,setWorking]=useState(input);
  const returnTarget=useRef<HTMLElement|null>(null);
  const built=useMemo(()=>buildRepresentation(working,source),[working,source]);
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(working,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='paperplay-representation.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reader-dialog" onCloseAutoFocus={event=>{if(returnTarget.current){event.preventDefault();const target=returnTarget.current;requestAnimationFrame(()=>{target.scrollIntoView({block:"center"});target.focus();});}}}><DialogTitle>{built.status==='ready'?built.value.plan.title:'Representation unavailable'}</DialogTitle><DialogDescription>Preview a source-linked representation. This does not modify the paper or run a model request.</DialogDescription>
    {built.status==='ready'?<><p>{built.value.plan.objective}</p><p className="reader-hint">{built.value.plan.authorship.label} · Requested evidence: {built.value.plan.requestedEvidence.replaceAll('-',' ')}. No scientific verification is granted by opening this file.</p>
      {built.value.plan.views.map(view=>view.kind==='widget'?<WidgetView key={view.id} envelope={view.widget} source={source} onChange={widget=>setWorking({...built.value.plan,views:built.value.plan.views.map(item=>item.id===view.id?{...view,widget}:item)})}/>:<SourceGuide key={view.id} plan={built.value.plan} view={view} source={source} onReturn={blockId=>{returnTarget.current=document.getElementById(`source-${source.id}-${blockId}`);onClose();}}/>)}
      <RepresentationEvidence plan={built.value.plan}/>
      <details><summary>Claims and assumptions</summary>{built.value.plan.claims.map(claim=><p key={claim.id}><strong>{claim.kind==='source'?'Source quotation':'Added explanation'}:</strong> {claim.text}</p>)}{built.value.plan.assumptions.map((text,index)=><p key={index}>{text}</p>)}</details>
    </>:<div role="alert"><p>{built.reason}</p><p>{built.nextAction}</p>{built.gaps?.map(gap=><p key={gap}>{gap}</p>)}</div>}
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
