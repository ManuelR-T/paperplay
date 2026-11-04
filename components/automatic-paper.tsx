'use client';

import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import dynamic from 'next/dynamic';
import {AutomaticPaperProgress,type IllustrationPhase} from './automatic-paper-progress';
import {PaperMap,PlanList,PlannedFigureSketch,useRailPlanMarkers,type PlanFigureView} from './automatic-paper-plan';
import type {SourceDocument} from '@/shared/schema';
import type {WidgetEnvelope} from '@/shared/widgets';
import type {GenerationCandidate} from '@/shared/artifact-generation';
import {enrichmentSourceIdentity} from '@/lib/enrichment/state';
import {createAutomaticPaperPipeline} from '@/lib/automatic/pipeline';
import {buildFigureArtifact,type FigureBuildResult} from '@/lib/artifacts/lifecycle';
import {useAdoptionPolicy} from './adoption-policy-provider';
import {InlineSourceWidget} from './inline-source-widget';
import {Button} from './ui/button';
import {Sparkles} from 'lucide-react';
import {FigureReadingGuideView,type FigureReadingGuide} from './figure-reading-guide';
import styles from './automatic-paper.module.css';

const GeneratedFigure=dynamic(()=>import('./generated-figure').then(module=>module.GeneratedFigure),{ssr:false,loading:()=> <p role="status">Opening interactive figure…</p>});
type Pipeline=Awaited<ReturnType<typeof createAutomaticPaperPipeline>>;
type Snapshot=ReturnType<Pipeline['getSnapshot']>;

