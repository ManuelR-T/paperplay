/* Trusted spike host; never evaluates artifact source in browser JavaScript. */
const result=document.querySelector('#result'),stop=document.querySelector('#stop'),heartbeat=document.querySelector('#heartbeat');
let active=new Set(),ticks=0;setInterval(()=>{heartbeat.textContent=String(++ticks);},50);
stop.onclick=()=>{for(const worker of [...active])worker.__stop?.();active.clear();result.textContent='All workers stopped; reader remains usable.';};
window.spike={
 async run(artifact,{input={},state=null,event={kind:'initialize'},deadlineMs=1000,signal}={}){
   const instanceId=crypto.randomUUID(),worker=new Worker('/worker.mjs',{type:'module'});active.add(worker);const start=performance.now();
   return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();active.delete(worker);resolve({...value,elapsedMs:Math.round(performance.now()-start),instanceId});};const abort=()=>finish({status:'cancelled'});worker.__stop=abort;const timer=setTimeout(()=>finish({status:'watchdog-killed'}),deadlineMs);
   worker.onerror=()=>finish({status:'worker-error'});worker.onmessage=message=>{const value=message.data;if(!value||typeof value!=='object'||value.instanceId!==instanceId||!['ready','failed'].includes(value.status)||JSON.stringify(value).length>128*1024){finish({status:'rejected'});return;}finish(value);};
   if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});worker.postMessage({instanceId,artifact,input,state,event});
   });
 },activeCount:()=>active.size
};
result.textContent='Trusted isolation harness ready. Product generated execution is still disabled.';
function renderFrame(frame){const svg=document.querySelector('#scene');svg.replaceChildren();for(const mark of frame.marks){let node;if(mark.kind==='circle'){node=document.createElementNS('http://www.w3.org/2000/svg','circle');node.setAttribute('cx',String(mark.center[0]));node.setAttribute('cy',String(mark.center[1]));node.setAttribute('r',String(mark.radius));node.setAttribute('fill','#136f63');}else if(mark.kind==='text'){node=document.createElementNS('http://www.w3.org/2000/svg','text');node.setAttribute('x',String(mark.at[0]));node.setAttribute('y',String(mark.at[1]));node.setAttribute('fill','#111');node.textContent=mark.text;}else continue;node.setAttribute('aria-label',mark.label);svg.append(node);}}
window.spike.runSuite=async()=>{
 const fixture=await(await fetch('/fixture.json')).json(),cases=await(await fetch('/cases.json')).json(),startTicks=Number(heartbeat.textContent),results=[];
 globalThis.__paperplayFixtureSecret='isolated-host-fixture-keep-private';localStorage.setItem('isolation-fixture','isolated-host-storage-keep-private');document.cookie='isolation-fixture=private-cookie;SameSite=Strict';
 for(const item of cases){const artifact=structuredClone(fixture);artifact.entry.source=item.source;artifact.resources.maxExecutionMs=30;const run=await spike.run(artifact,{deadlineMs:700});results.push({id:item.id,expected:item.expected,status:run.status,elapsedMs:run.elapsedMs,result:run.frame?.table?.rows});}
 const hostile=structuredClone(fixture);hostile.entry.source='function update(){while(true){}}';hostile.resources.maxExecutionMs=1000;const controller=new AbortController();setTimeout(()=>controller.abort(),150);
 const cancelled=await spike.run(hostile,{signal:controller.signal,deadlineMs:2000}),killed=await spike.run(hostile,{deadlineMs:140}),parallel=await Promise.all([spike.run(hostile,{deadlineMs:140}),spike.run(fixture,{event:{kind:'control',id:'append'}})]);
 const healthy=parallel.find(item=>item.status==='ready');if(healthy)renderFrame(healthy.frame);
 const report={format:'paperplay-browser-isolation-spike',schemaVersion:1,checkedAt:new Date().toISOString(),userAgent:navigator.userAgent,origin:location.origin,metadata:await(await fetch('/metadata')).json(),results,cancelled,killed,parallel:parallel.map(r=>({status:r.status,instanceId:r.instanceId,elapsedMs:r.elapsedMs,rows:r.frame?.table.rows})),heartbeatDelta:Number(heartbeat.textContent)-startTicks,active:spike.activeCount(),hostPrototypePolluted:Object.prototype.__guestPollution??false,hostStorageRetained:localStorage.getItem('isolation-fixture')==='isolated-host-storage-keep-private',requests:await(await fetch('/requests')).json(),limitations:['Chromium measurement only; not cross-browser certification.','64 MiB capped WASM memory and guest allocator limits do not cap total browser process memory.','Compiler/production bridge/evidence gates remain separate; product generated execution is disabled.']};
 window.spike.report=report;result.textContent=JSON.stringify(report,null,2);return report;
};
document.querySelector('#run').onclick=()=>{result.textContent='Running isolated probes…';void spike.runSuite().catch(()=>{result.textContent='Probe suite failed; product execution remains disabled.';});};
document.querySelector('#download').onclick=()=>{if(!spike.report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(spike.report,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='paperplay-browser-isolation-spike.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.spike.compile=async(request,{deadlineMs=2000,signal}={})=>{
 const instanceId=crypto.randomUUID(),worker=new Worker('/compiler.mjs',{type:'module'});active.add(worker);const start=performance.now();
 return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();active.delete(worker);resolve({...value,elapsedMs:Math.round(performance.now()-start)});},abort=()=>finish({status:'cancelled'}),timer=setTimeout(()=>finish({status:'watchdog-killed'}),deadlineMs);worker.__stop=abort;
 worker.onerror=()=>finish({status:'worker-error'});worker.onmessage=message=>{if(message.data.instanceId!==instanceId||JSON.stringify(message.data).length>72*1024){finish({status:'rejected'});return;}finish(message.data.result);};if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});worker.postMessage({instanceId,request});});
};
window.spike.runCompilerSuite=async()=>{
 const manifest=await(await fetch('/fixture.json')).json(),ticks=Number(heartbeat.textContent);
 const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const request=async source=>({format:'paperplay-figure-compile-request',schemaVersion:1,source,sourceSha256:await hash(source),manifestSha256:await hash(JSON.stringify(manifest)),sdkSha256:manifest.dependencyLock[0].sha256});
 const input=await request(manifest.entry.source),one=await spike.compile(input),two=await spike.compile(input);
 const cases=[['throw-not-executed','function update(input,state,event){throw Error("private-marker");}'],['loop-not-executed','function update(input,state,event){while(true){}}'],['nested-import',"function update(input,state,event){return import('https://bad.invalid/x');}"],['syntax-private-name','function update(input,state,event){const privateSensitiveName = ;}'],['complexity','function update(input,state,event){'+'!'.repeat(200)+'1;}']],results=[];
 for(const [id,source]of cases){const run=await spike.compile(await request(source));results.push({id,status:run.status,diagnostics:run.diagnostics,elapsedMs:run.elapsedMs});}
 const controller=new AbortController();setTimeout(()=>controller.abort(),10);const cancelled=await spike.compile(input,{signal:controller.signal}),killed=await spike.compile(input,{deadlineMs:10});
 const report={format:'paperplay-compiler-browser-spike',schemaVersion:1,checkedAt:new Date().toISOString(),userAgent:navigator.userAgent,origin:location.origin,repeat:{one:one.sha256,two:two.sha256,same:one.sha256===two.sha256,status:one.status,elapsedMs:[one.elapsedMs,two.elapsedMs],toolchain:one.artifact?.toolchain},results,cancelled,killed,active:spike.activeCount(),heartbeatDelta:Number(heartbeat.textContent)-ticks,diagnosticsContainPrivateName:JSON.stringify(results).includes('privateSensitiveName')};
 spike.report=report;result.textContent=JSON.stringify(report,null,2);return report;
};
document.querySelector('#compile').onclick=()=>{result.textContent='Running compiler probes…';void spike.runCompilerSuite().catch(()=>{result.textContent='Compiler probe failed; product execution remains disabled.';});};
