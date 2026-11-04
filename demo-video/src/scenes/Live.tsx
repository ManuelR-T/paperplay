import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import liveJson from '../../public/clips/live.json';
import playJson from '../../public/clips/live-play.json';
import { trackedRegion, clipDuration, marks, mark, type ClipMeta, type Region } from '../clip';
import { ClipView, SpeedBadge, Stage, Window } from '../components';
import { C, FPS, sans, seconds, serif } from '../theme';
import type {ReactNode} from 'react';

/** Captions sit in the page margin, never over a diagram, slider or result table. */
function MarginCaption({children,duration,accent,left=1390,top=180,width=420}:{children:ReactNode;duration:number;accent?:string;left?:number;top?:number;width?:number}){
 const frame=useCurrentFrame();
 const opacity=Math.min(1,frame/8,Math.max(0,(duration-frame)/8));
 return <div style={{position:'absolute',left,top,width,padding:'26px 28px',boxSizing:'border-box',borderRadius:16,border:`1px solid ${C.line}`,background:C.paper,boxShadow:'0 12px 32px #172f2d12',opacity,fontFamily:sans}}>
  {accent&&<div style={{marginBottom:12,fontSize:18,fontWeight:700,color:C.olive,letterSpacing:1}}>{accent}</div>}
  <div style={{fontSize:28,lineHeight:1.4,color:C.ink}}>{children}</div>
 </div>;
}

const live = liveJson as unknown as ClipMeta, play = playJson as unknown as ClipMeta;
const PAPER = { id: '2610.41958', title: 'WASABI: Wasserstein Sampling via Bridge Interpolants', submitted: 'Submitted 30 Oct 2026', license: 'CC BY 4.0' };

