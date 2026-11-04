import json,datetime,subprocess
from pathlib import Path
base=Path('demo-video/out/tall-recording');m=json.loads((base/'manifest.json').read_text());dt=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
for i,p in enumerate(m['parts']):
 out=base/f'normalized-{i}.mp4'
 if out.exists():continue
 duration=dt(m['parts'][i+1]['start'])-dt(p['start']) if i<2 else dt(m['start'])+781.5-dt(p['start'])
 print('Normalizing',i,round(duration,2),flush=True)
 temporary=base/f'normalized-{i}.partial.mp4'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',p['path'],'-vf','tpad=stop_mode=clone:stop_duration=80,fps=15,scale=1920:1680:flags=lanczos,format=yuv420p','-t',str(duration),'-c:v','libx264','-preset','veryfast','-crf','16','-threads','4','-an','-y',str(temporary)],check=True)
 temporary.rename(out)
(base/'concat.txt').write_text(''.join("file '"+str((base/f'normalized-{i}.mp4').resolve())+"'\n" for i in range(3)))
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(base/'concat.txt'),'-c','copy','-movflags','+faststart','-y','demo-video/public/clips/live.mp4'],check=True)
events=[dict(t=t,type='mark',label=label,x=0,y=0) for t,label in m['marks']]
# Editing cameras use the roomy recorded viewport, with wider overview shots on arrivals.
cameras=[(0,900),(68,1300),(77,900)]
for t,label in m['marks']:
 if label=='arrival':cameras.extend([(max(0,t-.2),900),(t+.6,1320),(t+3.4,1320),(t+4,900)])
cameras.extend([(778.208,1320),(781.5,1320)])
for t,h in sorted(cameras):events.append(dict(t=t,type='camera',x=0,y=0,region=dict(x=0,y=0,width=1920,height=h*1.2)))
events.sort(key=lambda e:e['t'])
Path('demo-video/public/clips/live.json').write_text(json.dumps(dict(name='live',fps=15,slowMotion=1,duration=781.5,viewport=dict(width=1920,height=1680),scale=1.2,frames=11723,events=events)))
print('Tall recording normalized and edit markers restored.',flush=True)
