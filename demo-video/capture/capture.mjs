// Scripted, repeatable takes of the real Paperplay app for the demo video.
//   node demo-video/capture/capture.mjs hero    → momentum figure, β slider (saved figures, no generation)
//   node demo-video/capture/capture.mjs live    → fresh profile, a paper opened by arXiv link, real Meta generation
// Requires the app on http://localhost:3000.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {ensureCaptureFocus} from './framing.mjs';
import { startRecording } from './recorder.mjs';

const require = createRequire('/home/manuel/.npm/_npx/420ff84f11983ee5/node_modules/');
const { chromium } = require('playwright');
const CHROME = '/home/manuel/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const APP = process.env.PAPERPLAY_URL ?? 'http://localhost:3000';
const SCALE = 4 / 3; // 1440 CSS px → 1920 video px: a larger, crisper interface on video
const LIVE_PAPER = process.env.LIVE_ARXIV ?? '2610.41958v1';

async function open(profile, viewport, scale = SCALE) {
  const ctx = await chromium.launchPersistentContext(profile, { executablePath: CHROME, viewport, deviceScaleFactor: scale });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', error => console.error('pageerror', error.message));
  // The Next.js dev indicator is not part of the product.
  await page.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = 'nextjs-portal{display:none!important}'; document.head.append(style); }); });
  return { ctx, page };
}
const record = (page, name, options, scale = SCALE) => startRecording(page, name, { ...options, viewport: { width: page.viewportSize().width * scale, height: page.viewportSize().height * scale }, scale });

