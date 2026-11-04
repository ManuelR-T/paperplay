import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import heroJson from '../../public/clips/hero.json';
import { trackedRegion, cameraPath, clipDuration, mark, type ClipMeta, type Region } from '../clip';
import { Caption, ClipView, Stage, Window } from '../components';
import { C, FPS, sans, seconds, serif } from '../theme';

const hero = heroJson as unknown as ClipMeta;
// The sharp take was performed slower than planned (each 2× frame takes time to grab); play it a bit faster.
const SPEED = 1.55;
export const HERO_DURATION = seconds((clipDuration(hero) - 0.2) / SPEED);

// Regions in CSS pixels of the 1440-wide captured window, converted to capture pixels.
const px = (region: Region): Region => ({ x: region.x * hero.scale, y: region.y * hero.scale, width: region.width * hero.scale, height: region.height * hero.scale });
const PASSAGE = px({ x: 352, y: 877, width: 735, height: 413 });
const FIGURE = px({ x: 352, y: 82, width: 735, height: 413 });
// The drawing itself, not the empty lower half of the figure's canvas (aspect of the left window).
const SCENE = px({ x: 442, y: 112, width: 540, height: 433 });
// Use the measured control card, including its neighbour and breathing room.
// Contain the region: a wider card must never be zoomed until its labels crop.
const betaCard=hero.regions?.beta;
const CONTROLS:Region=betaCard?{
  x:betaCard.x-betaCard.width-24-32,y:betaCard.y-32,
  width:betaCard.width*2+24+64,height:betaCard.height+64,
}:px({x:395,y:865,width:452,height:257});

const at = (label: string) => mark(hero, label) / SPEED;
const opened = at('figure-open'), betaZero = at('beta-0'), betaHalf = at('beta-05'), betaHigh = at('beta-09');
export const HERO_FIGURE_OPEN_FRAME=seconds(opened);
const SPLIT = betaZero - 0.4;

// Each explanation stays until the next one, as soon as the slider settles on its value.
const beats = [
  { at: at('beta-0-settled'), until: betaHalf, value: 'β = 0', line: 'Plain gradient descent crawls along the flat valley.' },
  { at: at('beta-05-settled'), until: betaHigh, value: 'β = 0.5', line: 'Moderate momentum speeds progress along the flat direction.' },
  { at: at('beta-09-settled'), until: clipDuration(hero) / SPEED, value: 'β = 0.9', line: 'Too much momentum: it overshoots and spirals.' },
];

function Beat({ value, line, from, duration }: { value: string; line: string; from: number; duration: number }) {
  const frame = useCurrentFrame() - from, { fps } = useVideoConfig();
  if (frame < 0 || frame > duration) return null;
  const p = spring({ frame, fps, config: { damping: 16, mass: 0.7 } }), out = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, padding: '46px 48px', opacity: p * out, transform: `translateY(${(1 - p) * 18}px)` }}>
    <div style={{ fontFamily: serif, fontSize: 104, lineHeight: 1, color: C.olive, letterSpacing: -2 }}>{value}</div>
    <div style={{ marginTop: 22, fontSize: 40, lineHeight: 1.25, fontWeight: 500, letterSpacing: -0.6 }}>{line}</div>
  </div>;
}

export function Hero() {
  const frame = useCurrentFrame(), t = frame / FPS;
  const split = interpolate(t, [SPLIT, SPLIT + 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // While the page scrolls, a crossfade between two fixed cameras: the figure rises into place.
  const CUT = opened + 1.25, cut = interpolate(t, [CUT, CUT + 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const settle = cameraPath([{ at: 0, region: FIGURE }, { at: SPLIT - 0.2, region: FIGURE }, { at: SPLIT + 0.7, region: SCENE }], 0.9);
  const intro = interpolate(t, [0.2, 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <Stage>
    {/* Act 1: the passage as the paper wrote it, then the figure opens in place. */}
    <div style={{ position: 'absolute', left: 160, top: 70, opacity: (1 - split) * intro, fontFamily: serif, fontSize: 64, letterSpacing: -1.2 }}>
      {t < opened + 0.6 ? 'This is how a paper explains momentum.' : <span>…and this is the same passage <span style={{ color: C.olive }}>in Paperplay.</span></span>}
    </div>
    <Window style={{ left: 160, top: 180, width: 1600, height: 860, opacity: 1 - split, transform: `scale(${1 - split * 0.04})` }} label="Paperplay · Why Momentum Really Works (Distill, CC BY)">
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - cut }}><ClipView clip={hero} src="clips/hero.mp4" region={() => PASSAGE} rate={SPEED} width={1600} height={826}/></div>
      {cut > 0 && <div style={{ position: 'absolute', inset: 0, opacity: cut }}><ClipView clip={hero} src="clips/hero.mp4" region={clipT => settle(clipT / SPEED)} rate={SPEED} width={1600} height={826}/></div>}
    </Window>

    {/* Act 2: two cameras on one take — the path, and the control that bends it. */}
    <div style={{ opacity: split }}>
      <Window style={{ left: 80, top: 90, width: 1080, height: 900 }} label="The path of every step">
        <ClipView clip={hero} src="clips/hero.mp4" region={t => trackedRegion(hero,t,SCENE)} isolateDiagram rate={SPEED} width={1080} height={866} cursor={false}/>
      </Window>
      <Window style={{ left: 1200, top: 90, width: 640, height: 380 }} label="Momentum β">
        <ClipView clip={hero} src="clips/hero.mp4" region={() => CONTROLS} fit="contain" rate={SPEED} width={640} height={346}/>
      </Window>
      <div style={{ position: 'absolute', left: 1200, top: 500, width: 640, height: 490, borderRadius: 22, background: C.paper, boxShadow: '0 30px 70px #172f2d26, 0 0 0 1px #172f2d14', fontFamily: sans, overflow: 'hidden' }}>
        {beats.map(beat => <Beat key={beat.value} value={beat.value} line={beat.line} from={seconds(beat.at)} duration={seconds(beat.until - beat.at)}/>)}
        {!beats.some(beat=>t>=beat.at&&t<=beat.until) && <div style={{ position: 'absolute', inset: 0, padding: '46px 48px', fontSize: 40, lineHeight: 1.25, fontWeight: 500, color: C.soft, opacity: split }}>Drag <b style={{ color: C.ink }}>β</b>. The whole trajectory redraws, live.</div>}
      </div>
    </div>
    <Sequence from={seconds(opened + 0.3)} durationInFrames={seconds(SPLIT - opened - 0.4)}>
      <Caption duration={seconds(SPLIT - opened - 0.4)} y={980}>An experiment, right where the idea is.</Caption>
    </Sequence>
  </Stage>;
}
