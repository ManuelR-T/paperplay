/** Optional PP-094 local comparison. Uses an already installed exact image ID; never pulls or mounts the project. */
import { spawn,spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const imageId=process.argv[2];if(!imageId||!/^sha256:[a-f0-9]{64}$/.test(imageId))throw Error('Supply a locally installed full sha256 image ID; no tags or pulls.');
const results=[];
for(const mode of ['capabilities','cpu','memory']){
 const container=`paperplay-isolation-${crypto.randomUUID()}`,started=Date.now();let output='',killed=false;
 try{
  const args=['run','--name',container,'--pull','never','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','32','--memory','64m','--memory-swap','64m','--cpus','0.25','--user','65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=8m','--mount',`type=bind,src=${resolve('scripts/isolation/container-probe.cjs')},dst=/probe.cjs,readonly`,'--entrypoint','node',imageId,'/probe.cjs',mode];
  const child=spawn('docker',args,{stdio:['ignore','pipe','pipe']});for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output=(output+String(data)).slice(-8192);});
  const timer=setTimeout(()=>{killed=true;spawnSync('docker',['kill',container],{stdio:'ignore',timeout:1000});},2000);
  const exit=await new Promise<number|null>((done,reject)=>{child.once('exit',done);child.once('error',reject);});clearTimeout(timer);
  const inspected=spawnSync('docker',['inspect','--format','{{json .State}}',container],{encoding:'utf8',timeout:1000});let state:Record<string,unknown>={};try{state=JSON.parse(inspected.stdout);}catch{}
  results.push({mode,exit,watchdogKilled:killed,oomKilled:state.OOMKilled??null,elapsedMs:Date.now()-started,output:output.trim()});
 }finally{spawnSync('docker',['rm','-f',container],{stdio:'ignore',timeout:2000});}
}
console.log(JSON.stringify({format:'paperplay-container-isolation-comparison',schemaVersion:1,imageId,results,note:'Ordinary Docker shares a host kernel; this comparison is not approval for production native code execution.'},null,2));
