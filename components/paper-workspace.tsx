'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import katex from 'katex';
import { ArrowDown, ArrowUpRight, BookOpen, CircleHelp, FilePlus2, FileText, GitBranch, Layers3, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { preparedPapers, type PreparedPaper } from '@/data/papers';
import { createDefaultInput } from '@/lib/engines';
import { createPreparedExperiment } from '@/lib/prepared-figures';
import { validateSnapshot, type ExperimentSnapshot, type SourceDocument } from '@/shared/schema';
import { engineRegistry } from '@/lib/engines';
import { ComparisonFigure, EngineFigure, WalkthroughFigure } from './figures/experiment';
import { useImportController } from '@/lib/use-import-controller';
import { ImportDialog, ImportProgress } from './import-tools';
import { ImportedPaperReader } from './imported-paper';
import { ReadingSession, useReadingSession } from './reading-session';
import { listRecentPapers, deleteReadingState, preparedFromSnapshot, snapshotFromPrepared, saveReadingState, type RecentPaper } from '@/lib/reading-state';
import { decodePublicSnapshot, parseExperimentBundle, validatePreparedSnapshot } from '@/lib/snapshots';
import { createImportStorage } from '@/lib/import-storage';
import { ANALYSIS_PIPELINE_VERSION } from '@/shared/import-types';
import { ReadingPreferences, ReadingNavigator, ReadingDesk, PassageTools, DeferredFigure, openOriginal } from './reading/reader-tools';
import { ResearchWorkbench } from './research-workbench';
import {checkPendingSourcePlans,forgetSourceWidgets}from'@/lib/experiments/source-removal';
import { peekWidgetLocation } from '@/lib/experiments/widget-location';

const labels: Record<string, { label: string; detail: string }> = {
  'priority-search-trees': { label: 'Priority & shortest paths', detail: 'Graph algorithms · ITP 2019' },
  'quadratic-optimization': { label: 'Curvature & momentum', detail: 'Numerical optimization · Distill 2017' },
  'adaptive-mergesort': { label: 'Adaptive merging', detail: 'Sorting algorithms · ESA 2018' },
};
const figureLabels = { primary: 'Explore this mechanism', comparison: 'Compare the methods', walkthrough: 'Read a conceptual guide' };
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
  async function openBundle(file: File) {
    setTransferMessage('');
    try {
      if (imports.busy) throw new Error('Finish the running import before opening a bundle.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a bundle smaller than 20 MiB.');
      const bundle = await parseExperimentBundle(await file.text(), { sources: imports.records.map(record => record.analysis?.document ?? record.source) });
      if (!bundle.source || bundle.missingSource) throw new Error('This metadata-only bundle needs its matching source on this browser. Import the original source, or ask for an export that includes source text.');
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
    try{forgetSourceWidgets(id,localStorage);}catch{setTransferMessage('The paper was removed, but some cached widget settings could not be cleared. Personal notes remain as unresolved notebook records.');}
    const result = deleteReadingState(id); if (result.warning) setTransferMessage(result.warning);
    setRecents(listRecentPapers());
  }
  function reopen(id: string) {
    const prepared = preparedPapers.find(item => item.document.id === id);
    if (prepared) choose(prepared.id); else if (imports.records.some(record => record.id === id)) imports.select(id);
    else setTransferMessage('This recent source is no longer stored on this browser. Import it again to restore compatible settings.');
  }
  useEffect(() => {
    let timer: number | undefined;
    const update = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setRecents(listRecentPapers()), 300); };
    window.addEventListener('paperplay:reading-saved', update);
    return () => { window.clearTimeout(timer); window.removeEventListener('paperplay:reading-saved', update); };
  }, []);
  function choose(id: string) { imports.select(''); setSelected(id); window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); }
  return <div className="workspace m1-workspace">
    <a className="skip-link" href="#paper-content">Skip to the research paper</a>
    <header className="app-header"><a className="wordmark" href="/" aria-label="Paperplay home"><span className="brand-icon"><BookOpen size={19}/></span>paperplay<span className="wordmark-period">.</span></a><div className="header-divider"/><span className="header-caption">Research, within reach.</span><div className="header-actions"><ReadingPreferences/><Button variant="outline" aria-label="Import paper" className="import-paper-button" onClick={() => setImportOpen(true)}><FilePlus2 size={17}/><span>Import paper</span></Button><Button variant="outline" className="open-bundle-button" onClick={() => bundleInput.current?.click()}>Open bundle</Button><input ref={bundleInput} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="application/json,.json" aria-label="Experiment bundle" onChange={event => { const file = event.target.files?.[0]; if (file) void openBundle(file); }}/><Badge variant="outline" className="version-tag">READ + EXPLORE</Badge><Button className="quiet-button" aria-label="About this workspace" onClick={() => setInfoOpen(true)}><CircleHelp size={16}/><span>About this workspace</span></Button></div></header>
    <div className="workspace-body"><aside className="sidebar" aria-label="Reading workspace"><div className="sidebar-heading">YOUR RESEARCH DESK</div><div className="workspace-link"><FileText size={16}/><span>Prepared papers</span><span className="count-pill">{preparedPapers.length}</span></div><div className="sidebar-section">RESEARCH PAPERS</div><div className="example-list">{preparedPapers.map(item => <Button key={item.id} className={`example-button ${!imports.current && paper.id === item.id ? 'active' : ''}`} aria-pressed={!imports.current && paper.id === item.id} onClick={() => choose(item.id)}>{item.id === 'priority-search-trees' ? <GitBranch size={17}/> : <Layers3 size={17}/>}<span>{labels[item.id]?.label ?? item.document.title}<small>{labels[item.id]?.detail}</small></span>{!imports.current && paper.id === item.id && <span className="active-indicator"/>}</Button>)}</div><div className="sidebar-section imported-heading">LOCAL PAPERS <span>{imports.records.length}</span></div><div className="imported-paper-list">{imports.records.length ? imports.records.map(record => <Button variant="ghost" key={record.id} className={`imported-paper-button ${imports.current?.id === record.id ? 'active' : ''}`} aria-pressed={imports.current?.id === record.id} title={record.source.title} onClick={() => { imports.select(record.id); window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); }}><FileText size={16}/><span>{record.source.title}<small>{record.stage === 'complete' ? 'Saved analysis' : record.stage}</small></span></Button>) : <p>Import a PDF or arXiv paper to add it here.</p>}<Button variant="outline" className="sidebar-import-button" onClick={() => setImportOpen(true)}><FilePlus2 size={16}/>Import a paper</Button></div><div className="recent-papers"><div className="sidebar-section">RECENT PAPERS</div>{recents.slice(0,4).map(recent => <Button variant="ghost" key={recent.documentId} title={recent.title} onClick={() => reopen(recent.documentId)}>{recent.title}</Button>)}</div><div className="sidebar-section contents-heading">IN THE PAPER</div><nav className="contents" aria-label="Source sections">{(imports.current?.analysis?.document ?? imports.current?.source ?? paper.document).blocks.filter(block => block.kind === 'heading').map((block, index) => <a key={block.id} href={`#source-${imports.current?.source.id ?? paper.document.id}-${block.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{block.kind === 'heading' ? block.text : ''}</a>)}</nav><div className="sidebar-bottom"><div className="meta-status"><span className={`status-dot ${metaConfigured ? 'configured' : ''}`}/><span>{metaConfigured === true ? 'Meta key configured' : metaConfigured === false ? 'Meta not configured' : 'Prepared locally'}</span></div><p>Prepared papers work without a model call. Imported analyses are saved in this browser.</p><a href="#source-attribution">Source & attribution <ArrowUpRight size={12}/></a></div></aside>
    <main className="main-workspace" id="paper-content" tabIndex={-1}><ReadingNavigator key={activeSource.id} source={activeSource}/><ImportProgress stage={imports.stage} progress={imports.progress} record={imports.current} busy={imports.busy} error={imports.error} warning={imports.warning} cancel={imports.cancel} resume={imports.resume} analyze={imports.analyze}/>{transferMessage && <p role="status" className="transfer-message">{transferMessage}</p>}{initialized ? <ReadingSession key={`${imports.current?.id ?? paper.id}:${sessionVersion}`} source={imports.current?.analysis?.document ?? imports.current?.source ?? paper.document}>{imports.current ? <ImportedPaperReader key={imports.current.id} record={imports.current} remove={removePaper} busy={imports.busy} sources={allSources} openSource={reopen}/> : <ReadingArticle key={paper.id} paper={paper} sources={allSources} openSource={reopen}/>}</ReadingSession> : <p className="transfer-message">Restoring the local reading workspace…</p>}</main></div>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="preview-dialog" showCloseButton={false}><div className="dialog-heading"><span className="dialog-icon"><BookOpen size={22}/></span><Button className="icon-button" aria-label="Close workspace information" onClick={() => setInfoOpen(false)}><X size={19}/></Button></div><DialogTitle>Read the paper. Test the idea.</DialogTitle><DialogDescription>Original, attributed source selections are interleaved with additional figures. The graph, sorting and optimization examples share the same execution and playback interface.</DialogDescription><p>The figures compute actual algorithm traces on synthetic inputs. Verification labels describe their precise scope; they do not claim to reproduce the original papers’ experiments.</p><p>Prepared examples are hand-curated. You can also import a PDF or arXiv paper, keep its extracted source locally, and ask Meta to propose source-linked additions. Extraction and model limitations remain visible. Ask contextual questions, save local experiments, and share a public snapshot or an explicit experiment bundle.</p><Button className="small-primary" onClick={() => setInfoOpen(false)}>Back to the paper</Button></DialogContent></Dialog>
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} busy={imports.busy} importPdf={imports.importPdf} importArxiv={imports.importArxiv}/>
  </div>;
}

function ReadingArticle({ paper, sources, openSource }: { paper: PreparedPaper; sources: SourceDocument[]; openSource: (id: string) => void }) {
  const session = useReadingSession();
  const initialSnapshot = session?.ready ? session.state.experiment ?? session.state.figures.find(item => item.snapshot.figure.id === `${paper.id}-primary`)?.snapshot : undefined;
  const [stateValue, setStateValue] = useState(() => initialSnapshot ? preparedFromSnapshot(initialSnapshot, paper.document) : createPreparedExperiment(paper));
  const state = stateValue;
  function setState(value: typeof state) { setStateValue(value); try { session?.putExperiment(snapshotFromPrepared(paper, value)); } catch { /* Invalid control drafts stay editable but are not persisted. */ } }
  const [seedDraft, setSeedDraft] = useState(String(state.seed));
  const [seedError, setSeedError] = useState('');
  const anchors = Object.entries(paper.illustrationAnchors).map(([kind, anchorId]) => ({ kind: kind as keyof typeof figureLabels, anchor: paper.document.anchors.find(anchor => anchor.id === anchorId) }));
  function reset() { setState(createPreparedExperiment(paper)); setSeedDraft('42'); setSeedError(''); }
  function generate() {
    const seed = Number(seedDraft);
    if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) { setSeedError('Choose an integer seed between 0 and 4,294,967,295.'); return; }
    setState({ ...state, seed, input: createDefaultInput(state.input.kind, seed) }); setSeedError('');
  }
  return <article className="paper-article research-article">
    <div className="article-kicker"><span>{paper.attribution.venue}</span><Badge variant="outline" className="prepared-badge">Prepared reading edition</Badge></div><h1>{paper.document.title}</h1><p className="source-authors">{paper.document.authors.join(' · ')}</p><div className="paper-links"><a href={paper.sourceUrl} target="_blank" rel="noreferrer">Publisher record <ArrowUpRight size={13}/></a><a href={paper.pdfUrl} target="_blank" rel="noreferrer">{paper.pdfUrl === paper.sourceUrl ? 'Original article' : 'Complete original PDF'} <ArrowUpRight size={13}/></a><span>{paper.attribution.license}</span></div>
    <aside className="coverage-note"><strong>Selected original passages</strong><p>{paper.coverage}</p><p>Source text below belongs to the paper’s authors. Shaded figures are additions by Paperplay. {paper.pdfUrl === paper.sourceUrl ? 'References identify logical HTML locations.' : 'Page numbers refer to the original PDF.'}</p></aside>
    <ReadingDesk source={paper.document} originalUrl={paper.pdfUrl} htmlSource={paper.pdfUrl === paper.sourceUrl} sources={sources} openSource={openSource}/>
    {paper.document.extractionWarnings.length > 0 && <details className="extraction-note"><summary>Reading-edition notes ({paper.document.extractionWarnings.length})</summary><ul>{paper.document.extractionWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    <div className="seed-toolbar"><div><strong>One reproducible input</strong><span>Used by the figures and comparisons in this paper.</span></div><label htmlFor={`${paper.id}-seed`}>Seed<input id={`${paper.id}-seed`} type="number" min={0} max={4_294_967_295} step={1} value={seedDraft} onChange={event => setSeedDraft(event.target.value)}/></label><Button variant="outline" size="sm" onClick={generate}><RefreshCw size={14}/>Generate input</Button><output>Current seed: {state.seed}</output></div>{seedError && <p role="alert" className="figure-error">{seedError}</p>}
    <div className="source-blocks">{paper.document.blocks.map(block => {
      const additions = anchors.filter(item => item.anchor?.blockId === block.id);
      return <div className="passage-row" key={block.id}><SourceBlock block={block} paper={paper}/>{block.kind !== 'heading' && <PassageTools source={paper.document} blockId={block.id}/>}{additions.length > 0 && <div className="passage-actions">{additions.map(item => <a key={item.kind} href={`#${paper.id}-${item.kind}`} onClick={() => requestAnimationFrame(() => window.document.getElementById(`${paper.id}-${item.kind}`)?.focus())}>{figureLabels[item.kind]} <ArrowDown size={13}/></a>)}</div>}{additions.map(item => <DeferredFigure key={item.kind} id={`${paper.id}-${item.kind}`} title={figureLabels[item.kind]}>{item.kind === 'primary' ? <EngineFigure key={item.kind} id={`${paper.id}-primary`} document={paper.document} anchorId={item.anchor!.id} state={state} setState={setState} reset={reset}/> : item.kind === 'comparison' ? <ComparisonFigure key={item.kind} id={`${paper.id}-comparison`} document={paper.document} anchorId={item.anchor!.id} state={state} inputFigureId={`${paper.id}-primary`}/> : state.input.kind === 'matrix' ? <EngineFigure key={item.kind} id={`${paper.id}-walkthrough`} document={paper.document} anchorId={item.anchor!.id} state={state} setState={setState} reset={reset} mode="plot"/> : <WalkthroughFigure key={item.kind} id={`${paper.id}-walkthrough`} document={paper.document} anchorId={item.anchor!.id} family={state.input.kind}/>}</DeferredFigure>)}</div>;
    })}</div>
    {anchors.some(item => !item.anchor) && <p role="alert" className="figure-error">One prepared figure has no valid source anchor. It has not been attached to another passage.</p>}
    <ResearchWorkbench source={paper.document}/>
    <aside className="source-note attribution-note" id="source-attribution"><BookOpen size={20}/><div><strong>Source attribution</strong><p>{paper.attribution.notice}</p><p>{paper.attribution.authors} · {paper.attribution.venue} · <a href={paper.attribution.licenseUrl} target="_blank" rel="noreferrer">{paper.attribution.license}</a></p><p>Interactive figures use synthetic inputs. No original hardware benchmark or formal proof is reproduced by this reading edition.</p></div></aside><footer className="article-footer"><span>Stay curious. Change a parameter.</span><span>paperplay / research workspace</span></footer>
  </article>;
}