async function hero() {
  // Captured at 2× so the zoomed split-screen crops stay sharp.
  const HERO_SCALE = 2;
  const { ctx, page } = await open('/tmp/pp-shots/profile', { width: 1440, height: 1440 }, HERO_SCALE);
  await page.goto(APP, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  if (!(await page.locator('.research-article h1').textContent()).includes('Momentum')) {
    await page.click('.library-trigger'); await page.click('.library-paper:has-text("Curvature")'); await page.waitForTimeout(2500);
  }
  const figure = page.locator('[aria-label^="Interactive figure: Momentum"]').first();
  await figure.waitFor({ timeout: 30000 });
  if (await page.locator('button[aria-label="Enter focus reading"]').count()) await page.click('button[aria-label="Enter focus reading"]');
  await figure.locator('.reading-figure-heading button').click(); // start collapsed: the hook shows the bare passage
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  const heading = page.locator('.reading-figure-heading:has(strong:text-matches("Momentum"))').first();
  await page.evaluate(y => scrollTo(0, y), await heading.evaluate(node => node.getBoundingClientRect().top + scrollY - 560));
  await page.waitForTimeout(800);

  const rec = await record(page, 'hero', { mode: 'screenshot', quality: 88, slowMotion: 3 }, HERO_SCALE);
  rec.mark('passage'); await rec.wait(2600);
  await rec.click(heading.locator('button'), 900); rec.mark('figure-open');
  await rec.wait(1400);
  const live = page.locator('[aria-label^="Interactive figure: Momentum"]').first();
  await rec.scrollToElement(live.locator('.custom-scene'), 70, 1300); await rec.wait(700);
  const beta = live.locator('input[aria-label="β slider"]:visible').first();
  // Track a fixed feature of the model, rather than the page or a guessed crop.
  // The SVG can refit its viewBox when the trajectory changes.
  let tracking=true;
  const trackingTask=(async()=>{while(tracking){
    const region=await live.locator('.custom-scene svg ellipse').first().evaluate(node=>{const b=node.getBoundingClientRect();const width=b.width*1.65;return{x:b.x+b.width/2-width/2,y:b.y+b.height/2-width/(1080/866)/2,width,height:width/(1080/866)};});
    rec.camera(Object.fromEntries(Object.entries(region).map(([k,v])=>[k,v*HERO_SCALE])));
    await page.waitForTimeout(100);
  }})();
  await beta.evaluate(node=>node.focus({preventScroll:true}));
  rec.mark('beta-0'); await rec.dragSlider(beta, 0, 2600, 0.9 / 0.95); rec.mark('beta-0-settled'); await rec.wait(4200);
  rec.mark('beta-05'); await rec.dragSlider(beta, 0.5 / 0.95, 2200, 0); rec.mark('beta-05-settled'); await rec.wait(4500);
  rec.mark('beta-09'); await rec.dragSlider(beta, 0.9 / 0.95, 2200, 0.5 / 0.95); rec.mark('beta-09-settled'); await rec.wait(4500);
  tracking=false;await trackingTask;
  rec.mark('end');
  const meta = await rec.stop();
  // Regions the edit frames: the scene and the β control, in video pixels.
  const region = async locator => { const box = await locator.boundingBox(); return box && { x: box.x * HERO_SCALE, y: box.y * HERO_SCALE, width: box.width * HERO_SCALE, height: box.height * HERO_SCALE }; };
  meta.regions = { scene: await region(live.locator('.custom-scene')), beta: await region(beta.locator('xpath=ancestor::div[contains(@class,"widget-variable")][1]')), figure: await region(live) };
  fs.writeFileSync('demo-video/public/clips/hero.json', JSON.stringify(meta));
  console.log('hero', meta.duration.toFixed(1), 's', meta.frames, 'frames', JSON.stringify(meta.regions));
  await ctx.close();
}

async function live() {
  const profile = '/tmp/pp-shots/profile-live';
  if(fs.existsSync(profile))fs.renameSync(profile,profile+'-saved-'+Date.now());
  const { ctx, page } = await open(profile, { width: 1600, height: 900 });
  await page.addInitScript(()=>localStorage.setItem('paperplay:reading-preferences:v1',JSON.stringify({version:1,fontSize:18,measure:75,lineHeight:1.65,theme:'light',focus:true})));
  await page.goto(`${APP}/about:blank`).catch(() => {});
  const rec = await record(page, 'live', { everyNthFrame: 2 });
  rec.mark('open');
  await page.goto(`${APP}/?arxiv=${LIVE_PAPER}`, { waitUntil: 'load' });
  // Keep Meta's progress card (paper map, pins, plan) on screen while it reads and plans.
  const progress = page.locator('[aria-label="Automatic Meta figures"]');
  await progress.waitFor({ timeout: 120000 }); await rec.wait(1200);
  rec.mark('reading'); await rec.scrollToElement(progress, 150, 1400);
  const t0 = Date.now(); let plan = false, building = '', last = '', lastArrival = ''; const knownArrivals=new Set();
  while (Date.now() - t0 < 16 * 60_000) {
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      phase: document.querySelector('[aria-label="Automatic Meta figures"]')?.getAttribute('data-illustration-phase') ?? '',
      plan: !!document.querySelector('.plan-list'),
      building: document.querySelector('.plan-card[data-status=building]')?.closest('.plan-slot')?.id ?? '',
      arrivals: [...document.querySelectorAll('[data-arrived=true]')].map(node=>node.id),
    }));
    if (state.phase !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', state.phase); last = state.phase; }
    if (state.plan && !plan) { plan = true; rec.mark('plan'); await rec.scrollToElement(progress, 150, 600); await rec.wait(4500); }
    const arrived=state.arrivals.filter(id=>id&&!knownArrivals.has(id));
    for(const id of arrived)knownArrivals.add(id);
    if(arrived.length){
      lastArrival=arrived.at(-1);await ensureCaptureFocus(page,page.locator(`[id="${lastArrival}"]`),rec);
      rec.mark('arrival');await rec.wait(1800);
    }
    // Re-read after waiting: a finished figure may have displaced the next loading card.
    const active=page.locator('.plan-card[data-status="building"]').first();
    if(await active.count()){
      const activeId=await active.evaluate(node=>node.closest('.plan-slot')?.id??'');
      await ensureCaptureFocus(page,active,rec);
      if(activeId!==building){building=activeId;rec.mark('building');}
    }
    if (/^(ready|limited)$/.test(state.phase)) {
      // The completion state can precede the arrival portal by an animation frame.
      await page.waitForTimeout(300);
      const finalArrival=page.locator('[data-arrived=true]').last();
      if(await finalArrival.count()){
        const finalId=await finalArrival.getAttribute('id');
        if(finalId&&!knownArrivals.has(finalId)){knownArrivals.add(finalId);rec.mark('arrival');}
        await ensureCaptureFocus(page,finalArrival,rec);
      }else if(lastArrival)await ensureCaptureFocus(page,page.locator(`[id="${lastArrival}"]`),rec);
      rec.mark('ready');await rec.wait(2500);break;
    }
    if (/^(blocked|paused)$/.test(state.phase)) { console.error('generation stopped:', state.phase); break; }
  }
  const meta = await rec.stop();
  console.log('live', meta.duration.toFixed(1), 's', meta.frames, 'frames', meta.events.filter(e => e.type === 'mark').map(e => `${e.label}@${e.t.toFixed(0)}`).join(' '));

  await ctx.close();
}

