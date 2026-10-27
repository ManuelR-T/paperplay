'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export function usePlayback(length: number, identity: unknown, initialIndex = 0) {
  const [index, setIndex] = useState(initialIndex);
  const previousIdentity = useRef(identity);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (previousIdentity.current !== identity) { setIndex(0); setPlaying(false); previousIdentity.current = identity; } }, [identity]);
  useEffect(() => {
    if (!playing || reducedMotion || index >= length - 1) return;
    const timer = window.setTimeout(() => setIndex(current => Math.min(current + 1, length - 1)), 850 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, index, length, speed]);
  return { index: Math.min(index, Math.max(0, length - 1)), playing: playing && index < length - 1 && !reducedMotion, speed, reducedMotion,
    seek: (value: number) => { setIndex(value); setPlaying(false); },
    toggle: () => { if (index >= length - 1) { setIndex(0); setPlaying(true); } else setPlaying(value => !value); },
    setSpeed, reset: () => { setIndex(0); setPlaying(false); setSpeed(1); } };
}

type Playback = ReturnType<typeof usePlayback>;
export function PlaybackControls({ playback, length, label }: { playback: Playback; length: number; label: string }) {
  return <div className="trace-controls">
    <div className="playback-buttons">
      <Button variant="outline" size="icon" aria-label={`Previous step: ${label}`} disabled={playback.index === 0} onClick={() => playback.seek(playback.index - 1)}><SkipBack /></Button>
      <Button size="sm" aria-label={`${playback.playing ? 'Pause' : 'Play'} ${label}`} disabled={length < 2 || playback.reducedMotion} onClick={playback.toggle}>{playback.playing ? <Pause /> : <Play />}{playback.playing ? 'Pause' : 'Play'}</Button>
      <Button variant="outline" size="icon" aria-label={`Next step: ${label}`} disabled={playback.index >= length - 1} onClick={() => playback.seek(playback.index + 1)}><SkipForward /></Button>
      <Button variant="ghost" size="icon" aria-label={`Restart playback: ${label}`} onClick={playback.reset}><RotateCcw /></Button>
      <label className="speed-control">Speed<select aria-label={`Playback speed: ${label}`} value={playback.speed} onChange={event => playback.setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
    </div>
    <div className="seek-row"><Slider aria-label={`Seek trace: ${label}`} min={0} max={Math.max(1, length - 1)} step={1} disabled={length < 2} value={[playback.index]} onValueChange={values => playback.seek(values[0])} /><output>Step {playback.index + 1} / {length}</output></div>
    {playback.reducedMotion && <p className="control-hint">Reduced motion is enabled. Use the step buttons or seek control.</p>}
  </div>;
}
