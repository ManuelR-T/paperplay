'use client';

import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import dynamic from 'next/dynamic';
import {AutomaticPaperProgress,type IllustrationPhase} from './automatic-paper-progress';
import type {SourceDocument} from '@/shared/schema';
import type {WidgetEnvelope} from '@/shared/widgets';
import type {GenerationCandidate} from '@/shared/artifact-generation';
import {enrichmentSourceIdentity} from '@/lib/enrichment/state';
import {createAutomaticPaperPipeline} from '@/lib/automatic/pipeline';
import {buildFigureArtifact,type FigureBuildResult} from '@/lib/artifacts/lifecycle';
import {useAdoptionPolicy} from './adoption-policy-provider';
import {InlineSourceWidget} from './inline-source-widget';
import {Button} from './ui/button';
import styles from './automatic-paper.module.css';

const GeneratedFigure=dynamic(()=>import('./generated-figure').then(module=>module.GeneratedFigure),{ssr:false,loading:()=> <p role="status">Opening interactive figure…</p>});
type Pipeline=Awaited<ReturnType<typeof createAutomaticPaperPipeline>>;
type Snapshot=ReturnType<Pipeline['getSnapshot']>;

/** Reader-only orchestration: the user's automatic-paper workflow authorizes bounded new creation. */
export function AutomaticPaperEnhancement({source,enabled=true}:{source:SourceDocument;enabled?:boolean}){
 const identity=enrichmentSourceIdentity(source);
 const stableSource=useMemo(()=>source,[identity]);
 const policy=useAdoptionPolicy();
 const [pipeline,setPipeline]=useState<Pipeline|null>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState('');
 const controller=useRef<Pipeline|null>(null),autoStarted=useRef(false);
 useEffect(()=>{if(!enabled)return;let alive=true,unsubscribe:(()=>void)|undefined,owned:Pipeline|undefined;autoStarted.current=false;setPipeline(null);setSnapshot(null);setError('');
  void createAutomaticPaperPipeline(stableSource).then(next=>{if(!alive){next.dispose();return;}owned=next;controller.current=next;setPipeline(next);setSnapshot(next.getSnapshot());unsubscribe=next.subscribe(()=>{if(alive)setSnapshot(next.getSnapshot());});}).catch(()=>{if(alive)setError('Automatic figures could not open safely. The original paper remains readable.');});
  return()=>{alive=false;unsubscribe?.();if(controller.current===owned)controller.current=null;owned?.dispose();};
 },[stableSource,enabled]);
 useEffect(()=>{if(!pipeline||!snapshot||!enabled||!policy.newModelAllowed||!policy.generatedAllowed||autoStarted.current)return;autoStarted.current=true;
  // Opening the paper authorizes a single automatic recovery, including older paused caches.
  // The controller retains accepted request identities and never replaces uncertain submissions.
  if(snapshot.status!=='complete'&&snapshot.status!=='partial')void pipeline.start();
 },[pipeline,snapshot,enabled,policy.newModelAllowed,policy.generatedAllowed]);
 useEffect(()=>{if(pipeline&&(!enabled||policy.state==='unavailable'||policy.state==='ready'&&(!policy.newModelAllowed||!policy.generatedAllowed)))void pipeline.pause();},[pipeline,enabled,policy.state,policy.newModelAllowed,policy.generatedAllowed]);
 if(!enabled)return null;
 const widgets=snapshot?.widgets??[],generated=snapshot?.generated??[];
 const timing=snapshot;
 const state=String(snapshot?.status??'idle');
 const available=policy.newModelAllowed&&policy.generatedAllowed;
 const phase:IllustrationPhase=error||policy.state==='unavailable'||policy.state==='ready'&&!available?'blocked':state==='waiting'?'waiting':state==='complete'?'ready':state==='partial'?'limited':state==='blocked'?'blocked':state==='planning'||state==='generating'||state==='checking'?state:'opening';
 const waitingMessage=state==='waiting'?({
  'session-rate':'Several papers were opened in quick succession. This paper is queued and will resume automatically.',
  'global-rate':'The illustration service is busy. Your paper is queued and will resume automatically.',
  'daily-requests':"Today’s configured processing allowance has been reached. Preparation is scheduled to resume automatically.",
  'daily-tokens':"Today’s configured processing budget has been reached. Preparation is scheduled to resume automatically."
 }[snapshot?.quotaReason??'session-rate']):undefined;
 const message=error||waitingMessage||(policy.state==='unavailable'?'The service is temporarily unavailable. Your paper remains readable.':policy.state==='ready'&&!available?!policy.newModelAllowed?policy.modelMessage:policy.generatedMessage:snapshot?.message)||'Opening the paper and checking its saved illustrations…';
 return <>
  <AutomaticPaperProgress phase={phase} message={message} figureCount={widgets.length+generated.length} sectionsDone={snapshot?.sectionsDone??0} sectionsPlanned={snapshot?.sectionIds.length??0} sectionsTotal={snapshot?.sectionsTotal??0} retryAt={timing?.retryAt} issues={snapshot?.issues}/>
  {widgets.map(widget=><AutomaticStockFigure key={widget.id} envelope={widget} source={stableSource}/>)}
  {generated.map(entry=><AutomaticGeneratedFigure key={entry.candidate.sha256} candidate={entry.candidate} blockId={entry.blockId} source={stableSource}/>)}
 </>;
}

