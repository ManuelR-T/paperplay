'use client';

import { useEffect, useState } from 'react';
import katex from 'katex';
import { ArrowUpRight, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ImportRecord } from '@/shared/import-types';
import type { SourceDocument } from '@/shared/schema';
import { PassageTools, ReadingDesk, DeferredFigure, openOriginal } from './reading/reader-tools';
import { OriginalSourceFigure } from './reading/original-source-figure';
import { SourceInformation } from './reading/source-information';
import { ResearchWorkbench } from './research-workbench';
import { useReadingSession } from './reading-session';
import { GeneratedFigureView } from './figures/generated-figure';

export function ImportedPaperReader({ record, remove, busy, sources, openSource }: { record: ImportRecord; remove: (id: string) => Promise<void>; busy: boolean; sources?: SourceDocument[]; openSource?: (id: string) => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => {
    if (!record.original) { setBlobUrl(null); return; }
    const url = URL.createObjectURL(record.original); setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [record.original]);
  const source = record.analysis?.document ?? record.source;
  const originalUrl = blobUrl ?? record.originalUrl ?? source.source.url;
  const htmlSource = source.source.kind === 'arxiv' && !record.original;
  const session = useReadingSession();
  const analyzed = record.analysis?.figures ?? [];
  const [bundleViews] = useState(() => session?.state.figures ?? []);
  const restored = bundleViews.filter(view => !analyzed.some(item => item.figure.id === view.snapshot.figure.id)).map(view => {
    const anchor = source.anchors.find(item => item.id === view.snapshot.figure.sourceAnchorIds[0])!;
    return { figure: view.snapshot.figure, explanation: 'This experiment was restored from a local snapshot. Its input and engine versions were validated. No new model request was made.', sourceQuote: anchor.quote, sourcePage: anchor.page };
  });
  const figures = [...analyzed, ...restored];
  const anchored = figures.map(entry => ({ entry, anchor: source.anchors.find(item => item.id === entry.figure.sourceAnchorIds[0]) }));
  return <article className="paper-article research-article imported-article">
    <div className="article-kicker"><span>{htmlSource ? 'ARXIV · STRUCTURED SOURCE' : 'IMPORTED PDF'}</span></div>
    <h1>{source.title}</h1><p className="source-authors">{source.authors.join(' · ')}</p>
    <div className="paper-links">{originalUrl && <a href={originalUrl} target="_blank" rel="noreferrer">{htmlSource ? 'Original article' : 'Original PDF'} <ArrowUpRight size={14}/></a>}{source.source.url && source.source.url !== originalUrl && <a href={source.source.url} target="_blank" rel="noreferrer">Source record <ArrowUpRight size={14}/></a>}<span>{record.originalName ?? 'Saved in this browser'}</span></div>
    <SourceInformation source={source} description={htmlSource ? 'Structured arXiv article. References point to sections of the original HTML.' : 'Text extracted from the PDF. Compare the original for equations, figures or uncertain reading order.'}>{record.attribution && <p>{record.attribution.authors} · {record.attribution.notice} {record.attribution.license}</p>}<p>The imported source is stored in this browser. Importing does not establish a redistribution license.</p>{record.analysis?.warnings.length ? <section><h3>Analysis limitations</h3><ul>{record.analysis.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section> : null}{record.analysis && <p>Analysis by {record.analysis.model}. {record.analysis.usage ? `${record.analysis.usage.inputTokens.toLocaleString()} input tokens · ${record.analysis.usage.outputTokens.toLocaleString()} output tokens.` : 'Provider usage unavailable.'} Saved analysis is reused.</p>}</SourceInformation>
    <ReadingDesk source={source} original={record.original} originalName={record.originalName} originalUrl={originalUrl ?? undefined} htmlSource={htmlSource} sources={sources} openSource={openSource} attribution={record.attribution}/>
    {record.analysis && <aside className="analysis-overview"><div><Badge variant="outline">Added with Meta</Badge><span>{record.analysis.model}</span></div><h2>A guide to the ideas</h2><p>{record.analysis.summary}</p><p className="control-hint">This summary is an added interpretation. Follow each figure’s quote back to the source.</p></aside>}
    <div className="source-blocks">{source.blocks.map(block => {
      const additions = anchored.filter(item => item.anchor?.blockId === block.id);
      return <div className="passage-row" key={block.id}><ImportedSourceBlock block={block} source={source} originalUrl={originalUrl} original={record.original} htmlSource={htmlSource}/>{block.kind !== 'heading' && <PassageTools source={source} blockId={block.id}/>}
        {additions.map(({ entry }) => <DeferredFigure key={entry.figure.id} id={entry.figure.id} title={entry.figure.title}><GeneratedFigureView key={entry.figure.id} entry={entry} source={source} htmlSource={htmlSource} origin={analyzed.some(item => item.figure.id === entry.figure.id) ? 'meta' : 'bundle'} original={record.original} originalName={record.originalName} attribution={record.attribution}/></DeferredFigure>)}
      </div>;
    })}</div>
    {anchored.some(item => !item.anchor) && <p className="figure-error" role="alert">An addition has no valid source location. It has not been inserted into an unrelated passage.</p>}
    <ResearchWorkbench source={source} original={record.original} originalName={record.originalName}/>
    <aside className="source-note attribution-note" id="source-attribution"><FileText size={20}/><div><p>{record.originalName ?? 'Paper saved in this browser'}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => setDeleteOpen(value => !value)}><Trash2 size={15}/>Remove local paper</Button>{deleteOpen && <div className="delete-confirmation"><p>Remove this source, original file, analyses and cached widget settings from this browser? Personal notes remain as unresolved notebook records and can be removed separately.</p><Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove(record.id).catch(() => {})}>Remove paper</Button><Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>Keep it</Button></div>}</div></aside>
    <footer className="article-footer"><span>Source first. Explore with context.</span><span>paperplay / research workspace</span></footer>
  </article>;
}

function ImportedSourceBlock({ block, source, originalUrl, original, htmlSource }: { block: SourceDocument['blocks'][number]; source: SourceDocument; originalUrl?: string | null; original?: Blob; htmlSource: boolean }) {
  const id = `source-${source.id}-${block.id}`;
  const location = htmlSource ? 'HTML source' : `p. ${block.page}`;
  const link = originalUrl ? htmlSource ? originalUrl : `${originalUrl}#page=${block.page}` : undefined;
  const reference = link ? <a className="source-page" href={link} target="_blank" rel="noreferrer" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); openOriginal(source, block.id); } }}>{location}</a> : <span className="source-page">{location}</span>;
  if (block.kind === 'heading') return <section className="original-heading source-block" id={id} tabIndex={-1}>{reference}<h2>{block.text}</h2></section>;
  if (block.kind === 'paragraph') return <div className="source-block source-paragraph" id={id} tabIndex={-1}><p>{block.text}</p>{reference}</div>;
  if (block.kind === 'equation') {
    const html = katex.renderToString(block.latex, { displayMode: true, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 100, output: 'htmlAndMathml' });
    return <figure className="source-equation source-block" data-latex={block.latex} id={id} tabIndex={-1}><div className="equation-scroll" tabIndex={0} role="region" aria-label={`Original equation ${block.label ?? block.id}; scroll horizontally when needed`} dangerouslySetInnerHTML={{ __html: html }}/><figcaption>{block.label ? `${block.label} · ` : 'Source equation · '}{reference}</figcaption></figure>;
  }
  return <OriginalSourceFigure block={block} source={source} original={original} url={originalUrl??undefined} htmlSource={htmlSource}/>;
}
