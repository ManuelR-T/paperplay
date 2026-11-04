import preparedFrames from '../public/render-frames/index.json';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FPS, sans } from './theme';
import { pointerAt, pressAt, type ClipMeta, type Region } from './clip';

/** Soft ivory-to-sage stage with a faint paper grid. */
export function Stage({ children }: { children?: ReactNode }) {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 140) * 40;
  return <AbsoluteFill style={{ background: `radial-gradient(120% 90% at ${30 + drift / 10}% 10%, #ffffff 0%, ${C.paper} 38%, #e6efe3 100%)`, fontFamily: sans, color: C.ink }}>
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`, backgroundSize: '48px 48px', maskImage: 'radial-gradient(80% 70% at 50% 40%, black, transparent)', opacity: 0.55 }}/>
    {children}
  </AbsoluteFill>;
}

/** A clean app window: rounded, floating, no fake address bar. */
export function Window({ children, style, label }: { children: ReactNode; style?: CSSProperties; label?: string }) {
  return <div style={{ position: 'absolute', borderRadius: 22, overflow: 'hidden', background: C.paper, boxShadow: '0 40px 90px #172f2d33, 0 10px 24px #172f2d1f, 0 0 0 1px #172f2d14', ...style }}>
    <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: C.chrome, borderBottom: `1px solid ${C.line}` }}>
      {['#e2786a', '#e5bd5c', '#8cbf6a'].map(color => <span key={color} style={{ width: 11, height: 11, borderRadius: 99, background: color, opacity: 0.85 }}/>)}
      {label && <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 500, color: C.soft }}>{label}</span>}
    </div>
    <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 34px)' }}>{children}</div>
  </div>;
}

export function Cursor({ x, y, size, press }: { x: number; y: number; size: number; press: { since: number; held: boolean } }) {
  const ripple = press.since < 0.5 ? press.since / 0.5 : 1;
  const squeeze = press.held ? 0.86 : 1;
  return <>
    {ripple < 1 && <div style={{ position: 'absolute', left: x - size * 1.4 * ripple, top: y - size * 1.4 * ripple, width: size * 2.8 * ripple, height: size * 2.8 * ripple, borderRadius: '50%', border: `${size * 0.09}px solid ${C.olive}`, opacity: 1 - ripple, pointerEvents: 'none' }}/>}
    <svg viewBox="0 0 24 24" style={{ position: 'absolute', left: x - size * 0.18, top: y - size * 0.1, width: size, height: size, transform: `scale(${squeeze})`, transformOrigin: '18% 10%', filter: 'drop-shadow(0 3px 6px #0005)', overflow: 'visible' }}>
      <path d="M4 2 L4 19 L8.6 15 L11.6 21.6 L14.6 20.3 L11.7 13.9 L18 13.6 Z" fill={C.ink} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round"/>
    </svg>
  </>;
}

/**
 * Real app footage seen through a moving camera. `region` (video pixels, as a function of clip time)
 * is fitted into the box; the cursor is redrawn from the capture's pointer log in the same space.
 */
export function ClipView({ clip, src, startAt = 0, rate = 1, region, width, height, cursor = true, radius = 0, maskTop = 0, fit = 'cover', isolateDiagram = false }: {
  clip: ClipMeta; src: string; startAt?: number; rate?: number; region: (t: number) => Region; width: number; height: number; cursor?: boolean; radius?: number; maskTop?: number; fit?: 'cover'|'contain'; isolateDiagram?:boolean;
}) {
  const frame = useCurrentFrame();
  const t = startAt + (frame / FPS) * rate, r = region(t);
  const scale = fit==='contain'?Math.min(width/r.width,height/r.height):Math.max(width/r.width,height/r.height);
  const offsetX = (width - r.width * scale) / 2, offsetY = (height - r.height * scale) / 2;
  const pointer = pointerAt(clip, t), press = pressAt(clip, t);
  const prepared=(preparedFrames as Record<string,{folder:string;fps:number;frames:number}>)[src];
  const frameIndex=prepared?Math.max(0,Math.min(prepared.frames-1,Math.round(t*(clip.slowMotion??1)*prepared.fps))):0;
  return <div style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: radius, background: isolateDiagram ? '#f2f2e8' : maskTop ? '#f1f2e8' : C.paper }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: clip.viewport.width, height: clip.viewport.height, transformOrigin: '0 0', clipPath:fit==='contain'?`inset(${Math.max(0,r.y)}px ${Math.max(0,clip.viewport.width-r.x-r.width)}px ${Math.max(0,clip.viewport.height-r.y-r.height)}px ${Math.max(0,r.x)}px)`:undefined, transform: `translate(${offsetX - r.x * scale}px, ${offsetY - r.y * scale}px) scale(${scale})` }}>
      {prepared ? <Img src={staticFile(`render-frames/${prepared.folder}/${String(frameIndex).padStart(5,'0')}.jpg`)} style={{width:clip.viewport.width,height:clip.viewport.height,clipPath:isolateDiagram?`inset(${Math.max(0,r.y+r.height*.21)}px ${Math.max(0,clip.viewport.width-r.x-r.width*.9)}px ${Math.max(0,clip.viewport.height-r.y-r.height*.82)}px ${Math.max(0,r.x+r.width*.1)}px)`:maskTop?`inset(${maskTop}px 0 0 0)`:undefined}}/> : <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(startAt * (clip.slowMotion ?? 1) * FPS)} playbackRate={rate * (clip.slowMotion ?? 1)} muted style={{ width: clip.viewport.width, height: clip.viewport.height }}/>}
      {cursor && <Cursor x={pointer.x} y={pointer.y} size={38 / scale} press={press}/>}
    </div>
  </div>;
}

/** Lower-third caption: a pill that rises in, holds, and fades. */
export function Caption({ children, from = 0, duration, y = 960, accent }: { children: ReactNode; from?: number; duration: number; y?: number; accent?: string }) {
  const frame = useCurrentFrame() - from, { fps } = useVideoConfig();
  if (frame < 0 || frame > duration) return null;
  const enter = spring({ frame, fps, config: { damping: 18, mass: 0.7 } });
  const exit = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', opacity: enter * exit, transform: `translateY(${(1 - enter) * 24}px)` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 28px', borderRadius: 999, background: '#172f2dee', color: '#fffdf8', fontSize: 34, fontWeight: 500, letterSpacing: -0.4, boxShadow: '0 16px 40px #172f2d40' }}>
      {accent && <span style={{ padding: '4px 12px', borderRadius: 999, background: C.lime, color: C.ink, fontSize: 26, fontWeight: 700 }}>{accent}</span>}
      {children}
    </div>
  </div>;
}

/** Honest speed label for sped-up footage. */
export function SpeedBadge({ rate, from = 0, duration }: { rate: number; from?: number; duration: number }) {
  const frame = useCurrentFrame() - from;
  if (frame < 0 || frame > duration || rate <= 1.05) return null;
  const opacity = interpolate(frame, [0, 6, duration - 6, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', right: 70, top: 56, opacity, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 14, background: '#172f2de6', color: '#fffdf8', fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M13 19 22 12 13 5v14zM2 19l9-7-9-7v14z"/></svg>
    ×{Math.round(rate)}<span style={{ fontWeight: 500, fontSize: 20, color: '#fffdf8bb' }}>real generation, sped up</span>
  </div>;
}

/** Word-by-word headline reveal. */
export function Headline({ text, from = 0, size = 92, style, italic }: { text: string; from?: number; size?: number; style?: CSSProperties; italic?: string }) {
  const frame = useCurrentFrame() - from, { fps } = useVideoConfig();
  const words = text.split(' ');
  return <div style={{ fontSize: size, lineHeight: 1.08, letterSpacing: -size * 0.025, ...style }}>
    {words.map((word, i) => { const p = spring({ frame: frame - i * 3, fps, config: { damping: 20, mass: 0.6 } });
      return <span key={i} style={{ display: 'inline-block', marginRight: size * 0.24, opacity: p, transform: `translateY(${(1 - p) * size * 0.35}px)`, fontFamily: italic && word.includes(italic) ? undefined : undefined }}>{word}</span>; })}
  </div>;
}

export const fadeInOut = (frame: number, duration: number, edge = 12) => interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
