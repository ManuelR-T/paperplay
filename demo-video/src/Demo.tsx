import { linearTiming, springTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { Opening as Hero, OPENING_DURATION as HERO_DURATION } from './scenes/Opening';
import { Fresh, FRESH_DURATION, Live, LIVE_DURATION, Play, PLAY_DURATION } from './scenes/Live';
import { HowItWorks, HOW_DURATION, Outro, OUTRO_DURATION } from './scenes/Story';

const T = 18; // transition length, frames
const scenes = [
  { id: 'hero', duration: HERO_DURATION, Scene: Hero },
  { id: 'fresh', duration: FRESH_DURATION, Scene: Fresh },
  { id: 'live', duration: LIVE_DURATION, Scene: Live },
  { id: 'play', duration: PLAY_DURATION, Scene: Play },
  { id: 'how', duration: HOW_DURATION, Scene: HowItWorks },
  { id: 'outro', duration: OUTRO_DURATION, Scene: Outro },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentations = [slide({ direction: 'from-right' }), fade(), fade(), wipe({ direction: 'from-left' }), fade()] as TransitionPresentation<any>[];
export const DEMO_DURATION = scenes.reduce((sum, scene) => sum + scene.duration, 0) - T * (scenes.length - 1);

export function Demo() {
  return <TransitionSeries>
    {scenes.flatMap(({ id, duration, Scene }, i) => [
      <TransitionSeries.Sequence key={id} durationInFrames={duration}><Scene/></TransitionSeries.Sequence>,
      ...(i < scenes.length - 1 ? [<TransitionSeries.Transition key={`${id}-t`} presentation={presentations[i]} timing={i === 0 ? springTiming({ config: { damping: 200 }, durationInFrames: T }) : linearTiming({ durationInFrames: T })}/>] : []),
    ])}
  </TransitionSeries>;
}
