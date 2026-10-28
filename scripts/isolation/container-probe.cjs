// Executed only in a disposable, unprivileged, network-denied comparison container.
const mode=process.argv[2];
if(mode==='capabilities'){
 const fs=require('node:fs');
 (async()=>{let network='unexpected';try{await fetch('http://192.0.2.1',{signal:AbortSignal.timeout(100)});}catch{network='denied-or-unreachable';}let rootWritable=true;try{fs.writeFileSync('/paperplay-probe','x');}catch{rootWritable=false;}console.log(JSON.stringify({uid:process.getuid(),hostProjectMounted:fs.existsSync('/home/manuel/.t3/projects/paperplay'),hostSecretPresent:!!process.env.PAPERPLAY_ISOLATION_HOST_FIXTURE,network,rootWritable,ownFilesystemReadable:fs.existsSync('/etc/passwd')}));})();
}else if(mode==='cpu'){while(true){}}
else if(mode==='memory'){const allocations=[];while(true){const bytes=Buffer.alloc(8*1024*1024,1);allocations.push(bytes);}}
else process.exitCode=2;
