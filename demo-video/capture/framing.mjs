/** Capture-only scroll room lets even the last short loading card reach the camera's focal point. */
export async function ensureCaptureFocus(page,target,rec,offset=130){
 await page.evaluate(()=>{
  if(document.getElementById('demo-camera-scroll-room'))return;
  const tail=document.createElement('div');tail.id='demo-camera-scroll-room';tail.setAttribute('aria-hidden','true');tail.style.height='100vh';tail.style.pointerEvents='none';document.body.append(tail);
 });
 for(let attempt=0;attempt<4;attempt++){
  if(!await target.count())return false; // Loading card was replaced while the camera moved.
  const box=await target.first().boundingBox();if(!box)return false;
  const height=page.viewportSize().height;
  if(box.y>=90&&box.y<=200&&box.y+Math.min(box.height,400)<=height-70)return true;
  await rec.scrollToElement(target.first(),offset,attempt?100:500);
  await page.waitForTimeout(120);
 }
 const final=await target.first().boundingBox(),height=page.viewportSize().height;
 if(!final||final.y<60||final.y>height-180)throw Error(`Generation subject outside viewport: y=${final?.y}, height=${final?.height}, viewport=${height}`);
 return true;
}
