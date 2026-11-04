import {Html5Audio,Sequence,interpolate,staticFile} from 'remotion';
import {FPS,seconds} from './theme';

type Cue={frame:number;sound:'soft-click'|'gentle-reveal'|'soft-transition';volume:number};
export function Soundtrack({duration,cues,animationAt,outroAt}:{duration:number;cues:Cue[];animationAt:number;outroAt:number}){
 return <>
  <Html5Audio src={staticFile('audio/cylinder-five.m4a')} volume={frame=>{
   const fadeIn=interpolate(frame,[0,seconds(2)],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
   const fadeOut=interpolate(frame,[duration-seconds(3),duration],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
   const level=interpolate(frame,[0,animationAt,animationAt+FPS,outroAt-FPS,outroAt, duration],[.26,.26,.34,.28,.36,.36],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
   return level*fadeIn*fadeOut;
  }}/>
  {cues.map((cue,index)=><Sequence key={index} from={Math.max(0,cue.frame)} durationInFrames={seconds(cue.sound==='gentle-reveal'?.95:cue.sound==='soft-click'?.11:.45)} layout="none"><Html5Audio src={staticFile(`audio/${cue.sound}.wav`)} volume={cue.volume}/></Sequence>)}
 </>;
}
