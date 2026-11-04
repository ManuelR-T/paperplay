import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Freeze,interpolate,useCurrentFrame} from 'remotion';
import {Hero as PaperInteraction,HERO_FIGURE_OPEN_FRAME} from './Hero';
import {C,FPS,sans,seconds} from '../theme';
import {Momentum,MOMENTUM_DURATION} from './Momentum';

// Give the source equation time to land, then resume the actual Show figure click.
const EQUATION_AT=seconds(1.2),EQUATION_HOLD=seconds(4.5);
export const PAPER_DURATION=seconds(4.2)+EQUATION_HOLD;
export const OPENING_CLICK_FRAME=HERO_FIGURE_OPEN_FRAME+EQUATION_HOLD;
const TRANSITION=seconds(.8);
export const OPENING_DURATION=PAPER_DURATION+MOMENTUM_DURATION-TRANSITION;
export function PaperOpening(){
 const frame=useCurrentFrame(),t=frame/FPS;
 const footageFrame=frame<EQUATION_AT?frame:frame<EQUATION_AT+EQUATION_HOLD?EQUATION_AT:frame-EQUATION_HOLD;
 const copy=t<3.6?'The equation is precise. Its behavior can be hard to picture.':'Paperplay turns it into something you can explore.';
 const opacity=Math.min(
  interpolate(t,[1.3,1.65],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),
  interpolate(t,[5.7,6],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),
  t<3.6?interpolate(t,[3.35,3.6],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}):interpolate(t,[3.6,3.85],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),
 );
 return <>
  <Freeze frame={footageFrame}><PaperInteraction/></Freeze>
  <div style={{position:'absolute',left:160,top:144,width:1600,fontFamily:sans,fontSize:26,lineHeight:1.2,color:C.olive,opacity}}>{copy}</div>
 </>;
}
export function Opening(){
 return <TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={PAPER_DURATION}><PaperOpening/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:TRANSITION})}/>
  <TransitionSeries.Sequence durationInFrames={MOMENTUM_DURATION}><Momentum/></TransitionSeries.Sequence>
 </TransitionSeries>;
}