function AutomaticStockFigure({envelope,source}:{envelope:WidgetEnvelope;source:SourceDocument}){
 const [widget,setWidget]=useState(envelope),[open,setOpen]=useState(true);
 return <InlineSourceWidget envelope={widget} source={source} open={open} focused={false} onOpen={setOpen} onChange={setWidget}/>;
}

/** Host-owned insertion and visibility; generated code never receives DOM access. */
function SourceSlot({source,blockId,id,children}:{source:SourceDocument;blockId:string;id:string;children:(near:boolean)=>ReactNode}){
 const [slot,setSlot]=useState<HTMLElement|null>(null),[near,setNear]=useState(false);
 useEffect(()=>{const target=document.getElementById(`source-${source.id}-${blockId}`);if(!target)return;const node=document.createElement('div');node.id=`automatic-${id}`;target.insertAdjacentElement('afterend',node);setSlot(node);return()=>node.remove();},[source.id,source.sourceVersion,blockId,id]);
 useEffect(()=>{if(!slot)return;if(typeof IntersectionObserver==='undefined'){setNear(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'500px'});observer.observe(slot);return()=>observer.disconnect();},[slot]);
 return slot?createPortal(children(near),slot):null;
}

function AutomaticGeneratedFigure({candidate,source,blockId}:{candidate:GenerationCandidate;source:SourceDocument;blockId:string}){
 return <SourceSlot source={source} blockId={blockId} id={candidate.sha256}>{near=><section className={`${styles.figure} paperplay-figure`} aria-label={`Custom Meta figure: ${candidate.artifact.title}`}><h3>{candidate.artifact.title}</h3><p>{candidate.plan.objective}</p><small>Custom figure by Meta · illustrative and scientifically unverified</small>{near?<CheckedGeneratedFigure candidate={candidate} source={source}/>:<p>Interactive figure loads as you read this passage.</p>}</section>}</SourceSlot>;
}

function CheckedGeneratedFigure({candidate,source}:{candidate:GenerationCandidate;source:SourceDocument}){
 const policy=useAdoptionPolicy();
 const [built,setBuilt]=useState<FigureBuildResult|null>(null);
 useEffect(()=>{let alive=true;const abort=new AbortController();void buildFigureArtifact(candidate.artifact,source,{signal:abort.signal}).then(value=>{if(alive)setBuilt(value);});return()=>{alive=false;abort.abort();};},[candidate,source]);
 function returnToSource(anchorId:string){const anchor=candidate.artifact.anchors.find(item=>item.id===anchorId);if(!anchor)return;const target=document.getElementById(`source-${source.id}-${anchor.blockId}`);target?.scrollIntoView({block:'center',behavior:'smooth'});target?.focus();}
 return <>{!built?<p role="status">Checking this figure’s source and local runtime…</p>:built.status==='ready'?policy.state==='unknown'?<p role="status">Checking interactive figure availability…</p>:<GeneratedFigure key={policy.generatedAllowed?'enabled':'readonly'} built={built.value} source={source} autoStart onReturn={returnToSource}/>:<p role="status">{built.reason}</p>}<div className={styles.actions}><Button variant="ghost" onClick={()=>returnToSource(candidate.artifact.anchors[0]?.id??'')}>Read cited passage</Button></div></>;
}
