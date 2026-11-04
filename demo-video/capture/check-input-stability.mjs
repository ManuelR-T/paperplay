import {createRequire}from'node:module';
const require=createRequire('/home/manuel/.npm/_npx/420ff84f11983ee5/node_modules/');
const{chromium}=require('playwright');
const context=await chromium.launchPersistentContext('/tmp/pp-shots/profile',{executablePath:'/home/manuel/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',viewport:{width:1440,height:1000}});
const page=context.pages()[0];const slow=process.env.SLOW_WORKER==='1';
await page.addInitScript((slow)=>{
 window.__widgetPerf={starts:[],results:[],terminations:0};const Native=window.Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);this.addEventListener('message',event=>{if(event.data?.protocol===2)window.__widgetPerf.results.push({id:event.data.id,time:performance.now()});});}
  postMessage(value,...args){if(value?.protocol===2)window.__widgetPerf.starts.push({id:value.id,time:performance.now()});if(slow){setTimeout(()=>super.postMessage(value,...args),650);return;}return super.postMessage(value,...args);}
  terminate(){window.__widgetPerf.terminations++;return super.terminate();}
 };
},slow);
try{
 await page.goto('http://localhost:3000/',{waitUntil:'load'});await page.waitForTimeout(2000);
 const figure=page.locator('[aria-label^="Interactive figure: Momentum"]').first();await figure.scrollIntoViewIfNeeded();
 const show=figure.getByRole('button',{name:'Show figure',exact:true});if(await show.count())await show.click();
 const slider=figure.locator('input[aria-label="β slider"]:visible').first();await slider.waitFor();await slider.scrollIntoViewIfNeeded();await page.waitForTimeout(1500);
 await figure.locator('.widget-card').evaluate(el=>el.dataset.stabilityTarget='true');await page.evaluate(()=>{window.__widgetPerf={starts:[],results:[],terminations:0};window.__dragStart=performance.now();window.__layout=[];window.__sampling=true;const card=document.querySelector('[data-stability-target]');function sample(){if(!window.__sampling)return;const rect=card.getBoundingClientRect();window.__layout.push({height:rect.height,y:rect.y,scroll:scrollY,monitorFixed:[...document.querySelectorAll('[data-execution-monitor]')].every(el=>getComputedStyle(el).position==='fixed'),status:card.querySelector('.widget-computation-status')?.dataset.visible==='true'});requestAnimationFrame(sample)}sample();});
 const box=await slider.boundingBox();await page.mouse.move(box.x+10,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(100);await page.evaluate(()=>{window.__layout=[]});
 for(let i=0;i<30;i++){await page.mouse.move(box.x+10+(box.width-20)*i/29,box.y+box.height/2);await page.waitForTimeout(20);}
 const during=await page.evaluate(()=>window.__widgetPerf);await page.mouse.up();await page.waitForTimeout(1500);
 const layout=await page.evaluate(()=>{window.__sampling=false;return window.__layout});const heights=layout.map(x=>x.height);const shift=Math.max(...heights)-Math.min(...heights);console.log(JSON.stringify({cardHeightRange:shift,sample:layout.filter((x,i)=>!i||x.height!==layout[i-1].height).slice(0,12)}));const scrollRange=Math.max(...layout.map(x=>x.scroll))-Math.min(...layout.map(x=>x.scroll));console.log({scrollRange});if(slow&&!layout.some(x=>x.status))throw Error('Slow computations must expose their status and cancel action.');if(layout.some(x=>!x.monitorFixed))throw Error('Execution monitor must remain outside document flow.');if(shift>2||scrollRange>2)process.exitCode=1;const all=await page.evaluate(()=>window.__widgetPerf);console.log(JSON.stringify({during:{starts:during.starts.length,results:during.results.length,terminations:during.terminations},after:{starts:all.starts.length,results:all.results.length}},null,2));
 if((!slow&&during.results.length<5)||during.terminations>2)process.exitCode=1;
}finally{await context.close();}
