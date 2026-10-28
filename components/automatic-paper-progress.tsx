'use client';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2,Clock3,LoaderCircle,TriangleAlert} from 'lucide-react';
import styles from './automatic-paper.module.css';

export type IllustrationPhase='opening'|'planning'|'generating'|'checking'|'waiting'|'ready'|'limited'|'blocked';
type Props={phase:IllustrationPhase;message:string;figureCount:number;sectionsDone:number;sectionsPlanned:number;sectionsTotal:number;retryAt?:number;issues?:readonly string[]};
const headings:Record<IllustrationPhase,string>={opening:'Preparing your paper',planning:'Meta is choosing illustrations',generating:'Meta is creating a custom illustration',checking:'Checking layout and interactions',waiting:'Illustrations are waiting for capacity',ready:'Your illustrations are ready',limited:'Some illustrations need attention',blocked:'Illustrations could not be prepared'};
function countdown(milliseconds:number){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return seconds>=3600?`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`:seconds>=60?`${Math.floor(seconds/60)}m ${seconds%60}s`:`${seconds}s`;}

/** Shows actual workflow state, including waiting; never animates a failed or completed job. */
export function AutomaticPaperProgress({phase,message,figureCount,sectionsDone,sectionsPlanned,sectionsTotal,retryAt,issues=[]}:Props){
 const active=['opening','planning','generating','checking'].includes(phase),waiting=phase==='waiting';
 const [now,setNow]=useState(Date.now),[visible,setVisible]=useState(true);const card=useRef<HTMLElement>(null);
 useEffect(()=>{if(!waiting||!retryAt)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[waiting,retryAt]);
 useEffect(()=>{if(!card.current||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(card.current);return()=>observer.disconnect();},[]);
 const Icon=active?LoaderCircle:waiting?Clock3:phase==='ready'?CheckCircle2:TriangleAlert;
 const title=figureCount>0&&['ready','limited'].includes(phase)?`${figureCount} illustration${figureCount===1?'':'s'} ready`:headings[phase];
 const stage=phase==='opening'||phase==='planning'?0:phase==='generating'?1:phase==='checking'?2:3;
 const remaining=retryAt?countdown(retryAt-now):null;
 return <>
  <section ref={card} className={`${styles.panel} ${styles.progressCard}`} aria-label="Automatic Meta figures" aria-busy={active} data-illustration-phase={phase}>
   <div className={styles.progressHeading}><Icon className={active?styles.spinner:undefined} size={24} aria-hidden="true"/><div><h2>{title}</h2><p role="status">{message}</p></div></div>
   {(active||waiting)&&<>
    <ol className={styles.stages} aria-label="Illustration preparation steps">{['Meta reads & chooses','Build if needed','Check & display'].map((label,index)=><li key={label} data-step={waiting?'waiting':index<stage?'done':index===stage?'active':'pending'} aria-current={active&&index===stage?'step':undefined}><span aria-hidden="true">{index<stage&&!waiting?'✓':index+1}</span>{label}</li>)}</ol>
    {phase==='planning'&&sectionsPlanned>0?<><progress className={styles.sectionProgress} value={Math.min(sectionsDone,sectionsPlanned)} max={sectionsPlanned} aria-label={`Sections prepared: ${sectionsDone} of ${sectionsPlanned}`}/><p className={styles.progressHint}>Section {Math.min(sectionsDone+1,sectionsPlanned)} of {sectionsPlanned} in this pass</p></>:active?<div className={styles.indeterminate} role="progressbar" aria-label={title}/>:null}
    {waiting?<p className={styles.waitNotice}>{remaining?<><span aria-hidden="true">Resumes automatically in {remaining}.</span><span className="sr-only">Next automatic attempt at {new Date(retryAt!).toLocaleTimeString()}.</span></>:'Preparation will resume automatically when capacity is available.'} Keep reading; your place and figures are saved.</p>:<div className={styles.preparationPlaceholder} aria-hidden="true"><span/><span/><span/></div>}
   </>}
   {!(active||waiting)&&issues.length>0&&<ul className={styles.issues}>{issues.slice(0,2).map((issue,index)=><li key={index}>{issue}</li>)}</ul>}
   <small>{active?'You can read now. Figures will appear automatically beside their passages.':'Added illustrations are teaching models, not verified scientific results.'}</small>
  </section>
  {(active||waiting)&&!visible&&typeof document!=='undefined'&&createPortal(<aside className={styles.progressDock} aria-label="Paper illustration progress"><Icon className={active?styles.spinner:undefined} size={22} aria-hidden="true"/><div><strong>{title}</strong><p>{waiting?remaining?`Resumes automatically in ${remaining}`:'Waiting for capacity':phase==='planning'?`Preparing section ${Math.min(sectionsDone+1,sectionsPlanned)} of ${sectionsPlanned}`:'Your paper stays readable while this finishes.'}</p></div></aside>,document.body)}
 </>;
}
