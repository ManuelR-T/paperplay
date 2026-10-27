import type { CustomFrame, EvaluatedMark } from './custom-runtime';
import type { CustomWidgetSpec } from '../../shared/custom-widget';

/** The renderer and camera use the same wrapped text dimensions. */
export function customLabelLines(mark: EvaluatedMark) {
  const label = mark.shape === 'text' ? `${mark.label}: ${Number(mark.value?.toPrecision(6))}` : mark.label;
  const words = label.match(/\S{1,28}/g) ?? [];
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last && last.length + word.length < 29) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Fit the full trajectory once; seeking never pans or rescales the scene. */
export function customSceneBounds(frames: readonly CustomFrame[], layout?: CustomWidgetSpec['layout']) {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  if (layout?.fit !== 'content') { left=0;top=0;right=600;bottom=320; }
  for(const frame of frames)for(const mark of frame.marks){
    if(mark.opacity===0)continue;
    const radius=mark.radius??0;
    const ellipse=mark.shape==='ellipse';
    const text=mark.shape==='text'||mark.shape==='label';
    const lines=text?customLabelLines(mark):[];
    const halfWidth=ellipse?(mark.width??0)/2:radius;
    const halfHeight=ellipse?(mark.height??0)/2:radius;
    left=Math.min(left,mark.x-halfWidth,mark.x2??mark.x);
    top=Math.min(top,mark.y-halfHeight-(text?17:0),mark.y2??mark.y);
    right=Math.max(right,mark.x+halfWidth+(ellipse?0:mark.width??0),mark.x2??mark.x,text?mark.x+Math.max(...lines.map(line=>line.length))*11:mark.x);
    bottom=Math.max(bottom,mark.y+halfHeight+(ellipse?0:mark.height??0),mark.y2??mark.y,text?mark.y+(lines.length-1)*24+6:mark.y);
  }
  if(!Number.isFinite(left)) {left=0;top=0;right=600;bottom=320;}
  const padding=layout?.padding??24;
  // Avoid zooming a single tiny object into an unreadably oversized glyph.
  const width=Math.max(240,right-left),height=Math.max(120,bottom-top);
  return {x:left-(width-(right-left))/2-padding,y:top-(height-(bottom-top))/2-padding,width:width+2*padding,height:height+2*padding};
}