/** Reader-only orchestration: the user's automatic-paper workflow authorizes bounded new creation. */
export function AutomaticPaperEnhancement({source,enabled=true}:{source:SourceDocument;enabled?:boolean}){
 const identity=enrichmentSourceIdentity(source);
 const stableSource=useMemo(()=>source,[identity]);
 const policy=useAdoptionPolicy();
 const [pipeline,setPipeline]=useState<Pipeline|null>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[recoveryFeedback,setRecoveryFeedback]=useState('');
 const controller=useRef<Pipeline|null>(null),autoStarted=useRef(false);
 useEffect(()=>{if(!enabled)return;let alive=true,unsubscribe:(()=>void)|undefined,owned:Pipeline|undefined;autoStarted.current=false;setPipeline(null);setSnapshot(null);setError('');setRecoveryFeedback('');
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
 // Earlier section-by-section additions are kept in storage while Meta chooses
 // which ones belong in the new whole-paper reading plan.
 const widgets=snapshot?.paperPlan?snapshot.widgets:[],generated=snapshot?.paperPlan?snapshot.generated:[];
 const guide=(widgetId?:string,generatedSha?:string)=>{const binding=snapshot?.figureBindings.find(b=>widgetId?b.widgetId===widgetId:b.generatedSha===generatedSha);return binding?.readingGuide??snapshot?.paperPlan?.figures.find(f=>f.id===binding?.figureId);};
 const timing=snapshot;
 const state=String(snapshot?.status??'idle');
 const available=policy.newModelAllowed&&policy.generatedAllowed;
 const phase:IllustrationPhase=error||policy.state==='unavailable'||policy.state==='ready'&&!available?'blocked':state==='waiting'?'waiting':state==='complete'?'ready':state==='partial'?'limited':state==='paused'?'paused':state==='blocked'?'blocked':state==='planning'||state==='generating'||state==='checking'?state:'opening';
 const waitingMessage=state==='waiting'?({
  'session-rate':'Several papers were opened in quick succession. This paper is queued and will resume automatically.',
  'global-rate':'The illustration service is busy. Your paper is queued and will resume automatically.',
  'daily-requests':"Today’s configured processing allowance has been reached. Preparation is scheduled to resume automatically.",
  'daily-tokens':"Today’s configured processing budget has been reached. Preparation is scheduled to resume automatically."
 }[snapshot?.quotaReason??'session-rate']):undefined;
 const technicalMessage=error||waitingMessage||(policy.state==='unavailable'?'The service is temporarily unavailable. Your paper remains readable.':policy.state==='ready'&&!available?!policy.newModelAllowed?policy.modelMessage:policy.generatedMessage:snapshot?.message)||'Opening the paper and checking its saved illustrations…';
 const canCheck=snapshot?.pending?.kind==='outline'||snapshot?.pending?.kind==='figure'||snapshot?.pending?.kind==='custom'&&snapshot.pending.scope==='paper'&&!!(snapshot.pending.run||snapshot.pending.candidate);
 async function checkSaved(){if(!pipeline)return;setRecoveryFeedback('Checking the saved request…');await pipeline.checkSavedRequest();setRecoveryFeedback(pipeline.getSnapshot().status==='blocked'?`Checked at ${new Date().toLocaleTimeString()}. No recoverable result is available yet. Your saved request is retained.`:'The saved result was recovered.');}
 // Meta's plan is known long before its figures are built: show it as it happens.
 const live=['opening','planning','generating','checking','waiting'].includes(phase);
 const pending=snapshot?.pending,buildingId=pending?.kind==='figure'?pending.figureBrief.id:pending?.kind==='custom'?pending.figureId:undefined;
 const doneIds=new Set(snapshot?.figureTasksDone??[]);
 const planFigures:PlanFigureView[]=(snapshot?.paperPlan?.figures??[]).map(figure=>({id:figure.id,title:figure.title,blockId:figure.blockId,kind:figure.kind,whyHere:figure.whyHere,learningGoal:figure.learningGoal,interaction:figure.interaction,status:doneIds.has(figure.id)?'ready':figure.id===buildingId?'building':'queued'}));
 const reading=live&&!snapshot?.paperPlan;
 const stalled=phase==='blocked';
 const canRetry=stalled&&available&&(snapshot?.pending?.kind==='outline'||snapshot?.pending?.kind==='figure')&&!snapshot.pending.job;
 const message=stalled?canRetry?'The previous attempt stopped. Check its progress to recover any available illustrations. You can keep reading.':canCheck?'The saved preparation could not be completed. Check its status to recover any available result. Your paper is ready to read.':'Illustrations are paused. Your paper and saved figures remain available. See the details below for the next step.':technicalMessage;
 return <>
  <AutomaticPaperProgress visual={live?<><PaperMap source={stableSource} figures={planFigures} reading={reading}/>{planFigures.length>0&&<PlanList source={stableSource} figures={planFigures}/>}</>:undefined} phase={phase} message={message} figureCount={widgets.length+generated.length} figuresDone={snapshot?.figureTasksDone.length??0} plannedFigures={snapshot?.paperPlan?.figures.length} retryAt={timing?.retryAt} issues={snapshot?.issues} technicalDetails={stalled?technicalMessage:undefined} onRetry={canRetry&&pipeline?()=>{setRecoveryFeedback('');void pipeline.retryPreparation();}:undefined} recoveryFeedback={recoveryFeedback} onCheckSaved={stalled&&canCheck&&pipeline?()=>void checkSaved():undefined} onContinue={state==='paused'&&pipeline&&available?()=>void pipeline.start():undefined} recoveryNote={stalled&&!canCheck?snapshot?.pending?'This saved request uses an older or incomplete reference that cannot be checked from this page. Keep this paper saved and include the technical details when reporting the problem.':'Keep this paper saved. If the service remains unavailable, include the technical details when reporting the problem.':undefined}/>
  {live&&planFigures.map((figure,index)=>figure.status==='ready'?null:<PlannedFigureSketch key={figure.id} source={stableSource} figure={figure} index={index} total={planFigures.length}/>)}
  <RailPlanMarkers source={stableSource} figures={live?planFigures:[]} reading={reading}/>
  <FigureArrivals source={stableSource} ready={!!snapshot} items={[...widgets.map(widget=>({key:widget.id,slotId:`inline-${widget.id}`,title:widget.title,blockId:widget.source.blockId})),...generated.map(entry=>({key:entry.candidate.sha256,slotId:`automatic-${entry.candidate.sha256}`,title:entry.candidate.artifact.title,blockId:entry.blockId}))]}/>
  {widgets.map(widget=><AutomaticStockFigure key={widget.id} envelope={widget} source={stableSource} readingGuide={guide(widget.id)}/>)}
  {generated.map(entry=><AutomaticGeneratedFigure key={entry.candidate.sha256} candidate={entry.candidate} blockId={entry.blockId} source={stableSource} readingGuide={guide(undefined,entry.candidate.sha256)}/>)}
 </>;
}

function RailPlanMarkers({source,figures,reading}:{source:SourceDocument;figures:PlanFigureView[];reading:boolean}){useRailPlanMarkers(source,figures,reading);return null;}
type ArrivalItem={key:string;slotId:string;title:string;blockId:string};
/**
 * Figures delivered while the reader is on the page arrive visibly: the figure settles into place,
 * its source passage glows, and the reader bar offers a jump to it. Figures restored on open stay still.
 */
function FigureArrivals({source,items,ready}:{source:SourceDocument;items:ArrivalItem[];ready:boolean}){
 const known=useRef<Set<string>|null>(null),[notice,setNotice]=useState<ArrivalItem|null>(null);
 const signature=items.map(item=>item.key).join('|');
 useEffect(()=>{known.current=null;setNotice(null);},[source.id,source.sourceVersion]);
 useEffect(()=>{
  // Figures present when the saved state first loads are restored, not delivered.
  if(!ready)return;
  if(!known.current){known.current=new Set(items.map(item=>item.key));return;}
  const fresh=items.filter(item=>!known.current!.has(item.key));if(!fresh.length)return;
  for(const item of fresh)known.current.add(item.key);
  const timers:number[]=[];let frame=0;
  const mark=(item:ArrivalItem,attempt=0)=>{
   const slot=document.getElementById(item.slotId);
   if(!slot){if(attempt<40)frame=requestAnimationFrame(()=>mark(item,attempt+1));return;}
   const passage=document.getElementById(`source-${source.id}-${item.blockId}`);
   slot.dataset.arrived='true';if(passage)passage.dataset.arrivalGlow='true';
   timers.push(window.setTimeout(()=>{delete slot.dataset.arrived;if(passage)delete passage.dataset.arrivalGlow;},2800));
  };
  for(const item of fresh)mark(item);
  setNotice(fresh.at(-1)!);timers.push(window.setTimeout(()=>setNotice(current=>current?.key===fresh.at(-1)!.key?null:current),7000));
  return()=>{cancelAnimationFrame(frame);timers.forEach(clearTimeout);};
 },[signature,ready]);
 const slot=notice&&typeof document!=='undefined'?document.querySelector<HTMLElement>('[data-reader-status-slot]'):null;
 if(!notice||!slot)return null;
 return createPortal(<button type="button" className={styles.arrivalNotice} aria-live="polite" title={notice.title} onClick={()=>{const target=document.getElementById(notice.slotId);target?.scrollIntoView({block:'start',behavior:'smooth'});setNotice(null);}}><Sparkles size={15} aria-hidden="true"/><span className={styles.arrivalLabel}>New figure</span><span className={styles.arrivalTitle}>{notice.title}</span></button>,slot);
}

function AutomaticStockFigure({envelope,source,readingGuide}:{envelope:WidgetEnvelope;source:SourceDocument;readingGuide?:FigureReadingGuide}){
 const [widget,setWidget]=useState(envelope),[open,setOpen]=useState(true);
 return <InlineSourceWidget envelope={widget} source={source} open={open} focused={false} onOpen={setOpen} onChange={setWidget} readingGuide={readingGuide}/>;
}

/** Host-owned insertion and visibility; generated code never receives DOM access. */
function SourceSlot({source,blockId,id,children}:{source:SourceDocument;blockId:string;id:string;children:(near:boolean)=>ReactNode}){
 const [slot,setSlot]=useState<HTMLElement|null>(null),[near,setNear]=useState(false);
 useEffect(()=>{const target=document.getElementById(`source-${source.id}-${blockId}`);if(!target)return;const node=document.createElement('div');node.id=`automatic-${id}`;target.insertAdjacentElement('afterend',node);setSlot(node);return()=>node.remove();},[source.id,source.sourceVersion,blockId,id]);
 useEffect(()=>{if(!slot)return;if(typeof IntersectionObserver==='undefined'){setNear(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'500px'});observer.observe(slot);return()=>observer.disconnect();},[slot]);
 return slot?createPortal(children(near),slot):null;
}

function AutomaticGeneratedFigure({candidate,source,blockId,readingGuide}:{candidate:GenerationCandidate;source:SourceDocument;blockId:string;readingGuide?:FigureReadingGuide}){
 return <SourceSlot source={source} blockId={blockId} id={candidate.sha256}>{near=><section className={`${styles.figure} paperplay-figure`} aria-label={`Custom Meta figure: ${candidate.artifact.title}`}><h3>{candidate.artifact.title}</h3>{readingGuide?<FigureReadingGuideView guide={readingGuide}/>:<p>{candidate.plan.objective}</p>}{near?<CheckedGeneratedFigure candidate={candidate} source={source}/>:<p>Interactive figure loads as you read this passage.</p>}<small>Meta teaching illustration · not an experimental result</small></section>}</SourceSlot>;
}

function CheckedGeneratedFigure({candidate,source}:{candidate:GenerationCandidate;source:SourceDocument}){
 const policy=useAdoptionPolicy();
 const [built,setBuilt]=useState<FigureBuildResult|null>(null);
 useEffect(()=>{let alive=true;const abort=new AbortController();void buildFigureArtifact(candidate.artifact,source,{signal:abort.signal}).then(value=>{if(alive)setBuilt(value);});return()=>{alive=false;abort.abort();};},[candidate,source]);
 function returnToSource(anchorId:string){const anchor=candidate.artifact.anchors.find(item=>item.id===anchorId);if(!anchor)return;const target=document.getElementById(`source-${source.id}-${anchor.blockId}`);target?.scrollIntoView({block:'center',behavior:'smooth'});target?.focus();}
 return <>{!built?<p role="status">Checking this figure’s source and local runtime…</p>:built.status==='ready'?policy.state==='unknown'?<p role="status">Checking interactive figure availability…</p>:<GeneratedFigure key={policy.generatedAllowed?'enabled':'readonly'} built={built.value} source={source} autoStart onReturn={returnToSource}/>:<p role="status">{built.reason}</p>}<div className={styles.actions}><Button variant="ghost" onClick={()=>returnToSource(candidate.artifact.anchors[0]?.id??'')}>Read cited passage</Button></div></>;
}
