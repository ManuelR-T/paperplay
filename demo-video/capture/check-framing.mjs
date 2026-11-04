import {createRequire}from'node:module';import assert from'node:assert/strict';
import{ensureCaptureFocus}from'./framing.mjs';
const require=createRequire('/home/manuel/.npm/_npx/420ff84f11983ee5/node_modules/');const{chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'/home/manuel/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:810}});
 await page.setContent('<header style="position:fixed;top:0;height:65px">Reader</header><div id="earlier" style="height:900px"></div><aside id="loading" style="height:420px">Building last figure</aside>');
 const rec={scrollToElement:async(target,offset)=>page.evaluate(([y,offset])=>scrollTo(0,y-offset),[await target.evaluate(node=>node.getBoundingClientRect().top+scrollY),offset])};
 const target=page.locator('#loading');await ensureCaptureFocus(page,target,rec);assert.equal(Math.round((await target.boundingBox()).y),130);
 await page.locator('#earlier').evaluate(node=>node.style.height='1900px');await page.evaluate(()=>scrollTo(0,0));
 await ensureCaptureFocus(page,target,rec);assert.equal(Math.round((await target.boundingBox()).y),130);
 console.log('Framing regression passed: the loading card stays in view after earlier content expands.');
}finally{await browser.close();}
