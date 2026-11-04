import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Stage } from '../components';
import { C, sans, seconds, serif } from '../theme';

/** Under the hood: how one paper becomes interactive. Every box is a real pipeline stage. */
export const HOW_DURATION = seconds(12);
const STEPS = [
  { title: 'The whole paper', body: 'Every section, equation and figure caption', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7M9 9h3' },
  { title: 'Meta reads & plans', body: 'muse-spark-1.3 picks the passages that need an experiment', icon: 'M12 3l1.9 4.6L19 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z' },
  { title: 'Builds each figure', body: 'Configures one of 10 widget kinds, or writes a new interactive model', icon: 'M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3' },
  { title: 'Checks before showing', body: 'Exact source quotes · validated schema · sandboxed runtime · layout', icon: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12.5l2.4 2.4 4.6-5' },
  { title: 'In your reading flow', body: 'Beside its sentence, labelled as a teaching model', icon: 'M12 7v14M3 3h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6v15h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H3zM6 7h3M6 11h3M15 7h3M15 11h3' },
];

export function HowItWorks() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const title = spring({ frame, fps, config: { damping: 20 } });
  const left = 130, gap = 26, width = (1920 - left * 2 - gap * (STEPS.length - 1)) / STEPS.length, top = 400;
  return <Stage>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontFamily: serif, fontSize: 84, letterSpacing: -1.8, opacity: title, transform: `translateY(${(1 - title) * 26}px)` }}>Under the hood, <span style={{ color: C.olive }}>Meta does the editorial work.</span></div>
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, pointerEvents: 'none' }}>
      {STEPS.slice(1).map((_, i) => { const p = interpolate(frame, [30 + (i + 1) * 22, 46 + (i + 1) * 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const x1 = left + (i + 1) * (width + gap) - gap + 2, x2 = x1 + gap - 4, y = top + 150;
        return <line key={i} x1={x1} y1={y} x2={x1 + (x2 - x1) * p} y2={y} stroke={C.olive} strokeWidth={4} strokeLinecap="round"/>; })}
    </svg>
    {STEPS.map((step, i) => { const p = spring({ frame: frame - 22 - i * 22, fps, config: { damping: 16, mass: 0.7 } });
      return <div key={step.title} style={{ position: 'absolute', left: left + i * (width + gap), top, width, height: 380, padding: '34px 28px', borderRadius: 24, background: i === 1 ? C.ink : C.paper, color: i === 1 ? C.paper : C.ink, boxShadow: '0 30px 70px #172f2d24, 0 0 0 1px #172f2d14', opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + p * 0.06})`, fontFamily: sans }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={i === 1 ? C.lime : C.olive} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={step.icon}/></svg>
        <div style={{ marginTop: 22, fontSize: 34, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.15 }}>{step.title}</div>
        <div style={{ marginTop: 14, fontSize: 23, lineHeight: 1.38, color: i === 1 ? '#fffdf8cc' : C.soft }}>{step.body}</div>
      </div>; })}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 850, textAlign: 'center', fontSize: 30, color: C.soft, opacity: interpolate(frame, [150, 170], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>Original text and figures stay visible and attributed. Added figures are teaching models, not results.</div>
  </Stage>;
}

export const OUTRO_DURATION = seconds(6);
export function Outro() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 12, mass: 0.7 } }), line = spring({ frame: frame - 16, fps, config: { damping: 20 } }), foot = interpolate(frame, [44, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <Stage>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, transform: `scale(${0.7 + logo * 0.3})`, opacity: logo }}>
        <Img src={staticFile('logo.svg')} style={{ width: 120, height: 120 }}/>
        <span style={{ fontFamily: sans, fontSize: 120, fontWeight: 700, letterSpacing: -5 }}>paperplay<span style={{ color: C.olive }}>.</span></span>
      </div>
      <div style={{ marginTop: 40, fontFamily: serif, fontSize: 62, letterSpacing: -1.2, textAlign: 'center', maxWidth: 1400, lineHeight: 1.15, opacity: line, transform: `translateY(${(1 - line) * 24}px)` }}>Turn the hardest part of a research paper<br/>into an experiment you can play with.</div>
      <div style={{ marginTop: 56, display: 'flex', gap: 16, fontSize: 28, fontWeight: 600, opacity: foot }}>
        <span style={{ padding: '10px 22px', borderRadius: 999, background: C.ink, color: C.paper }}>Powered by Meta · muse-spark-1.3</span>
        <span style={{ padding: '10px 22px', borderRadius: 999, background: C.lime, color: C.ink }}>Meta AI Hackathon</span>
      </div>
      <div style={{position:'absolute',bottom:30,left:160,right:160,textAlign:'center',fontFamily:sans,fontSize:19,lineHeight:1.5,color:C.soft,opacity:foot}}>Music: “Cylinder Five” · Chris Zabriskie · Cylinders · CC BY 4.0<br/>chriszabriskie.com/cylinders · creativecommons.org/licenses/by/4.0 · excerpted, mixed &amp; faded</div>
    </AbsoluteFill>
  </Stage>;
}
