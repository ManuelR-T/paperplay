import data from './tilted-noise.json';
import type {SdkFrame} from '../../../shared/figure-sdk';

const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Post-production timing; every displayed state comes from the unchanged Meta program. */
export function tiltedReplay(t:number){
 const raw=t<.6?1:t<2.2?1-smooth((t-.6)/1.6):t<2.8?0:t<4.3?-1.5*smooth((t-2.8)/1.5):t<4.9?-1.5:t<6.5?-1.5+3*smooth((t-4.9)/1.6):1.5;
 const value=Math.round(raw*100)/100,sample=data.samples[Math.round((value+2)*100)];
 const frame=structuredClone(data.base) as SdkFrame;
 data.dynamicIndices.forEach((index,n)=>{
  const mark=frame.marks[index],p=sample.geometry[n];
  if(mark.kind==='line'){mark.from=[p[0],p[1]];mark.to=[p[2],p[3]];}
  else if(mark.kind==='text')mark.at=[p[0],p[1]];
 });
 frame.table.rows=sample.rows;frame.controls=frame.controls.map(control=>control.kind==='slider'?{...control,value}:control);frame.state={a:value};
 return {frame,value,dragging:t>=.6&&t<2.2||t>=2.8&&t<4.3||t>=4.9&&t<6.5};
}
