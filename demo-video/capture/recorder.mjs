// Frame-accurate capture of the real app: Chrome screencast frames + a log of every pointer action.
// Remotion later redraws the cursor and camera from this log, so the app itself stays untouched.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Fail early if a supposedly loaded app capture contains only a blank background. */
export function assertVisibleCapture(file) {
  const stats=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-vf','signalstats,metadata=mode=print:file=-','-frames:v','1','-f','null','-'],{encoding:'utf8'});
  const low=Number(stats.match(/lavfi.signalstats.YMIN=(\d+)/)?.[1]),high=Number(stats.match(/lavfi.signalstats.YMAX=(\d+)/)?.[1]);
  if(!Number.isFinite(low)||!Number.isFinite(high)||high-low<30)throw Error('Blank app capture: check screenshot viewport coordinates after scrolling.');
}

export const VIEWPORT = { width: 1920, height: 1080 };

// mode 'screencast': cheap, CSS-pixel frames. mode 'screenshot': device-pixel frames (sharp at 2×), ~30 fps.
// slowMotion: the take is performed this many times slower; the edit plays it back that much faster.
export async function startRecording(page, name, { everyNthFrame = 1, quality = 92, viewport = VIEWPORT, scale = 1, mode = 'screencast', slowMotion = 1 } = {}) {
  const dir = path.resolve(`demo-video/.frames/${name}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [], events = [], start = Date.now() / 1000;
  let pointer = { x: viewport.width / scale / 2, y: viewport.height / scale / 2 };
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  let stopped = false, loop = Promise.resolve();
  if (mode === 'screenshot') {
    loop = (async () => {
      while (!stopped) {
        const t = Date.now() / 1000;
        // An explicit clip scale is what yields device-pixel frames in headless Chrome.
        const metrics=await cdp.send('Page.getLayoutMetrics');
        const visible=metrics.cssVisualViewport??metrics.visualViewport;
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true, captureBeyondViewport: false, clip: { x: visible.pageX, y: visible.pageY, width: visible.clientWidth, height: visible.clientHeight, scale } });
        const file = path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        if(frames.length===0)assertVisibleCapture(file);
        frames.push({ file, t: (t + Date.now() / 1000) / 2 });
      }
    })();
  } else await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame });
  const now = () => Date.now() / 1000 - start;
  const log = (type, extra = {}) => events.push({ t: now(), type, x: pointer.x, y: pointer.y, ...extra });

  const api = {
    mark: (label) => log('mark', { label }),
    camera: (region) => log('camera', { region }),
    wait: (ms) => page.waitForTimeout(ms * slowMotion),
    /** Eased pointer travel, logged so the rendered cursor follows exactly this path. */
    async move(x, y, ms = 700) {
      ms *= slowMotion;
      const from = { ...pointer }, steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const u = i / steps, e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
        pointer = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
        await page.mouse.move(pointer.x, pointer.y); log('move');
        await page.waitForTimeout(ms / steps);
      }
    },
    async moveTo(locator, ms = 700, offset = { x: 0.5, y: 0.5 }) {
      const box = await locator.boundingBox(); if (!box) throw Error('Element not visible for pointer move');
      await api.move(box.x + box.width * offset.x, box.y + box.height * offset.y, ms); return box;
    },
    async click(locator, ms = 700) {
      await api.moveTo(locator, ms); await page.waitForTimeout(120 * slowMotion);
      log('down'); await page.mouse.down(); await page.waitForTimeout(90 * slowMotion); await page.mouse.up(); log('up');
    },
    /** Drag along a horizontal slider to a fraction of its width, slowly enough to film. */
    async dragSlider(locator, toFraction, ms = 1600, fromFraction) {
      const box = await locator.boundingBox(); const y = box.y + box.height / 2;
      const at = (f) => box.x + 9 + (box.width - 18) * f;
      if (fromFraction !== undefined) await api.move(at(fromFraction), y, 500);
      log('down'); await page.mouse.down();
      ms *= slowMotion;
      const from = pointer.x, to = at(toFraction), steps = Math.round(ms / 16);
      for (let i = 1; i <= steps; i++) { const u = i / steps, e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; pointer = { x: from + (to - from) * e, y }; await page.mouse.move(pointer.x, y); log('move'); await page.waitForTimeout(ms / steps); }
      await page.mouse.up(); log('up');
    },
    async type(text, delay = 45) { log('type', { text }); await page.keyboard.type(text, { delay }); },
    /** Smooth programmatic scroll, so the footage never jumps. */
    async scrollTo(targetY, ms = 1200) {
      ms *= slowMotion;
      log('scroll', { to: targetY });
      await page.evaluate(async ([to, ms]) => {
        document.documentElement.style.scrollBehavior = 'auto';
        const from = scrollY, start = performance.now();
        await new Promise(resolve => { const step = (now) => { const u = Math.min(1, (now - start) / ms), e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2; scrollTo(0, from + (to - from) * e); if (u < 1) requestAnimationFrame(step); else resolve(); }; requestAnimationFrame(step); });
      }, [targetY, ms]);
    },
    async scrollToElement(locator, offset = 140, ms = 1200) {
      const y = await locator.evaluate((node, offset) => node.getBoundingClientRect().top + scrollY - offset, offset);
      await api.scrollTo(Math.max(0, y), ms);
    },
    async stop(fps = 30) {
      await page.waitForTimeout(300);
      const stoppedAt = Date.now() / 1000; // screencast stops sending frames while the page is still
      stopped = true; await loop;
      if (mode !== 'screenshot') await cdp.send('Page.stopScreencast').catch(() => {});
      if (!frames.length) throw Error(`No frames captured for ${name}`);
      // Constant-frame-rate video: each frame lasts until the next one arrived.
      const first = frames[0].t, list = frames.map((frame, i) => `file '${frame.file}'\nduration ${Math.max(0.001, ((frames[i + 1]?.t ?? Math.max(stoppedAt, frame.t + 1 / fps)) - frame.t)).toFixed(4)}`).join('\n');
      const concat = path.join(dir, 'frames.txt'); // ffmpeg ignores the last entry's duration unless the frame is listed once more.
      fs.writeFileSync(concat, `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
      const out = path.resolve(`demo-video/public/clips/${name}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', `fps=${fps},scale=${viewport.width}:${viewport.height}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-movflags', '+faststart', out]);
      const offset = first - start; // screencast clock vs. event clock
      // Pointer positions are CSS pixels; the video is device pixels.
      const meta = { name, fps, slowMotion, duration: Math.max(stoppedAt, frames.at(-1).t + 1 / fps) - first, viewport, scale, frames: frames.length, events: events.map(event => ({ ...event, x: event.x * scale, y: event.y * scale, t: Math.max(0, event.t - offset) })) };
      fs.writeFileSync(path.resolve(`demo-video/public/clips/${name}.json`), JSON.stringify(meta));
      return meta;
    },
  };
  return api;
}