/** Full-rate take of the finished live paper (saved figures): play with a new figure, then return to its source. */
async function play() {
  const { ctx, page } = await open('/tmp/pp-shots/profile-live', { width: 1600, height: 900 });
  await page.addInitScript(()=>localStorage.setItem('paperplay:reading-preferences:v1',JSON.stringify({version:1,fontSize:18,measure:75,lineHeight:1.65,theme:'light',focus:true})));
  await page.goto(APP, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.locator('[aria-label^="Custom Meta figure:"],[aria-label^="Interactive figure:"]').first().waitFor({ timeout: 60000 });
  console.log('paper:', await page.locator('.research-article h1').textContent());
  // Figures mount their interactive content only near the reading position: visit each one first.
  const all = page.locator('[aria-label^="Custom Meta figure:"],[aria-label^="Interactive figure:"]');
  for (let i = 0; i < await all.count(); i++) { await all.nth(i).scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); }
  console.log('figures:', await all.evaluateAll(nodes => nodes.map(node => `${node.getAttribute('aria-label')} [${node.querySelectorAll('input[type=range]').length} sliders]`)));
  // Prefer the most hands-on control Meta built: custom model sliders, then variable sliders, then probes.
  const candidates = [
    page.locator('[aria-label^="Custom Meta figure:"]').filter({ has: page.locator('input[type=range]') }),
    page.locator('[aria-label^="Interactive figure:"]').filter({ has: page.locator('input.widget-variable-slider') }),
    page.locator('[aria-label^="Interactive figure:"]').filter({ has: page.locator('input[aria-label="Function probe"]') }),
    page.locator('[aria-label^="Interactive figure:"]').filter({ has: page.locator('input[type=range]') }),
  ];
  let target, slider;
  for (const [i, list] of candidates.entries()) if (await list.count()) { target = list.first(); slider = target.locator(i === 1 ? 'input.widget-variable-slider:visible' : i === 2 ? 'input[aria-label="Function probe"]' : 'input[type=range]:visible').first(); break; }
  if (!target) throw Error('No figure with a slider in the live paper');
  console.log('play figure:', await target.getAttribute('aria-label'));
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  const resume = target.locator('button:has-text("Resume interaction")');
  await page.evaluate(y => scrollTo(0, y), await target.evaluate(node => node.getBoundingClientRect().top + scrollY - 150));
  if (await resume.count()) { await resume.click(); await page.waitForTimeout(800); }
  // Frame the visual and its slider together.
  const visual = target.locator('.widget-equation-result, .custom-scene, .widget-chart, svg, canvas').first();
  const top = await visual.evaluate(node => node.getBoundingClientRect().top + scrollY);
  const bottom = await slider.evaluate(node => node.getBoundingClientRect().bottom + scrollY);
  await page.evaluate(([top, bottom]) => scrollTo(0, Math.max(0, (top + bottom) / 2 - innerHeight / 2 + 40)), [top, bottom]);
  await page.waitForTimeout(1200);
  const vbox=await visual.boundingBox(),sbox=await slider.boundingBox();
  if(!vbox||!sbox||vbox.y<65||sbox.y+sbox.height>page.viewportSize().height-70)throw Error('The figure result and input must both fit in the recorded viewport.');
  const rec = await record(page, 'live-play', {mode:'screenshot',quality:90,slowMotion:3});
  rec.mark('figure'); await rec.wait(1000);
  const value = await slider.evaluate(input => (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)));
  rec.mark('drag'); await rec.dragSlider(slider, 0.92, 2600, value); await rec.wait(1100); await rec.dragSlider(slider, 0.12, 2600, 0.92); await rec.wait(1400);
  const back = target.getByText(/Source passage|Read cited passage/).first();
  if (await back.count()) { await back.scrollIntoViewIfNeeded(); rec.mark('source'); await rec.click(back, 900); await rec.wait(3200); }
  rec.mark('end');
  const meta = await rec.stop();
  console.log('live-play', meta.duration.toFixed(1), 's', meta.events.filter(e => e.type === 'mark').map(e => e.label).join(' '));
  await ctx.close();
}

const scene = process.argv[2];
if (scene === 'hero') await hero();
else if (scene === 'live') await live();
else if (scene === 'play') await play();
else { console.error('Usage: capture.mjs hero|live|play'); process.exit(1); }
