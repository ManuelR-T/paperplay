'use client';

import {useEffect,useRef,useState} from 'react';
import {BookOpen,ChevronDown,ChevronLeft,ChevronRight,Images,NotebookPen,Search} from 'lucide-react';
import {Button} from '../ui/button';
import type {SourceDocument} from '@/shared/schema';
import './reading-navigator.css';

type FigureLink={node:HTMLElement;title:string};
export function ReadingNavigator({source}:{source:SourceDocument}){
 const headings=source.blocks.filter(block=>block.kind==='heading');
 const [active,setActive]=useState(headings[0]?.id??source.blocks[0].id),[figures,setFigures]=useState<FigureLink[]>([]);
 const figureMenu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  let frame=0;const update=()=>{frame=0;const threshold=(document.querySelector('.reader-navigation')?.getBoundingClientRect().bottom??130)+24;
   const current=headings.filter(b=>(document.getElementById(`source-${source.id}-${b.id}`)?.getBoundingClientRect().top??Infinity)<=threshold).at(-1)?.id??headings[0]?.id??source.blocks[0].id;setActive(current);
   for(const link of document.querySelectorAll<HTMLAnchorElement>('.contents a')){if(link.hash===`#source-${source.id}-${current}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  };
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};update();window.addEventListener('scroll',scroll,{passive:true});return()=>{window.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);};
 },[source.id,source.sourceVersion]);
 useEffect(()=>{
  let frame=0;const collect=()=>{frame=0;const article=document.querySelector('.research-article');
   const next=Array.from(article?.querySelectorAll<HTMLElement>('[aria-label^="Interactive figure:"],[aria-label^="Custom Meta figure:"]')??[]).map(node=>({node,title:(node.getAttribute('aria-label')??'Figure').replace(/^(?:Interactive figure|Custom Meta figure):\s*/, '')}));
   setFigures(previous=>previous.length===next.length&&previous.every((f,i)=>f.node===next[i].node&&f.title===next[i].title)?previous:next);
  };
  const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(collect);});observer.observe(document.querySelector('.main-workspace')??document.body,{childList:true,subtree:true});collect();return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[source.id,source.sourceVersion]);
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){const open=document.querySelector<HTMLDetailsElement>('.reader-navigation details[open]');if(open){open.open=false;open.querySelector('summary')?.focus();}}};const outside=(event:PointerEvent)=>{if(!(event.target as Element)?.closest('.reader-navigation details'))document.querySelectorAll<HTMLDetailsElement>('.reader-navigation details[open]').forEach(menu=>menu.open=false);};window.addEventListener('keydown',close);document.addEventListener('pointerdown',outside);return()=>{window.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);};},[]);
 const index=Math.max(0,headings.findIndex(b=>b.id===active)),current=headings[index];
 function go(id:string){document.querySelector('.reader-outline')?.removeAttribute('open');const target=document.getElementById(`source-${source.id}-${id}`);if(!target)return;target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true});history.replaceState(history.state,'',`${location.pathname}${location.search}#${target.id}`);}
 function openFigure(figure:FigureLink){if(!figure.node.isConnected)return;figureMenu.current?.removeAttribute('open');figure.node.querySelector<HTMLButtonElement>('.reading-figure-heading button[aria-expanded=false]')?.click();figure.node.scrollIntoView({block:'start',behavior:'instant'});figure.node.tabIndex=-1;figure.node.focus({preventScroll:true});}
 function desk(tab:'notes'|'search'){window.dispatchEvent(new CustomEvent('paperplay:open-desk',{detail:{documentId:source.id,tab}}));}
 const previous=headings[index-1],next=headings[index+1];
 return <nav className="reader-navigation" aria-label="Reading position">
  <details className="reader-outline" onToggle={event=>{if(event.currentTarget.open)figureMenu.current?.removeAttribute('open');}}><summary><BookOpen size={16}/><span>{current?.kind==='heading'?current.text:'Source passages'}</span><ChevronDown size={15}/></summary><ol>{headings.map((block,i)=><li key={block.id}><a href={`#source-${source.id}-${block.id}`} aria-current={active===block.id?'location':undefined} onClick={event=>{event.preventDefault();event.currentTarget.closest('details')?.removeAttribute('open');go(block.id);}}><span>{i+1}</span>{block.text}</a></li>)}<li className="reader-outline-actions"><Button variant="ghost" disabled={!previous} onClick={()=>{if(previous)go(previous.id);}}><ChevronLeft size={16}/>Previous section</Button><Button variant="ghost" disabled={!next} onClick={()=>{if(next)go(next.id);}}>Next section<ChevronRight size={16}/></Button></li></ol></details>
  <div className="reader-section-actions"><Button variant="ghost" size="icon" aria-label="Previous section" disabled={!previous} onClick={()=>{if(previous)go(previous.id);}}><ChevronLeft size={17}/></Button><Button variant="ghost" size="icon" aria-label="Next section" disabled={!next} onClick={()=>{if(next)go(next.id);}}><ChevronRight size={17}/></Button></div>
  <div className="reader-quick-actions">
   <div className="reader-status-slot" data-reader-status-slot/>
   <details ref={figureMenu} className="reader-figure-menu" onToggle={event=>{if(event.currentTarget.open)document.querySelector('.reader-outline')?.removeAttribute('open');}}><summary aria-label={`Figures in this paper: ${figures.length}`} title="Figures in this paper"><Images size={17}/><span className="reader-figure-count">{figures.length}</span></summary><div className="reader-figure-popover"><strong>Illustrations in this paper</strong>{figures.length?<ol>{figures.map((figure,i)=><li key={i}><button onClick={()=>openFigure(figure)}><span>{String(i+1).padStart(2,'0')}</span>{figure.title}</button></li>)}</ol>:<p>Illustrations appear here as they are prepared. You can keep reading.</p>}</div></details>
   <Button variant="ghost" aria-label="Open notes" title="Notes" onClick={()=>desk('notes')}><NotebookPen size={17}/><span>Notes</span></Button><Button variant="ghost" aria-label="Search in your library" title="Search library" onClick={()=>desk('search')}><Search size={17}/><span>Library search</span></Button>
  </div><span className="reader-progress">{headings.length?`${index+1} / ${headings.length}`:`${source.blocks.length} passages`}</span>
 </nav>;
}
