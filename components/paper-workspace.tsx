'use client';
import {ExecutionMonitor} from './execution-monitor';
import { OriginalSourceFigure } from './reading/original-source-figure';
import {SourceMath} from './reading/source-math';
import {copySourceMathSelection} from '@/lib/reading/source-math-copy';
import { SourceInformation } from './reading/source-information';

import { useEffect, useState, useRef, useMemo } from 'react';
import katex from 'katex';
import { ArrowUpRight, BookOpen, CircleHelp, FilePlus2, FileText, GitBranch, Layers3, PanelLeft, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './reading/mobile-desk.css';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { preparedPapers, type PreparedPaper } from '@/data/papers';
import { validateSnapshot, type ExperimentSnapshot, type SourceDocument } from '@/shared/schema';
import { engineRegistry } from '@/lib/engines';
import { GeneratedFigureView } from './figures/generated-figure';
import { useImportController } from '@/lib/use-import-controller';
import { ImportDialog, ImportProgress } from './import-tools';
import { ImportedPaperReader } from './imported-paper';
import { ReadingSession, useReadingSession } from './reading-session';
import { listRecentPapers, deleteReadingState, snapshotFromPrepared, saveReadingState, type RecentPaper } from '@/lib/reading-state';
import { decodePublicSnapshot, parseExperimentBundle, validatePreparedSnapshot } from '@/lib/snapshots';
import { createImportStorage } from '@/lib/import-storage';
import { ANALYSIS_PIPELINE_VERSION } from '@/shared/import-types';
import { ReadingPreferences, ReadingNavigator, ReadingDesk, PassageTools, DeferredFigure, openOriginal } from './reading/reader-tools';
import {AutomaticPaperEnhancement} from './automatic-paper';
import { ResearchWorkbench } from './research-workbench';
import {checkPendingSourcePlans,forgetSourceWidgets}from'@/lib/experiments/source-removal';
import { peekWidgetLocation } from '@/lib/experiments/widget-location';
import Link from 'next/link';
import {PaperplayMark} from './paperplay-mark';
import { arxivPaperSchema } from '@/shared/explore';

const labels: Record<string, { label: string; detail: string }> = {
  'priority-search-trees': { label: 'Priority & shortest paths', detail: 'Graph algorithms · ITP 2019' },
  'quadratic-optimization': { label: 'Curvature & momentum', detail: 'Numerical optimization · Distill 2017' },
  'adaptive-mergesort': { label: 'Adaptive merging', detail: 'Sorting algorithms · ESA 2018' },
};
const importStageLabel:Record<string,string>={ready:'Ready to read',complete:'With figures',extracting:'Opening source',preparing:'Preparing source',submitting:'Requesting figures',queued:'Figures queued',analyzing:'Preparing figures',validating:'Checking figures',failed:'Needs attention',cancelled:'Paused',uncertain:'Check request',expired:'Request expired'};
function sourceId(paper: PreparedPaper, blockId: string) { return `source-${paper.document.id}-${blockId}`; }

export default function PaperWorkspace() {
  const [selected, setSelected] = useState(preparedPapers[0].id);
  const [initialized, setInitialized] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [transferMessage, setTransferMessage] = useState('');
  const [recents, setRecents] = useState<RecentPaper[]>([]);
  const bundleInput = useRef<HTMLInputElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const explorationOpened = useRef(false);
  const [discoveryPending,setDiscoveryPending]=useState(true);
  const [automaticSuppressed,setAutomaticSuppressed]=useState(false);
  const [explicitSnapshotId,setExplicitSnapshotId]=useState<string|null>(null);
  const imports = useImportController();
  const [metaConfigured, setMetaConfigured] = useState<boolean | null>(null);
  const paper = preparedPapers.find(item => item.id === selected) ?? preparedPapers[0];
  const activeSource = imports.current?.analysis?.document ?? imports.current?.source ?? paper.document;
  const allSources = useMemo(() => [...preparedPapers.map(item => item.document), ...imports.records.map(record => record.analysis?.document ?? record.source)], [imports.records]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal }).then(response => response.json()).then(data => {
      if (typeof data.meta?.configured === 'boolean') setMetaConfigured(data.meta.configured);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  function applySnapshot(snapshot: ExperimentSnapshot, source: SourceDocument) {
    setExplicitSnapshotId(snapshot.figure.id);
    const prepared = preparedPapers.find(item => item.document.id === source.id);
    let experiment: ExperimentSnapshot | undefined;
    if (prepared && snapshot.figure.id === `${prepared.id}-primary`) experiment = snapshot;
    else if (prepared && snapshot.figure.kind === 'plot' && snapshot.figure.execution.mode === 'computed') {
      const binding = snapshot.figure.execution.binding;
      experiment = snapshotFromPrepared(prepared, { seed: snapshot.seed, input: snapshot.figure.input, engineId: binding.engineId, parameters: binding.parameters });
    }
    else if (prepared && snapshot.figure.kind === 'comparison') {
      const binding = snapshot.figure.runs[0].binding;
      experiment = snapshotFromPrepared(prepared, { seed: snapshot.seed, input: snapshot.figure.input, engineId: binding.engineId, parameters: binding.parameters });
    }
    const saved = saveReadingState({ schemaVersion: 1, documentId: source.id, sourceVersion: source.sourceVersion, updatedAt: Date.now(), position: { scrollY: 0, figureId: snapshot.figure.id },
      experiment,
      figures: [{ snapshot, stepIndex: 0, selection: '' }] }, source);
    if (saved.warning) throw new Error(saved.warning);
    try { localStorage.removeItem(`paperplay:anchor-offset:${source.id}:${source.sourceVersion}`); } catch { /* An incoming snapshot still has its own source position. */ }
    setSessionVersion(value => value + 1); setRecents(listRecentPapers());
  }
  function routeWidgetHash() {
    setExplicitSnapshotId(null);
    const reference = peekWidgetLocation(location.hash.slice('#widget='.length));
    if (reference.documentId.startsWith('gallery-')) {
      setTransferMessage('Opening a source-linked reference-gallery widget. The link contains its configuration, not an imported PDF. No model request was made.');
      return;
    }
    const prepared = preparedPapers.find(item => item.document.id === reference.documentId && item.document.sourceVersion === reference.sourceVersion);
    const imported = imports.records.find(item => item.source.id === reference.documentId && item.source.sourceVersion === reference.sourceVersion);
    if (!prepared && !imported) throw new Error('This shared widget needs its matching source version. Import that source on this browser first; a widget URL does not transfer a locally stored PDF.');
    if (imports.busy && imports.current?.source.id !== reference.documentId) throw new Error('Finish or cancel the running import before opening a widget from another source.');
    if (prepared) { setSelected(prepared.id); imports.select(''); } else imports.select(imported!.id);
    setTransferMessage('Opening the shared widget with its matching source. Configuration is validated before activation; no model request was made.');
  }
  useEffect(() => {
    if (!imports.loaded || initialized) return;
    setAutomaticSuppressed(location.hash.startsWith('#snapshot=')||location.hash.startsWith('#widget='));
    try {
      if (location.hash.startsWith('#widget=')) { routeWidgetHash(); }
      else if (location.hash.startsWith('#snapshot=')) {
        const shared = decodePublicSnapshot(location.hash.slice('#snapshot='.length));
        applySnapshot(shared.snapshot, shared.paper.document); setSelected(shared.paper.id); imports.select('');
        window.history.replaceState(window.history.state, '', location.pathname + location.search);
        setTransferMessage('Public snapshot restored. Input, seed and method match the shared experiment. No model request was made.');
      } else {
        const recent = listRecentPapers(); setRecents(recent);
        const latest = recent[0];
        const prepared = preparedPapers.find(item => item.document.id === latest?.documentId && item.document.sourceVersion === latest.sourceVersion);
        if (prepared) { setSelected(prepared.id); if (!imports.busy) imports.select(''); }
        else if (latest && imports.records.some(record => record.source.id === latest.documentId && record.source.sourceVersion === latest.sourceVersion) && !imports.busy) imports.select(latest.documentId);
      }
    } catch (error) { setTransferMessage(error instanceof Error ? error.message : 'The shared experiment could not be restored.'); }
    setInitialized(true);
  }, [imports.loaded, initialized]);
  useEffect(() => {
    if (!initialized) return;
    function openSharedHash() {
      if (!location.hash.startsWith('#snapshot=') && !location.hash.startsWith('#widget=')) return;
      setAutomaticSuppressed(true);
      try {
        if (location.hash.startsWith('#widget=')) { routeWidgetHash(); return; }
        const shared = decodePublicSnapshot(location.hash.slice('#snapshot='.length));
        applySnapshot(shared.snapshot, shared.paper.document); setSelected(shared.paper.id); imports.select('');
        window.history.replaceState(window.history.state, '', location.pathname + location.search);
        setTransferMessage('Public snapshot restored. Input, seed and method match the shared experiment. No model request was made.');
      } catch (error) { setTransferMessage(error instanceof Error ? error.message : 'The shared snapshot could not be opened.'); }
    }
    window.addEventListener('hashchange', openSharedHash);
    return () => window.removeEventListener('hashchange', openSharedHash);
  }, [initialized, imports.select, imports.records]);
  useEffect(() => {
    if (!initialized || !imports.loaded || explorationOpened.current) return;
    const url = new URL(location.href);
    const input = url.searchParams.get('arxiv');
    if (!input) {explorationOpened.current=true;setDiscoveryPending(false);return;}
    explorationOpened.current = true;
    setExplicitSnapshotId(null);
    url.searchParams.delete('arxiv');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    const parsed = arxivPaperSchema.shape.id.safeParse(input);
    if (!parsed.success) { setTransferMessage('This discovery link needs a valid, versioned arXiv identifier. Select a paper to continue.'); return; }
    const existing = imports.records.find(record => record.source.source.kind === 'arxiv' &&
      [record.originalUrl, record.source.source.url].some(value => value && new URL(value).pathname.replace(/^\/(abs|html|pdf)\//, '').replace(/\.pdf$/, '') === parsed.data));
    if (existing) { imports.select(existing.id);setDiscoveryPending(false); setTransferMessage('Opened the saved source. Meta reuses its figures or prepares the remaining automatic illustrations.'); }
    else {
      setTransferMessage('Opening your arXiv paper. Meta will choose and place illustrations automatically; saved figures are reused.');
      void imports.importArxiv(parsed.data, { analyze: false }).then(id=>{if(id)setDiscoveryPending(false);});
    }
  }, [initialized, imports.loaded, imports.records, imports.importArxiv, imports.select]);
  async function openBundle(file: File) {
    setTransferMessage('');
    try {
      if (imports.busy) throw new Error('Finish the running import before opening a bundle.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a bundle smaller than 20 MiB.');
      const bundle = await parseExperimentBundle(await file.text(), { sources: imports.records.map(record => record.analysis?.document ?? record.source) });
      if (!bundle.source || bundle.missingSource) throw new Error('This metadata-only bundle needs its matching source on this browser. Import the original source, or ask for an export that includes source text.');
      setAutomaticSuppressed(true);
      const prepared = preparedPapers.find(item => item.document.id === bundle.snapshot.documentId);
      if (prepared) {
        validatePreparedSnapshot(bundle.snapshot, prepared);
        applySnapshot(bundle.snapshot, prepared.document); imports.select(''); setSelected(prepared.id);
      } else {
        const existing = imports.records.find(record => record.id === bundle.source!.id);
        const source = existing?.analysis?.document ?? existing?.source ?? bundle.source;
        validateSnapshot(bundle.snapshot, source, engineRegistry);
        if (existing) await createImportStorage().put({ ...existing, original: existing.original ?? bundle.original, originalName: existing.originalName ?? bundle.originalName, attribution: existing.attribution ?? bundle.attribution, updatedAt: Date.now() });
        else await createImportStorage().put({ source, original: bundle.original, originalName: bundle.originalName, id: source.id, stage: 'ready', pipelineVersion: ANALYSIS_PIPELINE_VERSION, updatedAt: Date.now(), attribution: bundle.attribution });
        applySnapshot(bundle.snapshot, source); await imports.refresh(); imports.select(source.id);
      }
      window.history.replaceState(window.history.state, '', location.pathname + location.search);
      setTransferMessage(`Opened ${bundle.contents} bundle. Attribution retained; no new model request was made.`);
    } catch (error) { setTransferMessage(error instanceof Error ? error.message : 'The bundle could not be opened.'); }
    finally { if (bundleInput.current) bundleInput.current.value = ''; }
  }
  async function removePaper(id: string) {
    const existing=imports.records.find(record=>record.id===id);
    try{if(existing){const pending=await checkPendingSourcePlans(existing.source,localStorage);if(pending?.uncertain)setTransferMessage('An unconfirmed Meta request may still exist. Removing the local paper does not cancel work without a saved job reference.');}}catch(error){setTransferMessage(error instanceof Error?error.message:'The saved figure plan could not be checked; the source was retained.');return;}
    await imports.remove(id);
    if (await createImportStorage().get(id)) return;
    try{await forgetSourceWidgets(id,localStorage);}catch{setTransferMessage('The paper was removed, but some cached widget settings could not be cleared. Personal notes remain as unresolved notebook records.');}
    const result = deleteReadingState(id); if (result.warning) setTransferMessage(result.warning);
    setRecents(listRecentPapers());
  }
  function reopen(id: string) {
    const prepared = preparedPapers.find(item => item.document.id === id);
    const imported = imports.records.find(record => record.id === id);
    if(!prepared&&!imported){setTransferMessage('This recent source is no longer stored on this browser. Import it again to restore compatible settings.');return;}
    setExplicitSnapshotId(null);setDiscoveryPending(false);setAutomaticSuppressed(false);
    if (prepared) choose(prepared.id); else imports.select(imported!.id);
  }
  async function importForReading(start:()=>Promise<string|undefined>){
    // Close automatic preparation for the old source before extraction starts. A failed/cancelled import keeps it closed.
    setDiscoveryPending(true);setAutomaticSuppressed(false);setExplicitSnapshotId(null);
    const id=await start();if(id)setDiscoveryPending(false);return id;
  }
  useEffect(() => {
    let timer: number | undefined;
    const update = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setRecents(listRecentPapers()), 300); };
    window.addEventListener('paperplay:reading-saved', update);
    return () => { window.clearTimeout(timer); window.removeEventListener('paperplay:reading-saved', update); };
  }, []);
  const [deskOpen,setDeskOpen]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(min-width:761px)');const close=()=>{if(media.matches)setDeskOpen(false);};media.addEventListener('change',close);return()=>media.removeEventListener('change',close);},[]);
  function choose(id: string) { setExplicitSnapshotId(null);setDiscoveryPending(false);setAutomaticSuppressed(false);imports.select(''); setSelected(id); window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); }
  const desk=<aside className="sidebar" aria-label="Reading workspace" onClick={event=>{if((event.target as HTMLElement).closest('a,button'))setDeskOpen(false);}}><Link href="/explore" className="workspace-explore-link"><BookOpen size={18}/><span>Explore arXiv<small>Find your next paper</small></span><ArrowUpRight size={17}/></Link><div className="sidebar-heading">YOUR RESEARCH DESK</div><div className="workspace-link"><FileText size={16}/><span>Example papers</span><span className="count-pill">{preparedPapers.length}</span></div><div className="sidebar-section">RESEARCH PAPERS</div><div className="example-list">{preparedPapers.map(item => <Button key={item.id} className={`example-button ${!imports.current && paper.id === item.id ? 'active' : ''}`} aria-pressed={!imports.current && paper.id === item.id} onClick={() => choose(item.id)}>{item.id === 'priority-search-trees' ? <GitBranch size={17}/> : <Layers3 size={17}/>}<span>{labels[item.id]?.label ?? item.document.title}<small>{labels[item.id]?.detail}</small></span>{!imports.current && paper.id === item.id && <span className="active-indicator"/>}</Button>)}</div><div className="sidebar-section imported-heading">LOCAL PAPERS <span>{imports.records.length}</span></div><div className="imported-paper-list">{imports.records.length ? imports.records.map(record => <Button variant="ghost" key={record.id} className={`imported-paper-button ${imports.current?.id === record.id ? 'active' : ''}`} aria-pressed={imports.current?.id === record.id} title={record.source.title} onClick={() => { setExplicitSnapshotId(null);setDiscoveryPending(false);setAutomaticSuppressed(false);imports.select(record.id); window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); }}><FileText size={16}/><span>{record.source.title}<small>{importStageLabel[record.stage]??'Saved paper'}</small></span></Button>) : <p>Import a PDF or arXiv paper to add it here.</p>}<Button variant="outline" className="sidebar-import-button" onClick={() => setImportOpen(true)}><FilePlus2 size={16}/>Import a paper</Button></div><div className="recent-papers"><div className="sidebar-section">RECENT PAPERS</div>{recents.slice(0,4).map(recent => <Button variant="ghost" key={recent.documentId} title={recent.title} onClick={() => reopen(recent.documentId)}>{recent.title}</Button>)}</div><div className="sidebar-section contents-heading">IN THE PAPER</div><nav className="contents" aria-label="Source sections">{(imports.current?.analysis?.document ?? imports.current?.source ?? paper.document).blocks.filter(block => block.kind === 'heading').map((block, index) => <a key={block.id} href={`#source-${imports.current?.source.id ?? paper.document.id}-${block.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{block.kind === 'heading' ? block.text : ''}</a>)}</nav><div className="sidebar-bottom"><div className="meta-status"><span className={`status-dot ${metaConfigured ? 'configured' : ''}`}/><span>{metaConfigured === true ? 'Meta enabled' : metaConfigured === false ? 'Meta not set up' : 'Prepared locally'}</span></div><p>Figures prepare automatically. Papers and saved results stay in this browser.</p><a href="#source-attribution">Source & attribution <ArrowUpRight size={12}/></a></div></aside>;
  return <div className="workspace m1-workspace">
    <a className="skip-link" href="#paper-content">Skip to the research paper</a>
    <header className="app-header"><Button className="mobile-desk-toggle" variant="ghost" aria-label="Open research desk" aria-expanded={deskOpen} onClick={()=>setDeskOpen(true)}><PanelLeft size={20}/></Button><a className="wordmark" href="/" aria-label="Paperplay home"><PaperplayMark/>paperplay<span className="wordmark-period">.</span></a><div className="header-divider"/><span className="header-caption">Research, within reach.</span><div className="header-actions"><ReadingPreferences/><Button variant="outline" aria-label="Import paper" className="import-paper-button" onClick={() => setImportOpen(true)}><FilePlus2 size={17}/><span>Import paper</span></Button><Button variant="outline" className="open-bundle-button" asChild><Link href="/explore" aria-label="Find a paper"><Search size={17}/><span>Find a paper</span></Link></Button><input ref={bundleInput} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="application/json,.json" aria-label="Experiment bundle" onChange={event => { const file = event.target.files?.[0]; if (file) void openBundle(file); }}/><Badge variant="outline" className="version-tag">READ + EXPLORE</Badge><Button className="quiet-button" aria-label="About this workspace" onClick={() => setInfoOpen(true)}><CircleHelp size={16}/><span>About</span></Button></div></header>
    <div className="workspace-body">{desk}
    <main className="main-workspace" id="paper-content" tabIndex={-1}><ReadingNavigator key={activeSource.id} source={activeSource}/><ExecutionMonitor/><ImportProgress failureExtraction={imports.failureExtraction} stage={imports.stage} progress={imports.progress} record={imports.current} busy={imports.busy} error={imports.error} warning={imports.warning} cancel={imports.cancel} resume={imports.resume} analyze={imports.analyze}/>{transferMessage && <p role="status" className="transfer-message">{transferMessage}</p>}{initialized ? <ReadingSession key={`${imports.current?.id ?? paper.id}:${sessionVersion}`} source={imports.current?.analysis?.document ?? imports.current?.source ?? paper.document}>{imports.current ? <ImportedPaperReader key={imports.current.id} snapshotFigureId={automaticSuppressed?explicitSnapshotId:null} record={imports.current} remove={removePaper} busy={imports.busy} automaticEnabled={!discoveryPending&&!automaticSuppressed} sources={allSources} openSource={reopen}/> : <ReadingArticle key={paper.id} snapshotFigureId={automaticSuppressed?explicitSnapshotId:null} paper={paper} sources={allSources} openSource={reopen} automaticEnabled={!discoveryPending&&!automaticSuppressed&&!imports.busy}/>}</ReadingSession> : <p className="transfer-message">Restoring the local reading workspace…</p>}</main></div>
    <Dialog open={deskOpen} onOpenChange={setDeskOpen}><DialogContent className="mobile-desk-dialog"><DialogTitle>Research desk</DialogTitle><DialogDescription>Choose a paper or jump to a section.</DialogDescription>{desk}</DialogContent></Dialog>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="preview-dialog" showCloseButton={false}><div className="dialog-heading"><span className="dialog-icon"><BookOpen size={22}/></span><Button className="icon-button" aria-label="Close workspace information" onClick={() => setInfoOpen(false)}><X size={19}/></Button></div><DialogTitle>Read the paper. Test the idea.</DialogTitle><DialogDescription>Original, attributed source selections are interleaved with illustrations chosen and configured by Meta.</DialogDescription><p>Meta chooses from the available figure bank or requests a custom interaction. Added teaching figures remain distinct from original paper illustrations and research evidence.</p><p>The saved example sources retain their original figures. You can also import a PDF or arXiv paper, keep its extracted source locally, and Meta automatically prepares source-linked illustrations. Extraction and model limitations remain visible. Ask contextual questions, save local experiments, and share a public snapshot or an explicit experiment bundle.</p><Button className="small-primary" onClick={() => setInfoOpen(false)}>Back to the paper</Button></DialogContent></Dialog>
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} busy={imports.busy} importPdf={(file,options)=>importForReading(()=>imports.importPdf(file,options))} importArxiv={(input,options)=>importForReading(()=>imports.importArxiv(input,options))}/>
  </div>;
}

function ReadingArticle({ paper, sources, openSource,automaticEnabled,snapshotFigureId }: { snapshotFigureId:string|null;automaticEnabled:boolean;paper: PreparedPaper; sources: SourceDocument[]; openSource: (id: string) => void }) {
  const session = useReadingSession();
  // An explicitly opened snapshot is a reader-selected saved experience, never an automatic paper suggestion.
  const snapshot = snapshotFigureId?session?.state.figures.find(view=>view.snapshot.figure.id===snapshotFigureId)?.snapshot:undefined;
  const sharedAnchor = snapshot?paper.document.anchors.find(anchor=>anchor.id===snapshot.figure.sourceAnchorIds[0]):undefined;
  const sharedEntry = snapshot&&sharedAnchor?{figure:snapshot.figure,explanation:'This explicitly opened snapshot retains its saved figure and settings. It is separate from Meta’s automatic illustration plan.',sourceQuote:sharedAnchor.quote,sourcePage:sharedAnchor.page}:undefined;
  return <article className="paper-article research-article" onCopy={copySourceMathSelection}>
    <div className="article-kicker"><span>{paper.attribution.venue}</span></div><h1>{paper.document.title}</h1><p className="source-authors">{paper.document.authors.join(' · ')}</p><div className="paper-links"><a href={paper.pdfUrl} target="_blank" rel="noreferrer">{paper.pdfUrl === paper.sourceUrl ? 'Original article' : 'Complete original PDF'} <ArrowUpRight size={13}/></a><span>{paper.attribution.license}</span></div>
    <SourceInformation source={paper.document} description={paper.coverage}><p>{paper.attribution.notice}</p><p><a href={paper.sourceUrl} target="_blank" rel="noreferrer">Publisher record</a></p><p>{paper.attribution.authors} · {paper.attribution.venue} · <a href={paper.attribution.licenseUrl} target="_blank" rel="noreferrer">{paper.attribution.license}</a></p></SourceInformation>
    <AutomaticPaperEnhancement source={paper.document} enabled={automaticEnabled}/>
    <ReadingDesk source={paper.document} originalUrl={paper.pdfUrl} htmlSource={paper.pdfUrl === paper.sourceUrl} sources={sources} openSource={openSource}/>


    <div className="source-blocks">{paper.document.blocks.map(block => <div className="passage-row" key={block.id}><SourceBlock block={block} paper={paper}/>{block.kind !== 'heading' && <PassageTools source={paper.document} blockId={block.id}/>}{sharedEntry&&sharedAnchor?.blockId===block.id&&<DeferredFigure id={sharedEntry.figure.id} title={sharedEntry.figure.title}><GeneratedFigureView entry={sharedEntry} source={paper.document} htmlSource={paper.pdfUrl===paper.sourceUrl} origin="bundle" attribution={paper.attribution}/></DeferredFigure>}</div>)}</div>
    <ResearchWorkbench source={paper.document} originalUrl={paper.pdfUrl}/>
    <aside className="source-note attribution-note" id="source-attribution"><BookOpen size={18}/><div><p>{paper.attribution.authors} · <a href={paper.attribution.licenseUrl} target="_blank" rel="noreferrer">{paper.attribution.license}</a></p></div></aside><footer className="article-footer"><span>Stay curious. Change a parameter.</span><span>paperplay / research workspace</span></footer>
  </article>;
}

function SourceBlock({ block, paper }: { block: SourceDocument['blocks'][number]; paper: PreparedPaper }) {
  const id = sourceId(paper, block.id);
  const htmlSource = paper.pdfUrl === paper.sourceUrl;
  const pageLink = htmlSource ? paper.sourceUrl : `${paper.pdfUrl}#page=${block.page}`;
  const location = htmlSource ? 'HTML source' : `Source · p. ${block.page}`;
  if (block.kind === 'heading') return <section className="original-heading source-block" id={id} tabIndex={-1}><a className="source-page" href={pageLink} target="_blank" rel="noreferrer" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); openOriginal(paper.document, block.id); } }}>{location}</a><h2>{block.text}</h2></section>;
  if (block.kind === 'paragraph') return <div className="source-block source-paragraph" id={id} tabIndex={-1}><p><SourceMath text={block.text}/></p></div>;
  if (block.kind === 'equation') {
    const html = katex.renderToString(block.latex, { displayMode: true, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 100, output: 'htmlAndMathml' });
    return <figure className="source-equation source-block" data-latex={block.latex} id={id} tabIndex={-1}><div className="equation-scroll" tabIndex={0} role="region" aria-label={`Original equation ${block.label ?? block.id}; scroll horizontally when needed`} dangerouslySetInnerHTML={{ __html: html }}/><figcaption>{block.label ? `Equation ${block.label} · ` : 'Original equation · '}<a href={pageLink} target="_blank" rel="noreferrer" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); openOriginal(paper.document, block.id); } }}>{location}</a></figcaption></figure>;
  }
  return <OriginalSourceFigure block={block} source={paper.document} url={paper.pdfUrl} htmlSource={htmlSource}/>;
}
