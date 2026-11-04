'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LoaderCircle, Sparkles } from 'lucide-react';
import type { SourceDocument } from '@/shared/schema';
import './automatic-paper-plan.css';

export type PlanFigureStatus = 'ready' | 'building' | 'queued';
export type PlanFigureView = { id: string; title: string; blockId: string; kind: string; whyHere: string; learningGoal: string; interaction: string; status: PlanFigureStatus };

const blockText = (block: SourceDocument['blocks'][number]) => block.kind === 'equation' ? block.latex : block.kind === 'original-figure' ? block.caption : block.text;

/** Section heading that owns each block, for labels and the contents rail. */
function sectionOf(source: SourceDocument) {
  const owner = new Map<string, { id: string; text: string }>(); let current: { id: string; text: string } | undefined;
  for (const block of source.blocks) { if (block.kind === 'heading') current = { id: block.id, text: block.text }; if (current) owner.set(block.id, current); }
  return owner;
}

export function paperStats(source: SourceDocument) {
  let words = 0, equations = 0, figures = 0, sections = 0;
  for (const block of source.blocks) {
    if (block.kind === 'heading') sections++; else if (block.kind === 'equation') equations++; else if (block.kind === 'original-figure') figures++;
    else words += blockText(block).split(/\s+/).filter(Boolean).length;
  }
  return { words, equations, figures, sections, passages: source.blocks.length };
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let frame = 0; const start = performance.now();
    const tick = (now: number) => { const t = Math.min(1, (now - start) / 900); setShown(Math.round(value * (1 - (1 - t) ** 3))); if (t < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString()}</>;
}

/**
 * The paper as a strip of its real passages. While Meta reads, a scan sweeps it; once the plan
 * arrives, the passages Meta chose light up with numbered pins.
 */
export function PaperMap({ source, figures, reading }: { source: SourceDocument; figures: readonly PlanFigureView[]; reading: boolean }) {
  const stats = useMemo(() => paperStats(source), [source]);
  const blocks = source.blocks, step = 7, width = Math.max(blocks.length * step, 140), height = 46;
  const chosen = new Map(figures.map((figure, index) => [figure.blockId, { index, status: figure.status }]));
  const max = Math.max(1, ...blocks.map(block => blockText(block).length));
  return <div className="paper-map" data-reading={reading}>
    <div className="paper-map-strip">
     <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={figures.length ? `${figures.length} of ${blocks.length} passages chosen by Meta` : `Meta is reading ${blocks.length} passages`}>
      {blocks.map((block, i) => {
        const pick = chosen.get(block.id);
        const h = block.kind === 'heading' ? height : block.kind === 'equation' ? 14 : block.kind === 'original-figure' ? 30 : 10 + 24 * Math.sqrt(blockText(block).length / max);
        return <rect key={block.id} className="paper-map-tick" data-kind={block.kind} data-chosen={pick?.status} x={i * step} y={height - h} width={step - 2} height={h} rx={1.5}/>;
      })}
     </svg>
     {/* The scan and pins are HTML over the stretched strip, so they stay inside it and keep their shape. */}
     {reading && <span className="paper-map-scan" aria-hidden="true"/>}
     {figures.map((figure, index) => { const at = blocks.findIndex(block => block.id === figure.blockId); if (at < 0) return null;
       return <span key={figure.id} className="paper-map-pin" data-status={figure.status} aria-hidden="true" style={{ left: `${((at * step + (step - 2) / 2) / width) * 100}%`, animationDelay: `${index * 140}ms` }}>{index + 1}</span>; })}
    </div>
    <p className="paper-map-stats">{reading
      ? <>Meta is reading the complete paper · <strong><CountUp value={stats.sections}/></strong> sections · <strong><CountUp value={stats.words}/></strong> words · <strong><CountUp value={stats.equations}/></strong> equations</>
      : <>Meta chose <strong>{figures.length}</strong> of <strong>{stats.passages}</strong> passages to illustrate</>}</p>
  </div>;
}

export function PlanList({ source, figures }: { source: SourceDocument; figures: readonly PlanFigureView[] }) {
  const sections = useMemo(() => sectionOf(source), [source]);
  return <ol className="plan-list" aria-label="Meta's illustration plan">{figures.map((figure, index) => <li key={figure.id} data-status={figure.status} style={{ animationDelay: `${index * 120}ms` }}>
    <button type="button" onClick={() => { const target = document.getElementById(`meta-plan-${figure.id}`) ?? document.getElementById(`source-${source.id}-${figure.blockId}`); target?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>
      <span className="plan-index">{figure.status === 'ready' ? <Check size={13} aria-hidden="true"/> : index + 1}</span>
      <span className="plan-text"><strong>{figure.title}</strong><small>{sections.get(figure.blockId)?.text ?? 'Selected passage'}</small></span>
      <span className="plan-status">{figure.status === 'ready' ? 'Ready' : figure.status === 'building' ? <><LoaderCircle size={13} className="plan-spin" aria-hidden="true"/>Building</> : 'Queued'}</span>
    </button>
  </li>)}</ol>;
}

/** A sketch that draws itself in the shape of the planned figure while Meta builds it. */
function Sketch({ kind, live }: { kind: string; live: boolean }) {
  const family = ['graph', 'diagram', 'attention'].includes(kind) ? 'network' : kind === 'table' ? 'table' : ['generated', 'custom'].includes(kind) ? 'scene' : 'plot';
  return <svg className="plan-sketch" data-live={live} viewBox="0 0 320 120" aria-hidden="true">
    {family === 'plot' && <><path pathLength={1} d="M24 104H300M24 104V12"/><path pathLength={1} className="plan-sketch-accent" d="M28 96C70 92 92 30 132 30S190 88 230 70 280 22 296 20"/><circle cx="132" cy="30" r="5"/></>}
    {family === 'network' && <><path pathLength={1} d="M70 34L160 22L250 40M70 34L110 90L160 22M110 90L210 92L250 40M160 22L210 92"/>{[[70, 34], [160, 22], [250, 40], [110, 90], [210, 92]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} className={i === 1 ? 'plan-sketch-node-accent' : undefined}/>)}</>}
    {family === 'table' && <>{[22, 46, 70, 94].map(y => <path key={y} pathLength={1} d={`M30 ${y}H290`}/>)}<path pathLength={1} d="M120 14V102M210 14V102"/><path pathLength={1} className="plan-sketch-accent" d="M36 58H112"/></>}
    {family === 'scene' && <><ellipse cx="160" cy="62" rx="130" ry="44"/><ellipse cx="160" cy="62" rx="80" ry="27"/><path pathLength={1} className="plan-sketch-accent" d="M286 98C240 20 200 100 170 40S140 80 160 62"/><circle cx="160" cy="62" r="5"/></>}
  </svg>;
}

/** Host-owned placeholder after the chosen passage; it is removed when the real figure arrives. */
export function PlannedFigureSketch({ source, figure, index, total }: { source: SourceDocument; figure: PlanFigureView; index: number; total: number }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const target = document.getElementById(`source-${source.id}-${figure.blockId}`); if (!target) return;
    const node = document.createElement('div'); node.id = `meta-plan-${figure.id}`; node.className = 'plan-slot';
    target.insertAdjacentElement('afterend', node); setSlot(node);
    target.dataset.metaChosen = 'true';
    return () => { node.remove(); delete target.dataset.metaChosen; };
  }, [source.id, source.sourceVersion, figure.blockId, figure.id]);
  if (!slot) return null;
  const live = figure.status === 'building';
  return createPortal(<aside className="plan-card" data-status={figure.status} aria-label={`Planned figure: ${figure.title}`}>
    <p className="plan-card-kicker"><Sparkles size={14} aria-hidden="true"/>Meta chose this passage · figure {index + 1} of {total}<span className="plan-card-state">{live ? <><LoaderCircle size={13} className="plan-spin" aria-hidden="true"/>Building now</> : 'Queued'}</span></p>
    <h3>{figure.title}</h3>
    <Sketch kind={figure.kind} live={live}/>
    <dl>
      <div><dt>Why here</dt><dd>{figure.whyHere}</dd></div>
      <div><dt>Reader question</dt><dd>{figure.learningGoal}</dd></div>
      <div><dt>You will</dt><dd>{figure.interaction}</dd></div>
    </dl>
  </aside>, slot);
}

/** Marks the contents rail: sections Meta is illustrating, and a reading sweep while it plans. */
export function useRailPlanMarkers(source: SourceDocument, figures: readonly PlanFigureView[], reading: boolean) {
  const sections = useMemo(() => sectionOf(source), [source]);
  const signature = figures.map(figure => `${figure.blockId}:${figure.status}`).join('|');
  useEffect(() => {
    const root = document.documentElement;
    if (reading) root.dataset.metaReading = 'true'; else delete root.dataset.metaReading;
    const rank = { building: 3, queued: 2, ready: 1 } as const, state = new Map<string, PlanFigureStatus>();
    for (const figure of figures) { const section = sections.get(figure.blockId); if (!section) continue; const previous = state.get(section.id); if (!previous || rank[figure.status] > rank[previous]) state.set(section.id, figure.status); }
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.contents a')];
    for (const link of links) { const id = [...state.keys()].find(key => link.hash === `#source-${source.id}-${key}`); if (id) link.dataset.metaFigure = state.get(id); else delete link.dataset.metaFigure; }
    return () => { delete root.dataset.metaReading; for (const link of links) delete link.dataset.metaFigure; };
  }, [source.id, signature, reading, sections]);
}
