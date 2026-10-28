'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { BookOpen, Bookmark, ChevronDown, Columns2, Focus, Search, Settings2, X, Download, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { ContextualQuestion } from '../contextual-question';
import type { SourceDocument } from '@/shared/schema';
import type {ScientificExperienceInputEntry} from '@/shared/scientific-experience';
import { validateSnapshot } from '@/shared/schema';
import { engineRegistry } from '@/lib/engines';
import { validateWidgetEnvelope } from '@/shared/widgets';
import { encodeWidgetSnapshot } from '@/lib/widgets/compatibility';
import type { BundleAttribution } from '@/lib/snapshots';
import { createImportStorage } from '@/lib/import-storage';
import { preparedPapers } from '@/data/papers';
import { useReadingSession } from '../reading-session';
import { usePersonalNotes } from './notes-state';
import { OriginalPdfPage } from './original-pdf-page';
import {
  authoredExplanation, buildSearchEntries, createPersonalNote, defaultReadingPreferences, exportNotesBundle, glossaryFor,
  noteLocation, parseNotesBundle, PREFERENCES_KEY, readNotes, readingPreferencesSchema, saveNotes, sourceText,
  type PersonalNote, type ReadingPreferences as Preferences, type SearchEntry,
} from '@/lib/reading/personal';

function preservePosition(action: () => void) {
  const blocks = [...document.querySelectorAll<HTMLElement>('.research-article .source-block')];
  const visible = blocks.find(item => item.getBoundingClientRect().bottom > 145); const top = visible?.getBoundingClientRect().top;
  action();
  requestAnimationFrame(() => requestAnimationFrame(() => { if (visible?.isConnected && top !== undefined) window.scrollBy({ top: visible.getBoundingClientRect().top - top, behavior: 'instant' }); }));
}
function applyPreferences(value: Preferences) {
  const element = document.documentElement; element.style.setProperty('--reading-font', `${value.fontSize}px`); element.style.setProperty('--reading-measure', `${value.measure}ch`); element.style.setProperty('--reading-leading', String(value.lineHeight));
  element.dataset.readingTheme = value.theme; element.dataset.focusReading = String(value.focus);
}
export function ReadingPreferences() {
  const [value, setValue] = useState(defaultReadingPreferences); const [open, setOpen] = useState(false); const [warning, setWarning] = useState('');
  useEffect(() => { const header = document.querySelector('.app-header'); if (!header) return; const resize = () => document.documentElement.style.setProperty('--app-header-height', `${header.getBoundingClientRect().height}px`); resize(); const observer = new ResizeObserver(resize); observer.observe(header); return () => observer.disconnect(); }, []);
  useEffect(() => {
    try { const raw = localStorage.getItem(PREFERENCES_KEY); const next = raw ? readingPreferencesSchema.parse(JSON.parse(raw)) : defaultReadingPreferences; setValue(next); applyPreferences(next); }
    catch { setWarning('Reading preferences could not be restored. The default reading style is available.'); applyPreferences(defaultReadingPreferences); }
  }, []);
  function update(change: Partial<Preferences>) { const next = readingPreferencesSchema.parse({ ...value, ...change }); preservePosition(() => { setValue(next); applyPreferences(next); }); try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)); } catch { setWarning('Preferences changed for this visit, but could not be saved.'); } }
  useEffect(() => { const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && value.focus && !document.querySelector('[role="dialog"]')) update({ focus: false }); }; window.addEventListener('keydown', onEscape); return () => window.removeEventListener('keydown', onEscape); }, [value]);
  return <><Button variant="outline" aria-label="Reading settings" onClick={() => setOpen(true)}><Settings2 size={17}/><span className="reading-button-label">Reading</span></Button><Button variant="ghost" aria-pressed={value.focus} onClick={() => update({ focus: !value.focus })} aria-label={value.focus ? 'Leave focus reading' : 'Enter focus reading'}><Focus size={17}/><span className="reading-button-label">{value.focus ? 'Exit focus' : 'Focus'}</span></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reader-dialog"><DialogTitle>Make the paper comfortable</DialogTitle><DialogDescription>These preferences stay in this browser. Changing the presentation never changes the source text or calls Meta.</DialogDescription>
      <fieldset className="reader-fieldset"><legend>Paper text</legend><div className="reader-choice">{([18,20,22] as const).map(size => <Button key={size} variant={value.fontSize === size ? 'secondary' : 'outline'} aria-pressed={value.fontSize === size} onClick={() => update({ fontSize: size })}>{size} px</Button>)}</div></fieldset>
      <label className="reader-field">Line width <output>{value.measure} characters</output><input aria-label="Reading line width" type="range" min={55} max={75} value={value.measure} onChange={event => update({ measure: Number(event.target.value) })}/></label>
      <label className="reader-field">Line spacing <output>{value.lineHeight.toFixed(2)}</output><input aria-label="Reading line spacing" type="range" min={1.55} max={1.85} step={0.05} value={value.lineHeight} onChange={event => update({ lineHeight: Number(event.target.value) })}/></label>
      <fieldset className="reader-fieldset"><legend>Appearance</legend><div className="reader-choice">{(['light','sepia','contrast'] as const).map(theme => <Button key={theme} variant={value.theme === theme ? 'secondary' : 'outline'} aria-pressed={value.theme === theme} onClick={() => update({ theme })}>{theme === 'contrast' ? 'High contrast' : theme === 'sepia' ? 'Sepia' : 'Light'}</Button>)}</div></fieldset>
      <p className="reader-hint">Focus mode hides the research desk while preserving source navigation. Press Escape to leave it.</p><Button variant="outline" onClick={() => update(defaultReadingPreferences)}>Reset reading preferences</Button>{warning && <p role="status">{warning}</p>}
    </DialogContent></Dialog></>;
}

