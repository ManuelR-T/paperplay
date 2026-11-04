import { Easing, interpolate } from 'remotion';

export type ClipEvent = { t: number; type: 'move' | 'down' | 'up' | 'mark' | 'scroll' | 'type' | 'camera'; x: number; y: number; label?: string; region?:Region };
export type Region = { x: number; y: number; width: number; height: number };
export type ClipMeta = { name: string; fps: number; slowMotion?: number; duration: number; viewport: { width: number; height: number }; scale: number; events: ClipEvent[]; regions?: Record<string, Region> };

// All times below are seconds of the finished film: a slow-motion take is played back `slowMotion`× faster.
const slow = (clip: ClipMeta) => clip.slowMotion ?? 1;
export const clipDuration = (clip: ClipMeta) => clip.duration / slow(clip);
export const mark = (clip: ClipMeta, label: string, which = 0) => {
  const found = clip.events.filter(event => event.type === 'mark' && event.label === label)[which];
  if (!found) throw new Error(`Clip ${clip.name} has no mark "${label}" #${which}`);
  return found.t / slow(clip);
};
export const marks = (clip: ClipMeta, label: string) => clip.events.filter(event => event.type === 'mark' && event.label === label).map(event => event.t / slow(clip));

/** Pointer position at clip time t, interpolated between logged samples. */
export function pointerAt(clip: ClipMeta, filmTime: number) {
  const t = filmTime * slow(clip), moves = clip.events.filter(event => event.type !== 'mark' && event.type !== 'camera');
  let before = moves[0];
  for (const event of moves) { if (event.t > t) { const u = (t - before.t) / Math.max(1e-6, event.t - before.t); return { x: before.x + (event.x - before.x) * u, y: before.y + (event.y - before.y) * u }; } before = event; }
  return before ? { x: before.x, y: before.y } : { x: clip.viewport.width / 2, y: clip.viewport.height / 2 };
}

/** Seconds since the most recent press, and whether the button is still held. */
export function pressAt(clip: ClipMeta, filmTime: number) {
  const t = filmTime * slow(clip), downs = clip.events.filter(event => event.type === 'down' && event.t <= t), ups = clip.events.filter(event => event.type === 'up' && event.t <= t);
  const lastDown = downs.at(-1), lastUp = ups.at(-1);
  return { since: lastDown ? (t - lastDown.t) / slow(clip) : Infinity, held: !!lastDown && (!lastUp || lastUp.t < lastDown.t) };
}

const ease = Easing.bezier(0.65, 0, 0.35, 1);
/** A camera path: hold each region, then glide to the next one over `glide` seconds. */
export function cameraPath(keys: { at: number; region: Region }[], glide = 0.9) {
  return (t: number): Region => {
    if (t <= keys[0].at) return keys[0].region;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t < b.at - glide) return a.region;
      if (t < b.at) {
        const u = interpolate(t, [b.at - glide, b.at], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { x: a.region.x + (b.region.x - a.region.x) * u, y: a.region.y + (b.region.y - a.region.y) * u, width: a.region.width + (b.region.width - a.region.width) * u, height: a.region.height + (b.region.height - a.region.height) * u };
      }
    }
    return keys.at(-1)!.region;
  };
}

/** A 16:9 (or given aspect) region centred on a point, `width` wide. */
export const around = (cx: number, cy: number, width: number, aspect = 16 / 9): Region => ({ x: cx - width / 2, y: cy - width / aspect / 2, width, height: width / aspect });

/** Camera samples follow a fixed diagram feature, keeping the valley still as SVG bounds change. */
export function trackedRegion(clip:ClipMeta,t:number,fallback:Region):Region{
 const samples=clip.events.filter(event=>event.type==='camera'&&event.region);
 if(!samples.length)return fallback;
 const time=t*(clip.slowMotion??1);
 let before=samples[0];
 for(const after of samples){if(after.t>time){const u=Math.max(0,Math.min(1,(time-before.t)/Math.max(0.001,after.t-before.t)));const a=before.region!,b=after.region!;return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,width:a.width+(b.width-a.width)*u,height:a.height+(b.height-a.height)*u};}before=after;}
 return before.region!;
}
