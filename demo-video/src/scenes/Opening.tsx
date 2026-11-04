import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Hero as PaperInteraction} from './Hero';
import {seconds} from '../theme';
import {Momentum,MOMENTUM_DURATION} from './Momentum';

// Keep the real pointer click and opening animation, ending before the old split view.
export const PAPER_DURATION=seconds(4.2);
const TRANSITION=seconds(.8);
export const OPENING_DURATION=PAPER_DURATION+MOMENTUM_DURATION-TRANSITION;
export function PaperOpening(){return <PaperInteraction/>;}
export function Opening(){
 return <TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={PAPER_DURATION}><PaperOpening/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:TRANSITION})}/>
  <TransitionSeries.Sequence durationInFrames={MOMENTUM_DURATION}><Momentum/></TransitionSeries.Sequence>
 </TransitionSeries>;
}