function SourceBlock({ block, paper }: { block: SourceDocument['blocks'][number]; paper: PreparedPaper }) {
  const id = sourceId(paper, block.id);
  const htmlSource = paper.pdfUrl === paper.sourceUrl;
  const pageLink = htmlSource ? paper.sourceUrl : `${paper.pdfUrl}#page=${block.page}`;
  const location = htmlSource ? 'HTML source' : `Source · p. ${block.page}`;
  if (block.kind === 'heading') return <section className="original-heading source-block" id={id} tabIndex={-1}><a className="source-page" href={pageLink} target="_blank" rel="noreferrer" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); openOriginal(paper.document, block.id); } }}>{location}</a><h2>{block.text}</h2></section>;
  if (block.kind === 'paragraph') return <div className="source-block source-paragraph" id={id} tabIndex={-1}><p>{block.text}</p><a className="source-page" href={pageLink} target="_blank" rel="noreferrer" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); openOriginal(paper.document, block.id); } }}>{location}</a></div>;
  if (block.kind === 'equation') {
    const html = katex.renderToString(block.latex, { displayMode: true, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 100, output: 'htmlAndMathml' });
    return <figure className="source-equation source-block" data-latex={block.latex} id={id} tabIndex={-1}><div className="equation-scroll" tabIndex={0} role="region" aria-label={`Original equation ${block.label ?? block.id}; scroll horizontally when needed`} dangerouslySetInnerHTML={{ __html: html }}/><figcaption>{block.label ? `Equation ${block.label} · ` : 'Original equation · '}<a href={pageLink} target="_blank" rel="noreferrer" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); openOriginal(paper.document, block.id); } }}>{location}</a></figcaption></figure>;
  }
  return <figure className="original-figure-placeholder source-block" id={id} tabIndex={-1}><div><FileText size={25}/><strong>Original figure reference</strong><p>{block.alt}</p><a href={pageLink} target="_blank" rel="noreferrer">View original on page {block.page} <ArrowUpRight size={13}/></a></div><figcaption>{block.caption}</figcaption></figure>;
}
