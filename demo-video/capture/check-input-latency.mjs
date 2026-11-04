import {createRequire}from'node:module';
const require=createRequire('/home/manuel/.npm/_npx/420ff84f11983ee5/node_modules/');
const{chromium}=require('playwright');
const context=await chromium.launchPersistentContext('/tmp/pp-shots/profile',{executablePath:'/home/manuel/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',viewport:{width:1440,height:1000}});
const page=context.pages()[0];
await page.addInitScript(()=>{
 window.__widgetPerf={starts:[],results:[],terminations:0};const Native=window.Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);this.addEventListener('message',event=>{if(event.data?.protocol===2)window.__widgetPerf.results.push({id:event.data.id,time:performance.now()});});}
  postMessage(value,...args){if(value?.protocol===2)window.__widgetPerf.starts.push({id:value.id,time:performance.now()});return super.postMessage(value,...args);}
  terminate(){window.__widgetPerf.terminations++;return super.terminate();}
 };
});
try{
 await page.goto('http://localhost:3000/',{waitUntil:'load'});await page.waitForTimeout(2000);
 const figure=page.locator('[aria-label^="Interactive figure: Momentum"]').first();await figure.scrollIntoViewIfNeeded();
 const show=figure.getByRole('button',{name:'Show figure',exact:true});if(await show.count())await show.click();
 const slider=figure.locator('input[aria-label="β slider"]:visible').first();await slider.waitFor();await slider.scrollIntoViewIfNeeded();await page.waitForTimeout(1500);
 await page.evaluate(()=>{window.__widgetPerf={starts:[],results:[],terminations:0};window.__dragStart=performance.now();});
 const box=await slider.boundingBox();await page.mouse.move(box.x+10,box.y+box.height/2);await page.mouse.down();
 for(let i=0;i<30;i++){await page.mouse.move(box.x+10+(box.width-20)*i/29,box.y+box.height/2);await page.waitForTimeout(20);}
 const during=await page.evaluate(()=>window.__widgetPerf);await page.mouse.up();await page.waitForTimeout(1500);
 const all=await page.evaluate(()=>window.__widgetPerf);console.log(JSON.stringify({during:{starts:during.starts.length,results:during.results.length,terminations:during.terminations},after:{starts:all.starts.length,results:all.results.length}},null,2));
 if(during.results.length<5||during.terminations>2)process.exitCode=1;
}finally{await context.close();}
