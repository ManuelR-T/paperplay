'use client';
import type { CustomFrame } from '@/lib/widgets/custom-runtime';
import { useMemo } from 'react';
import { customSceneBounds } from '@/lib/widgets/custom-scene-bounds';

export function CustomScene({ frame, frames, selection, onSelect }: { frame: CustomFrame; frames: CustomFrame[]; selection: string; onSelect: (id:string)=>void }) {
  const color={ink:'var(--ink)',olive:'var(--olive)',accent:'var(--lime)'};
  const bounds=useMemo(()=>customSceneBounds(frames),[frames]);
  return <div>
    <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} role="group" aria-label={`Custom teaching scene at step ${frame.step}; select elements by keyboard or pointer`} style={{width:'100%',height:320,background:'var(--chrome)',borderRadius:8}}>
      {frame.marks.map(mark=><g key={mark.id} role="button" tabIndex={0} aria-label={mark.shape==='text'?`${mark.label}: ${Number(mark.value?.toPrecision(6))}`:mark.label} aria-pressed={selection===`custom:${mark.id}`} onClick={()=>onSelect(mark.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(mark.id);}}}>
        <title>{mark.label}</title>
        {mark.shape==='circle'?<circle cx={mark.x} cy={mark.y} r={mark.radius} fill={color[mark.paint]} stroke="var(--ink)" strokeWidth={selection===`custom:${mark.id}`?5:2}/>
        :mark.shape==='rect'?<rect x={mark.x} y={mark.y} width={mark.width} height={mark.height} fill={color[mark.paint]} stroke="var(--ink)" strokeWidth={selection===`custom:${mark.id}`?5:2}/>
        :mark.shape==='line'?<line x1={mark.x} y1={mark.y} x2={mark.x2} y2={mark.y2} stroke={mark.paint==='accent'?'var(--olive)':color[mark.paint]} strokeWidth={selection===`custom:${mark.id}`?6:3}/>
        :<text x={mark.x} y={mark.y} fill="var(--ink)" fontSize={18}>{mark.label}: {Number(mark.value?.toPrecision(6))}</text>}
      </g>)}
    </svg>
    {frame.marks.find(mark=>selection===`custom:${mark.id}`)&&<p className="widget-selection" aria-live="polite">Selected: {frame.marks.find(mark=>selection===`custom:${mark.id}`)!.label}</p>}
  </div>;
}
