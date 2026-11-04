// Recording-only camera metadata; it does not alter the paper or its figures.
(()=>{
 const c=window.__bigCapture??JSON.parse(sessionStorage.getItem('paperplay:demo-camera'));
 if(!c)throw Error('Set the real recording start before installing the camera.');
 window.__bigCapture=c;clearInterval(window.__bigTimer);window.__bigObserver?.disconnect();
 document.body.style.paddingBottom='100vh';document.documentElement.style.scrollBehavior='auto';
 const event=(type,extra={})=>c.events.push({t:(Date.now()-c.start)/1000,type,x:0,y:0,...extra});
 const focus=(node,figure=false)=>{
  if(!node)return;let target=node;
  if(figure&&node.getBoundingClientRect().height>1250)target=node.querySelector('[data-generated-frame]')??node.querySelector('[role=tabpanel]:not([hidden])')??node;
  const r=target.getBoundingClientRect();
  if(r.top<95||r.top+Math.min(r.height,1150)>innerHeight-50)scrollTo({top:scrollY+r.top-110,behavior:'smooth'});
  const h=Math.min(1320,Math.max(900,(figure||node.matches('[aria-label="Automatic Meta figures"]'))?r.height+90:900));
  c.region={x:0,y:figure?Math.max(0,Math.min(innerHeight-h,r.top-30)):0,width:1600,height:h};
  if(c.lastSubject!==node.id+':'+figure){c.lastSubject=node.id+':'+figure;c.subjects.push({t:(Date.now()-c.start)/1000,kind:figure?'figure':'loading',title:node.getAttribute('aria-label')??node.innerText.slice(0,70),height:r.height});}
 };
 window.__captureCameraFor=focus;
 const tick=()=>{
  document.querySelector('nextjs-portal')?.style.setProperty('display','none');
  const progress=document.querySelector('[aria-label="Automatic Meta figures"]');if(!progress)return;
  c.phase=progress.getAttribute('data-illustration-phase')??'';
  if(!c.reading){event('mark',{label:'reading'});c.reading=true;focus(progress);}
  if(document.querySelector('.plan-list')&&!c.plan){c.plan=true;c.planHold=Date.now()+5000;event('mark',{label:'plan'});focus(progress);}
  const slots=[...document.querySelectorAll('[aria-label^="Interactive figure:"],[aria-label^="Custom Meta figure:"]')].map(n=>n.parentElement).filter(n=>n?.id);
  for(const node of slots)if(!c.arrived.includes(node.id)){c.arrived.push(node.id);c.lastArrival=Date.now();c.currentFigure=node.id;event('mark',{label:'arrival'});}
  if(c.currentFigure&&Date.now()-c.lastArrival<3500)focus(document.getElementById(c.currentFigure),true);
  const active=document.querySelector('.plan-card[data-status=building]');
  if(active){const id=active.closest('.plan-slot')?.id??'';if(id!==c.building){c.building=id;event('mark',{label:'building'});}if(Date.now()>c.planHold&&Date.now()-c.lastArrival>3500)focus(active);}
  if(c.region)event('camera',{region:{x:c.region.x*2,y:c.region.y*2,width:c.region.width*2,height:c.region.height*2}});
  if(['ready','limited'].includes(c.phase)){
   c.finishAfter??=Date.now()+1500;focus(document.getElementById(c.arrived.at(-1)),true);
   if(c.region)event('camera',{region:{x:c.region.x*2,y:c.region.y*2,width:c.region.width*2,height:c.region.height*2}});
   if(Date.now()>c.finishAfter){event('mark',{label:'ready'});c.finished=true;clearInterval(window.__bigTimer);window.__bigObserver?.disconnect();}
  }

 };
 window.__bigTimer=setInterval(tick,500);
 let queued=false;window.__bigObserver=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;tick();});}});
 window.__bigObserver.observe(document.querySelector('.main-workspace')??document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-illustration-phase']});
 tick();
 return{installed:true,marks:c.events.filter(e=>e.type==='mark').length};
})()
