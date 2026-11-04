import{createRequire}from'node:module';const require=createRequire('/home/manuel/.npm/_npx/420ff84f11983ee5/node_modules/');const{chromium}=require('playwright');
const ctx=await chromium.launchPersistentContext('/tmp/pp-shots/profile-live',{executablePath:'/home/manuel/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',viewport:{width:1440,height:1000}});
try{
 const page=ctx.pages()[0];await page.goto('http://localhost:3000/',{waitUntil:'load'});await page.waitForTimeout(2000);
 const figure=page.locator('[aria-label^="Custom Meta figure:"]').first();await figure.scrollIntoViewIfNeeded();
 const resume=figure.getByRole('button',{name:'Resume interaction'});if(await resume.count())await resume.click();
 const slider=figure.locator('input[type=range]').first();await slider.waitFor({timeout:30000});if(!await slider.isEnabled()&&await resume.count())await resume.click();await slider.scrollIntoViewIfNeeded();await page.waitForTimeout(1000);if(!await slider.isEnabled())throw Error('The slider must be active for the latency check.');
 await figure.evaluate(el=>{window.__sdkLayout=[];window.__sdkSample=true;function sample(){if(!window.__sdkSample)return;const r=el.getBoundingClientRect();window.__sdkLayout.push({height:r.height,scroll:scrollY,top:r.top,doc:document.documentElement.scrollHeight});requestAnimationFrame(sample)}sample()});
 const cells=figure.locator('tbody tr').first();const values=new Set([await cells.textContent()]);
 const box=await slider.boundingBox();await page.mouse.move(box.x+10,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(100);await page.evaluate(()=>{window.__sdkLayout=[]});
 for(let i=0;i<15;i++){await page.mouse.move(box.x+10+(box.width-20)*i/14,box.y+box.height/2);await page.waitForTimeout(70);values.add(await cells.textContent());}
 await page.mouse.up();await page.waitForTimeout(1200);
 const layout=await page.evaluate(()=>{window.__sdkSample=false;return window.__sdkLayout});const heightRange=Math.max(...layout.map(x=>x.height))-Math.min(...layout.map(x=>x.height));const scrollRange=Math.max(...layout.map(x=>x.scroll))-Math.min(...layout.map(x=>x.scroll));if(heightRange>2||scrollRange>2)process.exitCode=1;console.log(JSON.stringify({heightRange,scrollRange,distinctComputedResultsDuringDrag:values.size,computedAfterRelease:await cells.textContent()}));if(values.size<3)process.exitCode=1;
}finally{await ctx.close();}
