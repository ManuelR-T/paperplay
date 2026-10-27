import type { CustomFrame } from './custom-runtime';

/** One camera for the whole recorded trajectory: stepping cannot hide a point or move the axes. */
export function customSceneBounds(frames: readonly CustomFrame[]) {
  let left=0,top=0,right=600,bottom=320;
  for(const frame of frames)for(const mark of frame.marks){
    const radius=mark.radius??0;
    left=Math.min(left,mark.x-radius,mark.x2??mark.x);
    top=Math.min(top,mark.y-radius,mark.y2??mark.y);
    right=Math.max(right,mark.x+radius+(mark.width??0),mark.x2??mark.x,mark.shape==='text'?mark.x+(mark.label.length+20)*11:mark.x);
    bottom=Math.max(bottom,mark.y+radius+(mark.height??0),mark.y2??mark.y);
  }
  return {x:left-16,y:top-16,width:right-left+32,height:bottom-top+32};
}