/** "A paper nobody has illustrated": the link types itself, the submission date lands. */
export const FRESH_DURATION = seconds(5.2);
export function Fresh() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const link = `arxiv.org/abs/${PAPER.id}`, typed = Math.floor(interpolate(frame, [28, 28 + link.length * 1.6], [0, link.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const card = spring({ frame: frame - 14, fps, config: { damping: 18 } }), stamp = spring({ frame: frame - 82, fps, config: { damping: 11, mass: 0.6 } });
  const title = spring({ frame, fps, config: { damping: 20 } });
  return <Stage>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 170, textAlign: 'center', fontFamily: serif, fontSize: 88, letterSpacing: -2, opacity: title, transform: `translateY(${(1 - title) * 30}px)` }}>Now, a fresh paper. <span style={{ color: C.olive }}>Let Meta illustrate it.</span></div>
    <div style={{ position: 'absolute', left: 360, right: 360, top: 400, padding: '44px 54px', borderRadius: 26, background: C.paper, boxShadow: '0 40px 90px #172f2d2e, 0 0 0 1px #172f2d14', opacity: card, transform: `translateY(${(1 - card) * 40}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderRadius: 14, background: C.chrome, fontSize: 38, fontFamily: sans, fontWeight: 500, color: C.ink }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.soft} strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
        {link.slice(0, typed)}<span style={{ width: 3, height: 40, background: C.olive, opacity: frame % 30 < 15 ? 1 : 0 }}/>
      </div>
      <div style={{ marginTop: 30, fontFamily: serif, fontSize: 46, lineHeight: 1.2, letterSpacing: -0.6, opacity: interpolate(frame, [70, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{PAPER.title}</div>
      <div style={{ marginTop: 20, display: 'flex', gap: 14, fontSize: 26, fontWeight: 600, opacity: stamp, transform: `scale(${0.8 + stamp * 0.2})`, transformOrigin: 'left center' }}>
        <span style={{ padding: '8px 16px', borderRadius: 999, background: C.lime, color: C.ink }}>{PAPER.submitted}</span>
        <span style={{ padding: '8px 16px', borderRadius: 999, background: C.chrome, color: C.soft }}>{PAPER.license}</span>
      </div>
    </div>
  </Stage>;
}

// The real generation, cut into honest segments: quiet stretches sped up (and labelled), key moments at 1×.
type Segment = { from: number; to: number; rate: number; caption?: string; accent?: string; revisedFigure?: boolean };
function segments(): Segment[] {
  const plan = mark(live, 'plan'), arrivals = marks(live, 'arrival'), ready = marks(live, 'ready')[0] ?? live.duration - 2.5;
  const fast = (from: number, to: number, target: number, caption?: string): Segment => ({ from, to, rate: Math.max(1, (to - from) / target), caption });
  const first = arrivals[0] ?? ready - 4;
  const lastBuilding=marks(live,'building').at(-1);
  const finalWait=lastBuilding!==undefined&&lastBuilding>first+3.4&&lastBuilding<ready-.5?Math.min(lastBuilding+5,ready-.5):null;
  const finalHoldEnd=finalWait===null?null:Math.min(finalWait+3,ready);
  const reading = marks(live, 'reading')[0] ?? 4;
  // The full take includes a development-server recovery wait. Cut that quiet
  // interval, then give every delivered figure its own readable overview.
  if(arrivals.length>=5){
    const [a,b,,,e]=arrivals;
    const bridge=marks(live,'bridge-view')[0]??b+.3;
    const resumed=marks(live,'building')[2]??a+3.4;
    const lastWait=(marks(live,'building').at(-1)??e-12)+5;
    return [
      fast(1,reading,1.6),
      {from:reading,to:reading+3.6,rate:1,caption:'Meta reads the complete paper'},
      fast(reading+3.6,plan-1.2,3,'Meta reads the complete paper'),
      {from:plan-1.2,to:plan+5.6,rate:1,caption:'and selects complementary passages to illustrate',accent:'Plan'},
      fast(plan+5.6,a-1,2,'Each choice is anchored to its source passage'),
      {from:a-.3,to:a+3.3,rate:1,caption:'The first figure opens beside its passage'},
      fast(Math.max(resumed,a+4),bridge-.3,2.5,'Meta builds and checks the custom interactions'),
      {from:bridge,to:bridge+3,rate:1,caption:'A bridge from the prior to the endpoint'},
      fast(bridge+3,lastWait,3,'The remaining illustrations explain complementary parts of the method'),
      {from:lastWait,to:lastWait+3,rate:1,caption:'The last figure stays in view while Meta builds it'},
      fast(lastWait+3,e-.3,1.5,`${arrivals.length} figures · about ${Math.round(ready/60)} minutes elapsed`),
      // The first generated version was cluttered. Show the real Meta revision,
      // explicitly labelled, rather than leaving that rejected layout in this take.
      {from:.3,to:4.7,rate:1,revisedFigure:true,accent:'Revised Meta figure',caption:'One shared chart. A clear legend. Exact moments that follow the shift.'},
    ].filter(segment=>segment.to-segment.from>.2);
  }
  const list: Segment[] = [
    fast(0, reading, 1.6),
    { from: reading, to: reading + 3.6, rate: 1, caption: 'Meta reads the complete paper' },
    fast(reading + 3.6, plan - 1.2, 3, 'Meta reads the complete paper'),
    { from: plan - 1.2, to: plan + 5.6, rate: 1, caption: 'and chooses the passages that need an experiment', accent: 'Plan' },
    fast(plan + 5.6, first - 1, 3, 'Each choice appears in the text while it is built'),
    { from: first - 1, to: first + 3.4, rate: 1, caption: 'A figure lands beside the sentence it explains', accent: 'Live' },
    ...(finalWait!==null&&finalHoldEnd!==null?[
      fast(first+3.4,finalWait,4,'Each selected figure is built beside its passage'),
      {from:finalWait,to:finalHoldEnd,rate:1,caption:'The last figure stays in view while Meta prepares it'},
      fast(finalHoldEnd,ready,3,`${Math.max(arrivals.length,1)} figures, about ${Math.max(1,Math.round(ready/60))} minutes of real work`),
    ]:[fast(first+3.4,ready,5,`${Math.max(arrivals.length,1)} figures, about ${Math.max(1,Math.round(ready/60))} minutes of real work`)]),
    { from: ready, to: Math.min(live.duration, ready + 2.4), rate: 1 },
  ];
  return list.filter(segment => segment.to - segment.from > 0.2);
}
const SEGMENTS = segments();
const length = (segment: Segment) => seconds((segment.to - segment.from) / segment.rate);
export const LIVE_DURATION = SEGMENTS.reduce((sum, segment) => sum + length(segment), 0);

const FULL: Region = { x: 0, y: 0, width: live.viewport.width, height: live.viewport.height };
export function Live() {
  let at = 0;
  return <Stage>
    <Window style={{ left: 40, top: 24, width: 1840, height: 1032 }} label={`Paperplay · ${PAPER.title}`}>
      {SEGMENTS.map((segment, i) => { const from = at; at += length(segment);
        return <Sequence key={i} from={from} durationInFrames={length(segment)}>{segment.revisedFigure
          ? <ClipView clip={play} src="clips/live-play.mp4" startAt={segment.from} rate={segment.rate} region={()=>({x:450*play.scale,y:205*play.scale,width:700*play.scale,height:770*play.scale})} width={1840} height={998} fit="contain" cursor={false}/>
          : <ClipView clip={live} src="clips/live.mp4" startAt={segment.from} rate={segment.rate} region={t=>trackedRegion(live,t,FULL)} width={1840} height={998} fit="contain" cursor={false}/>}</Sequence>; })}
    </Window>
    {(() => { let t0 = 0; return SEGMENTS.map((segment, i) => { const from = t0; t0 += length(segment);
      return <Sequence key={`c${i}`} from={from} durationInFrames={length(segment)}>
        <SpeedBadge rate={segment.rate} duration={length(segment)}/>
        {segment.caption && <MarginCaption duration={length(segment)} accent={segment.accent}>{segment.caption}</MarginCaption>}
      </Sequence>; }); })()}
  </Stage>;
}

/** The finished paper in the reader's hands: play with a new figure, then return to its source. */
const PLAY_SPEED = 1.2; // a manual drag, tightened for the edit
export const PLAY_DURATION = seconds((clipDuration(play) - 0.2) / PLAY_SPEED);
export function Play() {
  const drag=marks(play,'drag')[0]/PLAY_SPEED,source=(marks(play,'source')[0]??clipDuration(play))/PLAY_SPEED,end=clipDuration(play)/PLAY_SPEED;
  const t=useCurrentFrame()/FPS;
  const split=interpolate(t,[Math.max(0,source-.9),Math.max(.1,source-.6)],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  // Two cameras on the same real take. Keep the complete legend, all controls,
  // and all numerical rows; no page padding is magnified into the diagram.
  const plot:Region={x:536*play.scale,y:225.8125*play.scale,width:528*play.scale,height:408*play.scale};
  const values:Region={x:471*play.scale,y:650*play.scale,width:657*play.scale,height:320*play.scale};
  const full:Region={x:0,y:0,width:play.viewport.width,height:1200*play.scale};
  return <Stage>
    <div style={{position:'absolute',left:80,top:65,fontFamily:serif,fontSize:66,color:C.ink,opacity:split}}>Change the shift. Follow the distribution.</div>
    <Window style={{left:70,top:180,width:1010,height:820,opacity:split}} label="A Meta-generated illustration · standard and tilted noise">
      <ClipView clip={play} src="clips/live-play.mp4" rate={PLAY_SPEED} region={()=>plot} width={1010} height={786} fit="contain" cursor={false}/>
    </Window>
    <Window style={{left:1120,top:180,width:730,height:500,opacity:split}} label="The same live figure · controls and numerical results">
      <ClipView clip={play} src="clips/live-play.mp4" rate={PLAY_SPEED} region={()=>values} width={730} height={466} fit="contain"/>
    </Window>
    <div style={{opacity:1-split}}><Window style={{left:40,top:24,width:1840,height:1032}} label="Paperplay · Return to the cited passage">
      <ClipView clip={play} src="clips/live-play.mp4" rate={PLAY_SPEED} region={()=>full} width={1840} height={998} fit="contain"/>
    </Window></div>
    <Sequence from={seconds(drag)} durationInFrames={seconds(Math.max(0,source-.6-drag))}><MarginCaption left={1120} top={730} width={730} duration={seconds(Math.max(0,source-.6-drag))}>The green curve reweights the noise. Move the shift to see which values it favors.</MarginCaption></Sequence>
    <Sequence from={seconds(source)} durationInFrames={seconds(end-source)}><MarginCaption duration={seconds(end-source)}>One click back to the exact passage it explains.</MarginCaption></Sequence>
  </Stage>;
}
