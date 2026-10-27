'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { preparedPapers } from '@/data/papers';
import { widgetReferenceSources } from '@/data/widget-sources';
import { WIDGET_KINDS, type WidgetKind, type WidgetEnvelope } from '@/shared/widgets';
import { createWidgetForSource } from '@/lib/widgets/presets';
import { widgetGuides } from '@/lib/widgets/interaction';
import { decodeWidgetSnapshot } from '@/lib/widgets/compatibility';
import { peekWidgetLocation } from '@/lib/experiments/widget-location';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

const WidgetView = dynamic(() => import('./widgets/widget-view').then(module => module.WidgetView), { ssr: false, loading: () => <p role="status">Loading the example…</p> });
const shortDescriptions: Record<WidgetKind, string> = { equation: 'Change variables', function: 'Probe a curve', diagram: 'Connect ideas', table: 'Filter and sort', linear: 'Move a vector', probability: 'Update a belief', attention: 'Inspect query weights', graph: 'Find a path', signal: 'Apply a kernel', custom: 'Play a new model' };

export function WidgetGallery({ embedded = false, active = true }: { embedded?: boolean; active?: boolean } = {}) {
  const [kind, setKind] = useState<WidgetKind>('attention');
  const [open, setOpen] = useState(embedded); const [info, setInfo] = useState(false);
  const [restored, setRestored] = useState<WidgetEnvelope | null>(null); const [message, setMessage] = useState('');
  const example = useRef<HTMLDivElement>(null);
  const source = useMemo(() => {
    const original = kind === 'attention' ? widgetReferenceSources[0] : kind === 'probability' ? widgetReferenceSources[1] : kind === 'signal' ? widgetReferenceSources[2] : ['equation', 'function', 'linear', 'custom'].includes(kind) ? preparedPapers.find(paper => paper.document.id === 'quadratic-optimization')!.document : preparedPapers[0].document;
    return { ...original, id: `gallery-${original.id}` };
  }, [kind]);
  const initial = useMemo(() => restored?.source.documentId === source.id ? restored : {...createWidgetForSource(kind, source),title:widgetGuides[kind].name}, [kind, source, restored]);
  useEffect(() => {
    function restore() {
      if (!location.hash.startsWith('#widget=')) return;
      try {
        const encoded = location.hash.slice(8), reference = peekWidgetLocation(encoded);
        if (!reference.documentId.startsWith('gallery-')) return;
        if (!WIDGET_KINDS.includes(reference.kind as WidgetKind)) throw Error('This example type is unavailable in this version.');
        if (reference.kind !== kind) { setKind(reference.kind as WidgetKind); return; }
        setRestored(decodeWidgetSnapshot(encoded, source)); setOpen(true);
        history.replaceState(history.state, '', location.pathname + location.search); setMessage('Shared example restored. No model request was made.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'This shared example could not be opened.'); }
    }
    restore(); window.addEventListener('hashchange', restore); return () => window.removeEventListener('hashchange', restore);
  }, [kind, source]);
  const content = <>
    <p className="widget-hint">Try an independent example. These examples are separate from the paper you are reading.</p>
    <div className="widget-gallery-options" role="group" aria-label="Choose a widget example">{WIDGET_KINDS.map(value => <Button key={value} variant={kind === value ? 'secondary' : 'outline'} aria-pressed={kind === value} aria-label={`Try ${widgetGuides[value].name}`} onClick={() => { setRestored(null); setKind(value); requestAnimationFrame(() => { example.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); example.current?.focus(); }); }}><span>{widgetGuides[value].name}</span><small>{shortDescriptions[value]}</small></Button>)}</div>
    <div className="widget-gallery-source"><span>Reference: {source.title}</span><Button variant="ghost" onClick={() => setInfo(true)}>About this example</Button></div>
    {message && <p role="status">{message}</p>}
    <div ref={example} className="widget-gallery-active" tabIndex={-1}>{open && active && <WidgetView key={kind} envelope={initial} source={source} onSource={() => setInfo(true)}/>}</div>
    <Dialog open={info} onOpenChange={setInfo}><DialogContent className="reader-dialog"><DialogTitle>About this example</DialogTitle><DialogDescription>{source.title} · {source.authors.join(' · ')}</DialogDescription><p>This is an authored teaching example linked to the original research. It is not an interpretation of the currently open paper.</p>{source.blocks.filter(block => block.id === initial.source.blockId).map(block => <blockquote key={block.id} id={`source-${source.id}-${block.id}`}>{block.kind === 'equation' ? block.latex : block.kind === 'original-figure' ? block.caption : block.text}</blockquote>)}<ul>{source.extractionWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>{source.source.url && <a href={source.source.url} target="_blank" rel="noreferrer">Read the original research ↗</a>}</DialogContent></Dialog>
  </>;
  return embedded ? <section aria-label="Widget gallery"><h3>Try an example</h3>{content}</section> : <section><Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>Try widget examples</Button>{open && content}</section>;
}
