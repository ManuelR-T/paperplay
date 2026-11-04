// Normalize a recording from the shared browser and retain its real event timestamps.
import{execFileSync}from'node:child_process';
import{readFileSync,writeFileSync}from'node:fs';
const[name,input,eventsFile,wallSeconds]=process.argv.slice(2);
if(!['live','live-play'].includes(name)||!input||!eventsFile)throw Error('Usage: ingest-preview-recording.mjs live|live-play recording events.json');
const details=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',input],{encoding:'utf8'}));
const stream=details.streams.find(s=>s.codec_type==='video');
const mediaDuration=Number(details.format.duration),duration=wallSeconds?Math.max(mediaDuration,Number(wallSeconds)):mediaDuration;
const scale=stream.width/1600;
const events=JSON.parse(readFileSync(eventsFile,'utf8')).map(event=>({...event,x:event.x*scale,y:event.y*scale}));
if(!stream||!Number.isFinite(duration)||events.some(e=>e.t>duration+2))throw Error('Recording and UI timestamps do not agree.');
const output=`demo-video/public/clips/${name}.mp4`;
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',input,'-vf',`tpad=stop_mode=clone:stop_duration=${Math.max(0,duration-mediaDuration)},fps=30,format=yuv420p`,'-t',String(duration),'-c:v','libx264','-preset','fast','-crf','16','-threads','4','-an','-movflags','+faststart','-y',output],{stdio:'inherit'});
writeFileSync(`demo-video/public/clips/${name}.json`,JSON.stringify({name,fps:30,slowMotion:1,duration,viewport:{width:stream.width,height:stream.height},scale,frames:Math.round(duration*30),events}));
console.log(`${name}: ${stream.width}×${stream.height}, ${duration.toFixed(1)} real seconds, ${events.length} events`);
