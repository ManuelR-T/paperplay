'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../ui/button';

export function WidgetTimeline({ step, length, identity, label, onSeek, active = true }: { step: number; length: number; identity: string; label: string; onSeek: (step: number) => void; active?: boolean }) {
  const [playing, setPlaying] = useState(false); const [speed, setSpeed] = useState(1); const [reduced, setReduced] = useState(false);
  const seek = useRef(onSeek); seek.current = onSeek;
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { setPlaying(false); }, [identity, reduced, active]);
  useEffect(() => {
    if (!active || !playing || reduced || step >= length - 1) return;
    const timer = setTimeout(() => seek.current(step + 1), 850 / speed);
    return () => clearTimeout(timer);
  }, [active, playing, reduced, step, length, speed]);
  const running = playing && !reduced && step < length - 1;
  function jump(next: number) { setPlaying(false); onSeek(next); }
  return <div className="widget-timeline">
    <div className="widget-timeline-buttons"><Button variant="ghost" aria-label={`Previous ${label.toLowerCase()}`} disabled={step <= 0} onClick={() => jump(step - 1)}><SkipBack size={17}/><span>Previous</span></Button>
      <Button variant={step >= length - 1?'default':'outline'} disabled={length < 2 || reduced} onClick={() => { if (step >= length - 1) onSeek(0); setPlaying(!running); }}>{running ? <Pause size={17}/> : <Play size={17}/>} {running ? 'Pause' : step >= length - 1 ? 'Replay' : 'Play'}</Button>
      <Button aria-label={`Next ${label.toLowerCase()}`} disabled={step >= length - 1} onClick={() => jump(step + 1)}><span>Next</span><SkipForward size={17}/></Button>
      <details className="widget-playback-options"><summary>Playback settings</summary><div><Button variant="ghost" aria-label="Restart steps" onClick={() => jump(0)}><RotateCcw size={17}/></Button>
      <label>Speed<select aria-label="Step playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label></div></details></div>
    <label className="widget-step-slider">{label} {step + 1} of {length}<input type="range" aria-label={`Seek ${label.toLowerCase()}`} min={0} max={Math.max(0, length - 1)} step={1} value={step} disabled={length < 2} onChange={event => jump(Number(event.target.value))}/></label>
    {reduced && <p className="widget-hint">Reduced motion is enabled. Use Previous, Next or the slider.</p>}
  </div>;
}
