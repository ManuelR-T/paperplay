'use client';

import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExperimentSnapshot, FigureSpecification, SourceDocument } from '@/shared/schema';
import { loadReadingState, saveReadingState, type FigureViewState, type ReadingState } from '@/lib/reading-state';

function empty(source: SourceDocument): ReadingState {
  return { schemaVersion: 1, documentId: source.id, sourceVersion: source.sourceVersion, updatedAt: Date.now(), position: { scrollY: 0 }, figures: [] };
}
type Session = { ready: boolean; state: ReadingState; warning: string | null; putFigure: (view: FigureViewState) => void; putExperiment: (snapshot: ExperimentSnapshot) => void };
const ReadingContext = createContext<Session | null>(null);
export function ReadingSession({ source, children }: { source: SourceDocument; children: ReactNode }) {
  const [state, setState] = useState<ReadingState>(() => empty(source));
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const current = useRef(state); const currentSource = useRef(source);
  const restoringPosition = useRef(true);
  currentSource.current = source;
  const persist = useCallback((change: (value: ReadingState) => ReadingState, announce = true) => {
    const next = { ...change(current.current), updatedAt: Date.now() };
    const result = saveReadingState(next, currentSource.current);
    if (result.warning) setWarning(result.warning);
    current.current = next; if (announce) { setState(next); window.dispatchEvent(new Event('paperplay:reading-saved')); }
  }, []);
  useEffect(() => {
    const restored = loadReadingState(source);
    const next = restored.state ?? empty(source);
    current.current = next; setState(next); window.dispatchEvent(new Event('paperplay:reading-saved')); setWarning(restored.warning ?? null); setReady(true);
    const preserveIncomingLocation = Boolean(location.hash);
    const key = `paperplay:anchor-offset:${source.id}:${source.sourceVersion}`;
    let anchor: { blockId?: string; figureId?: string; offset?: number } | undefined;
    try { const text = localStorage.getItem(key); if (text && text.length < 1000) anchor = JSON.parse(text); } catch { /* The validated reading state still has an absolute position fallback. */ }
    const timers: number[] = [];
    const stopRestoring = () => { restoringPosition.current = false; timers.forEach(window.clearTimeout); };
    const restore = () => {
      if (!restoringPosition.current || preserveIncomingLocation || location.hash) return;
      const figureId = typeof anchor?.figureId === 'string' && anchor.figureId === next.position.figureId ? anchor.figureId : undefined;
      const blockId = typeof anchor?.blockId === 'string' && source.blocks.some(block => block.id === anchor!.blockId) ? anchor.blockId : next.position.blockId;
      const target = figureId ? document.getElementById(figureId) : blockId ? document.getElementById(`source-${source.id}-${blockId}`) : null;
      const offset = Number.isFinite(anchor?.offset) && Math.abs(anchor!.offset!) < 100_000 ? anchor!.offset! : -150;
      window.scrollTo({ top: target ? Math.max(0,window.scrollY + target.getBoundingClientRect().top + offset) : next.position.scrollY, behavior:'instant' });
    };
    [80,250,750].forEach(delay => timers.push(window.setTimeout(restore,delay)));
    timers.push(window.setTimeout(() => { restoringPosition.current = false; },850));
    window.addEventListener('wheel',stopRestoring,{passive:true});window.addEventListener('touchstart',stopRestoring,{passive:true});window.addEventListener('keydown',stopRestoring);
    return () => { timers.forEach(window.clearTimeout);window.removeEventListener('wheel',stopRestoring);window.removeEventListener('touchstart',stopRestoring);window.removeEventListener('keydown',stopRestoring); };
  // A changed source identity mounts a new ReadingSession in the workspace.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    function position() {
      if (restoringPosition.current) return;
      const prefix = `source-${source.id}-`;
      const blocks = [...document.querySelectorAll<HTMLElement>('.research-article .source-block')];
      const block = blocks.filter(item => item.getBoundingClientRect().top <= 130).at(-1);
      const figures = [...document.querySelectorAll<HTMLElement>('.research-article .paperplay-figure')];
      const figure = figures.filter(item => item.getBoundingClientRect().top <= 150).at(-1);
      const known = figure && figure.getBoundingClientRect().bottom > 150 && (current.current.experiment?.figure.id === figure.id || current.current.figures.some(item => item.snapshot.figure.id === figure.id));
      const blockId = block?.id.startsWith(prefix) ? block.id.slice(prefix.length) : undefined;
      const target = known ? figure : block;
      try { localStorage.setItem(`paperplay:anchor-offset:${source.id}:${source.sourceVersion}`,JSON.stringify({blockId,...(known?{figureId:figure.id}:{}),offset:target ? -target.getBoundingClientRect().top : 0})); } catch { /* Reading state still stores its stable source ID and absolute position. */ }
      persist(value => ({ ...value, position: { scrollY: Math.max(0, window.scrollY), ...(blockId ? { blockId } : {}), ...(known ? { figureId: figure.id } : {}) } }), false);
    }
    function scroll() { window.clearTimeout(timer); timer = window.setTimeout(position, 250); }
    window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('pagehide', position);
    // A replacement snapshot or deletion may have been committed before unmount.
    // Never flush this stale session over the newly saved state.
    return () => { window.clearTimeout(timer); window.removeEventListener('scroll', scroll); window.removeEventListener('pagehide', position); };
  }, [ready, source.id, persist]);
  const putFigure = useCallback((view: FigureViewState) => persist(value => ({ ...value, figures: [...value.figures.filter(item => item.snapshot.figure.id !== view.snapshot.figure.id), view].slice(-32) })), [persist]);
  const putExperiment = useCallback((experiment: ExperimentSnapshot) => persist(value => ({ ...value, experiment })), [persist]);
  return <ReadingContext.Provider value={{ ready, state, warning, putFigure, putExperiment }}>{warning && <p role="status" className="reading-storage-note">{warning}</p>}<Fragment key={ready ? 'restored' : 'initial'}>{children}</Fragment></ReadingContext.Provider>;
}
export function useReadingSession() { return useContext(ReadingContext); }
export function figureSnapshot(source: SourceDocument, figure: FigureSpecification, seed = 42): ExperimentSnapshot {
  return { schemaVersion: 1, documentId: source.id, sourceVersion: source.sourceVersion, figure, seed };
}
/** Initial values are read after the session's restoration remount, before controls appear. */
export function useFigureView(source: SourceDocument, figure: FigureSpecification, seed = 42) {
  const session = useReadingSession();
  const saved = session?.ready ? session.state.figures.find(item => item.snapshot.figure.id === figure.id) : undefined;
  return { saved, save: session?.ready ? (next: FigureSpecification, stepIndex: number, selection = '') => session.putFigure({ snapshot: figureSnapshot(source, next, seed), stepIndex, selection }) : undefined };
}
