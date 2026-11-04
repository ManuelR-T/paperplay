import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,readdir,writeFile,rm,rename,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),base=path.join(root,'public/render-frames');
await mkdir(base,{recursive:true});
let index={};try{index=JSON.parse(await readFile(path.join(base,'index.json'),'utf8'));}catch{}
// Slow-motion takes need fewer source images per second at normal playback speed.
// Keep at least 30 output samples/s; normal-rate takes retain all 30 source frames/s.
for(const name of ['hero','live','live-play']){
 const metadata=JSON.parse(await readFile(path.join(root,'public/clips',name+'.json'),'utf8'));
 const fps=name==='live'?15:Math.min(30,Math.ceil(30/(metadata.slowMotion??1)));
 const src=`clips/${name}.mp4`,input=path.join(root,'public',src),hash=createHash('sha256');
 for await(const chunk of createReadStream(input))hash.update(chunk);
 const sha256=hash.digest('hex'),saved=index[src],folder=path.join(base,name);
 if(saved?.sha256===sha256&&saved.fps===fps){try{await access(path.join(folder,String(saved.frames-1).padStart(5,'0')+'.jpg'));console.log(`Reuse ${name}: ${saved.frames} frames`);continue;}catch{}}
 const staging=folder+`.tmp-${process.pid}`;await mkdir(staging,{recursive:true});
 console.log(`Preparing ${name} at ${fps} source frames/s…`);
 try{
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-threads','2','-i',input,'-vf',`fps=${fps}:start_time=0`,'-q:v','3','-threads','2','-start_number','0','-y',path.join(staging,'%05d.jpg')],{stdio:'inherit'});
  const frames=(await readdir(staging)).filter(file=>file.endsWith('.jpg')).length;
  if(!frames)throw Error(`No frames decoded from ${name}`);
  await rm(folder,{recursive:true,force:true});await rename(staging,folder);
  index[src]={folder:name,fps,frames,sha256};
  await writeFile(path.join(base,'index.json'),JSON.stringify(index,null,2)+'\n');
  console.log(`Ready ${name}: ${frames} frames`);
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
