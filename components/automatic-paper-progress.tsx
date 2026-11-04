'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2,Clock3,LoaderCircle,TriangleAlert} from 'lucide-react';
import styles from './automatic-paper.module.css';
import {Button} from './ui/button';

export type IllustrationPhase='opening'|'planning'|'generating'|'checking'|'waiting'|'ready'|'limited'|'blocked'|'paused';
type Props={visual?:ReactNode;phase:IllustrationPhase;message:string;figureCount:number;figuresDone:number;plannedFigures?:number;retryAt?:number;issues?:readonly string[];technicalDetails?:string;onCheckSaved?:()=>void;onRetry?:()=>void;onContinue?:()=>void;recoveryNote?:string;recoveryFeedback?:string};
const headings:Record<IllustrationPhase,string>={opening:'Preparing your paper',planning:'Meta is choosing illustrations',generating:'Meta is creating the selected illustrations',checking:'Checking layout and interactions',waiting:'Illustrations are waiting for capacity',ready:'Your illustrations are ready',limited:'Some illustrations need attention',blocked:'Illustrations need attention',paused:'Preparation paused'};
function countdown(milliseconds:number){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return seconds>=3600?`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`:seconds>=60?`${Math.floor(seconds/60)}m ${seconds%60}s`:`${seconds}s`;}

/** Shows actual workflow state, including waiting; never animates a failed or completed job. */
export function AutomaticPaperProgress({visual,phase,message,figureCount,figuresDone,plannedFigures,retryAt,issues=[],technicalDetails,onCheckSaved,onRetry,onContinue,recoveryNote,recoveryFeedback}:Props){
 const active=['opening','planning','generating','checking'].includes(phase),waiting=phase==='waiting';
 const [now,setNow]=useState(Date.now),[visible,setVisible]=useState(true);const card=useRef<HTMLElement>(null);
 // Elapsed time of the visible preparation, so the wait reads as live work rather than a stall.
 const [startedAt,setStartedAt]=useState<number|null>(null),[tick,setTick]=useState(0);
 useEffect(()=>{if(!active){setStartedAt(null);return;}setStartedAt(value=>value??Date.now());const timer=setInterval(()=>setTick(value=>value+1),1000);return()=>clearInterval(timer);},[active]);
 const elapsed=startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;void tick;
 useEffect(()=>{if(!waiting||!retryAt)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[waiting,retryAt]);
 useEffect(()=>{if(!card.current||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(card.current);return()=>observer.disconnect();},[]);
 const Icon=active?LoaderCircle:waiting||phase==='paused'?Clock3:phase==='ready'?CheckCircle2:TriangleAlert;
 const title=figureCount>0&&['ready','limited'].includes(phase)?`${figureCount} illustration${figureCount===1?'':'s'} ready`:headings[phase];
 const stage=phase==='opening'||phase==='planning'?0:phase==='generating'?1:phase==='checking'?2:3;
 const remaining=retryAt?countdown(retryAt-now):null;
 return <>
  <section ref={card} className={`${styles.panel} ${styles.progressCard}`} aria-label="Automatic Meta figures" aria-busy={active} data-illustration-phase={phase}>
   <div className={styles.progressHeading}><Icon className={active?styles.spinner:undefined} size={24} aria-hidden="true"/><div><h2>{title}{active&&startedAt&&<span className={styles.elapsed} aria-hidden="true">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>}</h2><p role="status">{message}</p></div></div>
   {visual}
   {(active||waiting)&&<>
    {!visual&&<ol className={styles.stages} aria-label="Illustration preparation steps">{['Meta reads & chooses','Build if needed','Check & display'].map((label,index)=><li key={label} data-step={waiting?'waiting':index<stage?'done':index===stage?'active':'pending'} aria-current={active&&index===stage?'step':undefined}><span aria-hidden="true">{index<stage&&!waiting?'✓':index+1}</span>{label}</li>)}</ol>}
    {visual?null:plannedFigures!==undefined&&plannedFigures>0?<><progress className={styles.sectionProgress} value={Math.min(figuresDone,plannedFigures)} max={plannedFigures} aria-label={`Illustrations prepared: ${figuresDone} of ${plannedFigures}`}/><p className={styles.progressHint}>{figuresDone} of {plannedFigures} selected illustrations ready</p></>:active?<div className={styles.indeterminate} role="progressbar" aria-label={title}/>:null}
    {waiting?<p className={styles.waitNotice}>{remaining?<><span aria-hidden="true">Resumes automatically in {remaining}.</span><span className="sr-only">Next automatic attempt at {new Date(retryAt!).toLocaleTimeString()}.</span></>:'Preparation will resume automatically when capacity is available.'} Keep reading; your place and figures are saved.</p>:null}
   </>}
   {!(active||waiting)&&issues.length>0&&<ul className={styles.issues}>{issues.slice(0,2).map((issue,index)=><li key={index}>{issue}</li>)}</ul>}
   {(onCheckSaved||onContinue||onRetry)&&<div className={styles.recoveryActions}>{onCheckSaved&&<><Button onClick={onCheckSaved}>Check progress</Button><span>This checks existing work without starting a new generation.</span></>}{onRetry&&<details className={styles.recoveryOptions}><summary>Try a new attempt</summary><p>The earlier request stays saved and may still complete.</p><Button variant="outline" onClick={onRetry}>Restart illustrations</Button></details>}{onContinue&&<Button onClick={onContinue}>Resume illustrations</Button>}</div>}

   {recoveryFeedback&&<p role="status" className={styles.progressHint}>{recoveryFeedback}</p>}
   {recoveryNote&&<p className={styles.progressHint}>{recoveryNote}</p>}
   {technicalDetails&&<details className={styles.technicalDetails}><summary>Technical details</summary><p>{technicalDetails}</p></details>}
   <small>{active?'You can read now. Figures will appear automatically beside their passages.':'Added illustrations are teaching models, not verified scientific results.'}</small>
  </section>
  {(active||waiting)&&!visible&&typeof document!=='undefined'&&(()=>{
   const detail=waiting?remaining?`Resumes automatically in ${remaining}`:'Waiting for capacity':plannedFigures!==undefined?`${figuresDone} of ${plannedFigures} selected illustrations ready`:'Reading the complete paper and choosing useful interactions.';
   // Prefer the sticky reader bar so progress never covers the paper; fall back to a floating dock.
   const slot=document.querySelector<HTMLElement>('[data-reader-status-slot]');
   if(slot)return createPortal(<button type="button" className={styles.progressChip} data-waiting={waiting} title={`${title} · ${detail}`} aria-label={`${title}. ${detail}. Show progress`} onClick={()=>card.current?.scrollIntoView({block:'center',behavior:'smooth'})}><Icon className={active?styles.spinner:undefined} size={15} aria-hidden="true"/><span className={styles.progressChipLabel}>{waiting?'Waiting':phase==='checking'?'Checking':'Preparing'}</span>{plannedFigures!==undefined&&plannedFigures>0&&<span className={styles.progressChipCount}>{Math.min(figuresDone,plannedFigures)}/{plannedFigures}</span>}</button>,slot);
   return createPortal(<aside className={styles.progressDock} aria-label="Paper illustration progress"><Icon className={active?styles.spinner:undefined} size={22} aria-hidden="true"/><div><strong>{title}</strong><p>{detail}</p></div></aside>,document.body);
  })()}
 </>;
}