export function ReadingNavigator({ source }: { source: SourceDocument }) {
  const headings = source.blocks.filter(block => block.kind === 'heading'); const [active, setActive] = useState(headings[0]?.id ?? source.blocks[0].id);
  useEffect(() => {
    let frame = 0; const update = () => { frame = 0; const ids = headings.map(block => ({ block, top: document.getElementById(`source-${source.id}-${block.id}`)?.getBoundingClientRect().top ?? Infinity })); const current = ids.filter(item => item.top <= 180).at(-1)?.block.id ?? headings[0]?.id ?? source.blocks[0].id; setActive(current);
      for (const link of document.querySelectorAll<HTMLAnchorElement>('.contents a')) { const selected = link.hash === `#source-${source.id}-${current}`; if (selected) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current'); }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); }; update(); window.addEventListener('scroll', onScroll, { passive: true }); return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [source.id, source.sourceVersion]);
  const index = Math.max(0, headings.findIndex(block => block.id === active)); const current = headings[index];
  return <nav className="reader-navigation" aria-label="Reading position"><details><summary><BookOpen size={16}/><span>{current?.kind === 'heading' ? current.text : 'Source passages'}</span><ChevronDown size={15}/></summary><ol>{headings.map((block, i) => <li key={block.id}><a aria-current={active === block.id ? 'location' : undefined} href={`#source-${source.id}-${block.id}`} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); requestAnimationFrame(() => document.getElementById(`source-${source.id}-${block.id}`)?.focus()); }}><span>{i + 1}</span>{block.kind === 'heading' ? block.text : ''}</a></li>)}</ol></details><div className="reader-quick-actions"><Button variant="ghost" aria-label="Open notes" title="Notes" onClick={()=>window.dispatchEvent(new CustomEvent('paperplay:open-desk',{detail:{documentId:source.id,tab:'notes'}}))}><Bookmark size={17}/><span>Notes</span></Button><Button variant="ghost" aria-label="Search papers" title="Search" onClick={()=>window.dispatchEvent(new CustomEvent('paperplay:open-desk',{detail:{documentId:source.id,tab:'search'}}))}><Search size={17}/><span>Search</span></Button><Button variant="ghost" aria-label="Add interactive figures" title="Add figures" onClick={()=>window.dispatchEvent(new CustomEvent('paperplay:open-planner',{detail:{documentId:source.id}}))}><Sparkles size={17}/><span>Figures</span></Button></div><span className="reader-progress">{headings.length ? `Section ${index + 1} / ${headings.length}` : `${source.blocks.length} source passages`}</span></nav>;
}

function selectedQuote(source: SourceDocument, blockId: string) {
  const selected = window.getSelection(); const element = document.getElementById(`source-${source.id}-${blockId}`); const quote = selected?.toString().trim();
  return quote && quote.length <= 1000 && selected?.anchorNode && selected.focusNode && element?.contains(selected.anchorNode) && element.contains(selected.focusNode) ? quote : undefined;
}
export function PassageTools({ source, blockId }: { source: SourceDocument; blockId: string }) {
  const [open, setOpen] = useState(false); const { notes, warning: notebookWarning } = usePersonalNotes(); const [message, setMessage] = useState(''); const [text, setText] = useState(''); const [term, setTerm] = useState(''); const [kind, setKind] = useState<PersonalNote['kind']>('note'); const [quote, setQuote] = useState('');
  const [layer, setLayer] = useState<'intuition'|'example'|'technical'|'assumptions'>('intuition'); const [definitionIndex,setDefinitionIndex] = useState(-1); const [glossaryOpen,setGlossaryOpen] = useState(false); const returnToPassage = useRef<string|null>(null); const session = useReadingSession();
  const block = source.blocks.find(item => item.id === blockId); const explanation = authoredExplanation(source, blockId); const entries = glossaryFor(source, blockId, notes);
  useEffect(() => { const element = document.getElementById(`source-${source.id}-${blockId}`); element?.classList.toggle('has-personal-highlight', notes.some(note => note.kind === 'highlight' && note.blockId === blockId && noteLocation(note,source) === 'resolved')); return () => element?.classList.remove('has-personal-highlight'); }, [notes,source,blockId]);
  function start() { setQuote(selectedQuote(source, blockId) ?? (block ? sourceText(block).slice(0,600) : '')); setOpen(true); }
  function showDefinition(index: number) { setDefinitionIndex(index);setGlossaryOpen(true);setQuote(block?sourceText(block).slice(0,600):'');setOpen(true); }
  useEffect(() => {
    if(!entries.length)return; const element=document.getElementById(`source-${source.id}-${blockId}`);if(!element)return;
    const aliases=(term:string)=>term.startsWith('α')?['α','alpha']:term.startsWith('β')?['β','beta']:term.startsWith('λ')?['λ','λᵢ','lambda']:term.startsWith('w')?['w','wᵏ']: [term];
    const selectTerm=()=>{const selected=window.getSelection()?.toString().trim();if(!selected||selected.length>50)return;const index=entries.findIndex(entry=>aliases(entry.term).some(term=>term===selected||term.length>1&&term.toLowerCase()===selected.toLowerCase()));if(index>=0)showDefinition(index);};
    element.addEventListener('dblclick',selectTerm);return()=>element.removeEventListener('dblclick',selectTerm);
  },[source.id,source.sourceVersion,blockId,notes]);
  const selectedDefinition=entries[definitionIndex];

  function save() { try { const matchingWidget = [...document.querySelectorAll<HTMLElement>('[data-widget-snapshot]')].map(element=>{try{return validateWidgetEnvelope(JSON.parse(element.dataset.widgetSnapshot??''),source);}catch{return null;}}).find(item=>item?.source.blockId===blockId)??undefined; const note = createPersonalNote(source, blockId, { quote, text, kind, tags: term.trim() ? [term.trim()] : [], experiment: session?.state.experiment, widgetExperiment: matchingWidget }); saveNotes([...readNotes(),note]); window.dispatchEvent(new Event('paperplay:notes-changed')); setMessage(kind === 'definition' ? 'Scoped definition saved locally.' : 'Passage saved in your local notebook.'); setText(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'The note could not be saved.'); } }
  if (!block) return null;
  return <div className="passage-tools">{entries.length>0&&<div className="passage-symbols" role="group" aria-label={`Defined symbols in passage ${blockId}`}>{entries.slice(0,6).map((entry,index)=><Button key={`${entry.term}:${index}`} variant="ghost" size="sm" aria-label={`Define ${entry.term} in passage ${blockId}`} onClick={()=>showDefinition(index)}>{entry.term}</Button>)}</div>}<Button variant="ghost" size="sm" aria-label={`Explore passage ${blockId}`} onClick={start}><Bookmark size={15}/>Explore passage</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reader-dialog passage-dialog" onCloseAutoFocus={event=>{if(returnToPassage.current){event.preventDefault();const id=returnToPassage.current;returnToPassage.current=null;gotoPassage(source.id,id);}}}><DialogTitle>Read this passage closely</DialogTitle><DialogDescription>Source-linked study aids and your own notes. Original text remains unchanged.</DialogDescription><blockquote className="passage-quotation" tabIndex={0}>{quote}</blockquote>
      <details className="reader-explanation" open={Boolean(explanation)}><summary>Explanation layers</summary>{explanation ? <><div className="reader-choice" role="group" aria-label="Explanation layer">{(['intuition','example','technical','assumptions'] as const).map(key => <Button key={key} variant={layer === key ? 'secondary' : 'outline'} aria-pressed={layer === key} onClick={() => setLayer(key)}>{key === 'example' ? 'Worked example' : key[0].toUpperCase()+key.slice(1)}</Button>)}</div><p>{explanation[layer]}</p><p className="reader-hint">Authored study aid · synthetic worked examples · read alongside this cited passage.</p></> : <p>No authored explanation is available for this passage. The original quote is above; you can record a definition or explicitly ask Meta below.</p>}</details>
      <details className="reader-explanation" open={glossaryOpen} onToggle={event=>setGlossaryOpen(event.currentTarget.open)}><summary>Symbols and terminology ({entries.length})</summary>{entries.length>0&&<label className="reader-field">Select a symbol or term in this passage<select aria-label="Scoped symbol or term" value={definitionIndex} onChange={event=>setDefinitionIndex(Number(event.target.value))}><option value={-1}>Choose a scoped definition</option>{entries.map((entry,index)=><option value={index} key={`${entry.term}:${index}`}>{entry.term} · {entry.provenance}</option>)}</select></label>}{selectedDefinition&&<aside className="selected-definition" aria-live="polite"><h3>{selectedDefinition.term}</h3><p>{selectedDefinition.definition}</p><p className="reader-hint">{selectedDefinition.provenance} · {selectedDefinition.scope} · source version {source.sourceVersion}</p><a href={`#source-${source.id}-${selectedDefinition.blockId}`} onClick={event=>{event.preventDefault();returnToPassage.current=selectedDefinition.blockId;setOpen(false);}}>Return to the defining passage</a></aside>}{entries.length ? <dl className="scoped-glossary">{entries.map((entry,index) => <Fragment key={`${entry.term}:${index}`}><dt>{entry.term}</dt><dd>{entry.definition}<small>{entry.provenance} · {entry.scope} · <a href={`#source-${source.id}-${entry.blockId}`} onClick={event => {event.preventDefault();returnToPassage.current=entry.blockId;setOpen(false);}}>Cited passage</a></small></dd></Fragment>)}</dl> : <p>Definitions are unresolved in this source selection. Add your own scoped definition or ask Meta explicitly; no guessed glossary was generated.</p>}</details>
      <ContextualQuestion source={source} blockId={blockId}/>
      <fieldset className="reader-fieldset"><legend>Save a note or highlight</legend><label className="reader-field">Type<select value={kind} onChange={event => setKind(event.target.value as PersonalNote['kind'])}><option value="note">Personal note</option><option value="highlight">Highlight</option><option value="definition">Scoped definition</option></select></label><label className="reader-field">{kind === 'definition' ? 'Term' : 'Tag (optional)'}<input value={term} maxLength={60} onChange={event => setTerm(event.target.value)}/></label><label className="reader-field">Your {kind === 'definition' ? 'definition' : 'note'}<textarea value={text} maxLength={8000} onChange={event => setText(event.target.value)} placeholder={kind === 'highlight' ? 'Optional comment on this highlighted passage' : 'Record your question or observation'}/></label><p className="reader-hint">Stored only in this browser, with the selected quote and source version. Select text in the passage before opening this panel to narrow the highlight.</p><Button onClick={save}>Save locally</Button></fieldset>{(message || notebookWarning) && <p role="status">{message || notebookWarning}</p>}
    </DialogContent></Dialog>
  </div>;
}

export function DeferredFigure({ children, title, id }: { children: ReactNode; title: string; id: string }) {
  const [expanded, setExpanded] = useState(true);
  const [near, setNear] = useState(false);
  const target = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!target.current || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: '400px' });
    observer.observe(target.current); return () => observer.disconnect();
  }, [id]);
  useEffect(() => {
    const show = () => { setExpanded(true); setNear(true); requestAnimationFrame(() => document.getElementById(id)?.focus()); };
    const reveal = () => { if (location.hash === `#${id}`) show(); };
    const click = (event: MouseEvent) => { const link = (event.target as Element)?.closest?.('a'); if (link?.getAttribute('href') === `#${id}`) show(); };
    reveal(); window.addEventListener('hashchange', reveal); document.addEventListener('click',click);
    return () => { window.removeEventListener('hashchange',reveal); document.removeEventListener('click',click); };
  },[id]);
  return <section ref={target} className="reading-figure" data-figure-id={id} onKeyDown={event => { if (event.key === 'Escape' && expanded && !document.querySelector('[role="dialog"]')) { event.stopPropagation(); setExpanded(false); requestAnimationFrame(() => toggle.current?.focus()); } }}>
    <div className="reading-figure-heading" id={expanded && near ? undefined : id} tabIndex={-1}><strong>{title}</strong><Button ref={toggle} variant="ghost" aria-expanded={expanded} aria-controls={`${id}-content`} onClick={() => { setExpanded(!expanded); setNear(true); }}>{expanded ? 'Hide figure' : 'Show figure'}</Button></div>
    <div id={`${id}-content`} hidden={!expanded}>{expanded && (near ? children : <p className="reader-hint">Interactive figure loads as you read.</p>)}</div>
  </section>;
}

