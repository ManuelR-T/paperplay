import {PaperOpening,PAPER_DURATION} from './scenes/Opening';
import {Momentum,MOMENTUM_DURATION} from './scenes/Momentum';
import { Composition } from 'remotion';
import { Demo, DEMO_DURATION } from './Demo';
import { Opening as Hero, OPENING_DURATION as HERO_DURATION } from './scenes/Opening';
import { Fresh, FRESH_DURATION, Live, LIVE_DURATION, Play, PLAY_DURATION } from './scenes/Live';
import { HowItWorks, HOW_DURATION, Outro, OUTRO_DURATION } from './scenes/Story';
import { FPS, HEIGHT, WIDTH } from './theme';

export function Root() {
  return <>
    <Composition id="PaperplayDemo" component={Demo} durationInFrames={DEMO_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    {/* Single scenes, for previewing and stills. */}
    <Composition id="PaperIntroOnly" component={PaperOpening} durationInFrames={PAPER_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="MomentumOnly" component={Momentum} durationInFrames={MOMENTUM_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="HeroOnly" component={Hero} durationInFrames={HERO_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="FreshOnly" component={Fresh} durationInFrames={FRESH_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="LiveOnly" component={Live} durationInFrames={LIVE_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="PlayOnly" component={Play} durationInFrames={PLAY_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="HowOnly" component={HowItWorks} durationInFrames={HOW_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
    <Composition id="OutroOnly" component={Outro} durationInFrames={OUTRO_DURATION} fps={FPS} width={WIDTH} height={HEIGHT}/>
  </>;
}