function downloadText(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function gotoPassage(sourceId: string, blockId: string, openSource?: (id: string) => void) {
  openSource?.(sourceId); let attempts = 0; const id = `source-${sourceId}-${blockId}`;
  const reveal = () => { const element = document.getElementById(id); if (element) { history.replaceState(history.state,'',`${location.pathname}${location.search}#${id}`); element.scrollIntoView({block:'start',behavior:'instant'}); element.focus(); } else if (++attempts < 30) requestAnimationFrame(reveal); }; requestAnimationFrame(reveal);
}

export function ReadingDesk({ source, original, originalName, originalUrl, htmlSource = false, sources, openSource, attribution }: {
  source: SourceDocument; original?: Blob; originalName?: string; originalUrl?: string; htmlSource?: boolean; sources?: SourceDocument[]; openSource?: (id:string)=>void; attribution?: BundleAttribution;
}) {
  const [open,setOpen] = useState(false); const [tab,setTab] = useState<'notes'|'search'|'export'>('notes'); const { notes, warning: notebookWarning } = usePersonalNotes(); const [message,setMessage] = useState('');
  const [query,setQuery] = useState(''); const [results,setResults] = useState<SearchEntry[]>([]); const [indexed,setIndexed] = useState(false); const [indexCount,setIndexCount] = useState(0); const [searchBusy,setSearchBusy] = useState(false);
  const worker = useRef<Worker|null>(null); const revision = useRef(0); const importFile = useRef<HTMLInputElement>(null); const session = useReadingSession();
  const [includeSource,setIncludeSource] = useState(false); const [includeNotes,setIncludeNotes] = useState(false); const [includePdf,setIncludePdf] = useState(false); const [exportBusy,setExportBusy] = useState(false);
  const [edit,setEdit] = useState<string|null>(null); const [editText,setEditText] = useState(''); const [editTags,setEditTags] = useState('');
  const returnTarget = useRef<{documentId:string;blockId:string}|null>(null);const originalReturn = useRef<string|null>(null);
  const [originalOpen,setOriginalOpen] = useState(false); const [originalBlock,setOriginalBlock] = useState(source.blocks[0].id); const [pdfUrl,setPdfUrl] = useState<string|undefined>(undefined);
  useEffect(() => {
    let alive = true; let url: string|undefined;
    if (htmlSource) { setPdfUrl(undefined); return; }
    if (!original) { setPdfUrl(originalUrl); return; }
    void original.slice(0,5).text().then(header => { if (!alive) return; if (header !== '%PDF-') { setPdfUrl(undefined); return; } url = URL.createObjectURL(new Blob([original],{type:'application/pdf'})); setPdfUrl(url); });
    return () => { alive = false; if(url) URL.revokeObjectURL(url); };
  },[original,originalUrl,htmlSource]);
  useEffect(() => {
    const show = (event: Event) => { const detail = (event as CustomEvent<{documentId:string;blockId:string}>).detail; if(detail?.documentId===source.id && source.blocks.some(block=>block.id===detail.blockId)) {setOriginalBlock(detail.blockId);setOriginalOpen(true);} };
    window.addEventListener('paperplay:original',show); return () => window.removeEventListener('paperplay:original',show);
  },[source]);
  useEffect(() => {
    if (!open || tab !== 'search') { worker.current?.terminate(); worker.current=null; setIndexed(false); return; }
    let stopped = false; let timeout: ReturnType<typeof setTimeout>; setSearchBusy(true); setIndexed(false); setResults([]);
    void (async()=>{
      try {
        const imported = await createImportStorage().list(); if(stopped)return;
        const all = [...(sources??preparedPapers.map(paper=>paper.document)),...imported.map(record=>record.analysis?.document??record.source),source];
        const unique = [...new Map(all.map(item=>[`${item.id}:${item.sourceVersion}`,item])).values()].slice(0,100);
        if(typeof Worker==='undefined')throw Error('Local search needs browser worker support; no blocking fallback was started.');
        const client=new Worker('/library.worker.mjs?v=reading-1',{type:'module'}); worker.current=client;
        timeout=setTimeout(()=>{client.terminate();setSearchBusy(false);setMessage('Local indexing exceeded five seconds. Narrow the saved library or try again.');},5000);
        client.onmessage=event=>{const result=event.data;if(stopped)return;if(result.kind==='ready'){clearTimeout(timeout);setIndexed(true);setSearchBusy(false);setIndexCount(result.count);if(result.limited)setMessage('Local search currently indexes at most 10,000 entries and 2 million source characters.');}
          else if(result.kind==='results'&&result.id===revision.current){setResults(result.results);setSearchBusy(false);}
          else if(result.kind==='error'){clearTimeout(timeout);setMessage(result.error);setSearchBusy(false);}};
        client.onerror=()=>{clearTimeout(timeout);setSearchBusy(false);setMessage('The local search worker could not start. Source reading and notes remain available.');};
        client.postMessage({kind:'index',id:0,sources:unique,notes:readNotes()});
      } catch(error) {if(!stopped){setSearchBusy(false);setMessage(error instanceof Error?error.message:'Local search is unavailable.');}}
    })();
    return ()=>{stopped=true;clearTimeout(timeout);worker.current?.terminate();worker.current=null;};
  },[open,tab,sources,source,notes]);
  useEffect(()=>{if(!indexed||!worker.current)return;const id=++revision.current;const timer=setTimeout(()=>{setSearchBusy(true);worker.current?.postMessage({kind:'search',id,query});},250);return()=>clearTimeout(timer);},[query,indexed]);
  const currentNotes=notes.filter(note=>note.documentId===source.id);
  function modify(next:PersonalNote[]){try{saveNotes(next);window.dispatchEvent(new Event('paperplay:notes-changed'));setMessage('Notebook saved in this browser.');}catch(error){setMessage(error instanceof Error?error.message:'The notebook could not be saved.');}}
  async function importNotes(file:File){try{const incoming=parseNotesBundle(await file.text());const merged=[...new Map([...notes,...incoming].map(note=>[note.id,note])).values()];modify(merged);setMessage(`Imported ${incoming.length} notes. Changed or missing sources are marked unresolved.`);}catch(error){setMessage(error instanceof Error?error.message:'The notes file could not be imported.');}}
  function restoreExperiment(note:PersonalNote){try{if(note.widgetExperiment){const envelope=validateWidgetEnvelope(note.widgetExperiment,source);location.hash=`widget=${encodeWidgetSnapshot(envelope)}`;setOpen(false);return;}if(!note.experiment)throw Error('This note has no saved experiment.');const snapshot=validateSnapshot(note.experiment,source,engineRegistry);session?.putExperiment(snapshot);session?.putFigure({snapshot,stepIndex:0,selection:''});setMessage('Experiment restored to local reading state. Reload this paper to apply the saved input; no model request was made.');}catch(error){setMessage(error instanceof Error?error.message:'The linked experiment is incompatible.');}}
  async function studyPack(format:'html'|'experience'='html'){setExportBusy(true);try{
    const {captureFigureSvg,createStudyPack}=await import('@/lib/reading/study-pack');
    const figures=[...document.querySelectorAll<HTMLElement>('.research-article .paperplay-figure')].filter(element=>!element.closest('.reference-widget-gallery')).slice(0,64).map(element=>{
      const clone=element.cloneNode(true) as HTMLElement;clone.querySelectorAll('button,input,textarea,select,script,style,.generated-source-quote').forEach(item=>item.remove());
      const view=session?.state.figures.find(item=>item.snapshot.figure.id===element.id);const snapshot=view?.snapshot??(session?.state.experiment?.figure.id===element.id?session.state.experiment:undefined);
      const encodedWidget=element.getAttribute('data-widget-snapshot');const widgetSnapshot=encodedWidget?JSON.parse(encodedWidget):undefined;
      return {title:element.querySelector('h3,h2')?.textContent??'Source-linked figure',text:clone.innerText||clone.textContent||'',svg:[...element.querySelectorAll<SVGElement>('svg[role="img"]')].map(captureFigureSvg),snapshot,widgetSnapshot};
    });
    if(format==='experience'){
      const {createScientificExperience}=await import('@/lib/experiences/bundle');
      const entries:ScientificExperienceInputEntry[]=[];
      figures.forEach((figure,index)=>{
        const capture={title:figure.title,text:figure.text};
        if(figure.widgetSnapshot)entries.push({id:`mounted-${index}`,kind:'widget',widget:figure.widgetSnapshot,capture});
        else if(figure.snapshot)entries.push({id:`mounted-${index}`,kind:'legacy',snapshot:figure.snapshot,capture});
      });
      if(!entries.length)throw Error('Open a figure before exporting an interactive experience. Composed studies and generated figures have their own experience download action.');
      const value=await createScientificExperience({source,entries,includeSource,includeAssets:false,includeResults:true,attribution});
      downloadText(`paperplay-experience-${source.id}.json`,value,'application/json');
      setMessage(`Exported ${entries.length} typed figure(s) with their current data and recorded values.${figures.length>entries.length?` ${figures.length-entries.length} capture(s) without a typed definition stay available in the HTML study pack.`:''} Source inclusion follows your selection; notes and PDF bytes stay in the separate HTML study pack. Reopening creates no model request.`);return;
    }
    let pdf:{name:string;base64:string}|undefined;
    if(includePdf){if(!includeSource||!original||original.size>10*1024*1024||await original.slice(0,5).text()!=='%PDF-')throw Error('Choose source inclusion and an original PDF up to 10 MiB.');const bytes=new Uint8Array(await original.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));pdf={name:originalName??'original.pdf',base64:btoa(binary)};}
    downloadText(`paperplay-study-${source.id}.html`,createStudyPack({source,figures,includeSource,notes:includeNotes?currentNotes:[],original:pdf,attribution,appOrigin:location.origin}),'text/html');setMessage('Study pack exported. Open the HTML locally or print it; included content follows your selections.');
  }catch(error){setMessage(error instanceof Error?error.message:'The study pack could not be exported.');}finally{setExportBusy(false);}}
  useEffect(()=>{const show=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.documentId===source.id&&['notes','search','export'].includes(detail.tab)){setTab(detail.tab);setMessage('');setOpen(true);}};window.addEventListener('paperplay:open-desk',show);return()=>window.removeEventListener('paperplay:open-desk',show);},[source.id]);
  const block=source.blocks.find(item=>item.id===originalBlock)??source.blocks[0];
  return <div className="reading-desk"><div className="reading-desk-bar" role="group" aria-label="Paper actions"><Button onClick={() => window.dispatchEvent(new CustomEvent('paperplay:open-planner', { detail: { documentId: source.id } }))}><Sparkles size={16}/>Add figures</Button><Button variant="outline" onClick={()=>{setTab('notes');setOpen(true);setMessage('');}}><Bookmark size={16}/>Notes{currentNotes.length > 0 && <span className="note-count">{currentNotes.length}</span>}</Button><Button variant="outline" onClick={()=>{setTab('search');setOpen(true);setMessage('');}}><Search size={16}/>Search</Button><Button variant="outline" onClick={()=>{setTab('export');setOpen(true);setMessage('');}}><Download size={16}/>Export</Button><Button variant="ghost" onClick={()=>setOriginalOpen(true)}><Columns2 size={16}/>Original</Button></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reader-dialog desk-dialog" onCloseAutoFocus={event=>{if(returnTarget.current){event.preventDefault();const target=returnTarget.current;returnTarget.current=null;gotoPassage(target.documentId,target.blockId);}}}><DialogTitle>{tab==='notes'?'Your notes':tab==='search'?'Search your papers':'Export a study pack'}</DialogTitle><DialogDescription>Notes, search and study packs stay local. Search and export do not call Meta or automatically upload papers.</DialogDescription><div className="reader-choice" role="group" aria-label="Reading desk view">{(['notes','search','export'] as const).map(item=><Button key={item} variant={tab===item?'secondary':'outline'} aria-pressed={tab===item} onClick={()=>{setTab(item);setMessage('');}}>{item==='notes'?'Notes':item==='search'?'Search':'Export'}</Button>)}</div>
      {tab==='notes'&&<><p className="reader-hint">Use “Explore passage” beside a source passage to save a highlight, note or scoped definition. Saved notes include a quote and the exact source version.</p><div className="reader-choice"><Button variant="outline" onClick={()=>{downloadText(`paperplay-notes-${source.id}.json`,exportNotesBundle(currentNotes),'application/json');setMessage('Exported your notes and their selected source quotations. No original PDF or provider access is included.');}}>Export notes and quotes</Button><Button variant="outline" onClick={()=>importFile.current?.click()}>Import notes</Button><input ref={importFile} className="sr-only" tabIndex={-1} type="file" accept="application/json,.json" aria-label="Import annotation file" onChange={event=>{const file=event.target.files?.[0];if(file)void importNotes(file);event.target.value='';}}/></div>{currentNotes.length===0&&<p>No notes yet for this paper.</p>}<ol className="personal-notes">{currentNotes.map(note=><li key={note.id}><div><strong>{note.kind==='definition'?'Scoped definition':note.kind==='highlight'?'Highlight':'Personal note'}</strong><span>{new Date(note.updatedAt).toLocaleDateString()}</span></div><blockquote>{note.quote}</blockquote>{noteLocation(note,source)!=='resolved'&&<p role="status" className="reader-unresolved">Unresolved: {noteLocation(note,source)==='source-changed'?'the saved source version differs':'the quoted passage is missing'}. The original note is retained.</p>}{edit===note.id?<><label className="reader-field">Note<textarea value={editText} maxLength={8000} onChange={event=>setEditText(event.target.value)}/></label><label className="reader-field">Tags, separated by commas<input value={editTags} onChange={event=>setEditTags(event.target.value)}/></label><Button onClick={()=>{modify(notes.map(item=>item.id===note.id?{...item,text:editText,tags:editTags.split(',').map(x=>x.trim()).filter(Boolean),updatedAt:Date.now()}:item));setEdit(null);}}>Save changes</Button><Button variant="ghost" onClick={()=>setEdit(null)}>Cancel</Button></>:<><p>{note.text||'Highlight without an additional comment.'}</p>{note.tags.length>0&&<p className="reader-hint">{note.tags.join(' · ')}</p>}<div className="reader-choice"><Button variant="outline" disabled={noteLocation(note,source)!=='resolved'} onClick={()=>{returnTarget.current={documentId:source.id,blockId:note.blockId};setOpen(false);gotoPassage(source.id,note.blockId,openSource);}}>Return to passage</Button>{(note.experiment||note.widgetExperiment)&&<Button variant="outline" onClick={()=>restoreExperiment(note)}>Restore linked experiment</Button>}<Button variant="ghost" onClick={()=>{setEdit(note.id);setEditText(note.text);setEditTags(note.tags.join(', '));}}>Edit</Button><Button variant="ghost" onClick={()=>modify(notes.filter(item=>item.id!==note.id))}>Delete note</Button></div></>}</li>)}</ol></>}
      {tab==='search'&&<><label className="reader-field">Search local source text, definitions and notes<input type="search" maxLength={200} value={query} onChange={event=>setQuery(event.target.value)} placeholder="A term, equation fragment or note…"/></label><p className="reader-hint">{searchBusy?'Searching/indexing in a browser worker…':indexed?`${indexCount.toLocaleString()} local entries indexed. Results are passages, not generated search answers.`:'Preparing the local index…'}</p>{searchBusy&&<Button variant="outline" onClick={()=>{worker.current?.terminate();worker.current=null;setIndexed(false);setSearchBusy(false);setMessage('Local search cancelled. Switch tabs and reopen Search library to rebuild the index.');}}>Cancel local search</Button>}<ol className="local-search-results">{results.map(item=><li key={item.id}><strong>{item.title}</strong><p>{item.text}</p><span className="reader-hint">{item.kind} · {item.blockId}</span><Button variant="outline" onClick={()=>{returnTarget.current={documentId:item.documentId,blockId:item.blockId};setOpen(false);gotoPassage(item.documentId,item.blockId,openSource);}}>Open passage</Button></li>)}</ol>{indexed&&query.trim()&&!searchBusy&&results.length===0&&<p>No matching passage in the indexed local sources.</p>}</>}
      {tab==='export'&&<><p>Pause playback and open the figures you want to keep. An experience preserves their typed settings and recorded values for a compatible Paperplay installation. The HTML study pack is a readable, static capture. Figure metadata can include short cited quotations.</p><label className="inclusion-choice"><input type="checkbox" checked={includeSource} onChange={event=>{setIncludeSource(event.target.checked);if(!event.target.checked)setIncludePdf(false);}}/><span>Include original normalized source text <small>Only share material you have permission to redistribute.</small></span></label><Button disabled={exportBusy} onClick={()=>void studyPack('experience')}>{exportBusy?'Capturing visible states…':'Download experience'}</Button><p className="reader-hint">Includes current figure data and parameters. Full source text is optional. Composed studies and generated figures offer this download in their own view.</p><details><summary>Readable HTML, notes and PDF</summary><label className="inclusion-choice"><input type="checkbox" checked={includeNotes} onChange={event=>setIncludeNotes(event.target.checked)}/><span>Include your notes and selected quotations</span></label><label className="inclusion-choice"><input type="checkbox" checked={includePdf} disabled={!includeSource||!original} onChange={event=>setIncludePdf(event.target.checked)}/><span>Include original local PDF <small>{original?'Explicitly embeds the PDF as a downloadable attachment.':'No original local PDF is stored for this source.'}</small></span></label><Button disabled={exportBusy} onClick={()=>void studyPack()}>Download HTML study pack</Button><Button variant="outline" onClick={()=>window.print()}>Print current reading view</Button></details></>}
      {(message||notebookWarning)&&<p role="status">{message||notebookWarning}</p>}
    </DialogContent></Dialog>
    <Dialog open={originalOpen} onOpenChange={setOriginalOpen}><DialogContent className="reader-dialog original-dialog" onCloseAutoFocus={event=>{if(originalReturn.current){event.preventDefault();const id=originalReturn.current;originalReturn.current=null;gotoPassage(source.id,id);}}}><DialogTitle>{htmlSource?'Original source reference':'Compare with the original PDF'}</DialogTitle><DialogDescription>{htmlSource?'HTML references are logical locations, not physical PDF pages.':'The original PDF pixels stay beside the selected quotation. Extraction regions appear only when their coordinate mapping is available.'}</DialogDescription><label className="reader-field">Source passage<select value={originalBlock} onChange={event=>setOriginalBlock(event.target.value)}>{source.blocks.map(item=><option key={item.id} value={item.id}>{htmlSource?'HTML':`p. ${item.page}`} · {sourceText(item).slice(0,80)}</option>)}</select></label><blockquote className="passage-quotation" tabIndex={0}>{sourceText(block).slice(0,1000)}</blockquote>{!htmlSource&&(pdfUrl||original)?<OriginalPdfPage source={source} blockId={block.id} original={original} url={originalUrl}/>:<p>The original is available through its source link; no physical PDF page view is claimed.</p>}{(htmlSource?originalUrl:pdfUrl)&&<a href={htmlSource?originalUrl:`${pdfUrl!.split('#')[0]}#page=${block.page}`} target="_blank" rel="noreferrer">Open original {htmlSource?'article':`page ${block.page}`} in a separate tab</a>}{block.reconstruction&&<details><summary>Extraction provenance for this passage</summary><p>{block.reconstruction.notice??'Source reconstruction metadata; consult the original for uncertain structure.'}</p><p>Confidence: {block.reconstruction.confidence}. Operations: {block.reconstruction.operations.join(', ')||'none'}.</p><pre className="raw-extraction">{block.reconstruction.rawText}</pre></details>}<Button variant="outline" onClick={()=>{originalReturn.current=block.id;setOriginalOpen(false);}}>Return to this passage</Button></DialogContent></Dialog>
  </div>;
}

export function openOriginal(source: SourceDocument, blockId: string) { window.dispatchEvent(new CustomEvent('paperplay:original',{detail:{documentId:source.id,blockId}})); }
