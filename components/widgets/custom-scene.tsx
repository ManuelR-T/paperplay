'use client';
import type { CustomFrame } from '@/lib/widgets/custom-runtime';
import type { CustomWidgetSpec } from '@/shared/custom-widget';
import { useId, useMemo } from 'react';
import { customLabelLines, customSceneBounds } from '@/lib/widgets/custom-scene-bounds';

export function CustomScene({ frame, frames, selection, onSelect, layout }: { frame: CustomFrame; frames: CustomFrame[]; selection: string; onSelect: (id:string)=>void; layout?: CustomWidgetSpec['layout'] }) {
  const color={ink:'var(--ink)',olive:'var(--olive)',accent:'var(--lime)'};
  const marker=useId().replaceAll(':','');
  const bounds=useMemo(()=>customSceneBounds(frames,layout),[frames,layout]);
  const selected=frame.marks.find(mark=>selection===`custom:${mark.id}`);
  return <div className="custom-scene">
    <div className="custom-scene-scroll" role="region" tabIndex={0} aria-label="Custom scene; scroll horizontally if needed">
    <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} role="group" aria-label={`Custom teaching scene at step ${frame.step}; select elements by keyboard or pointer`} style={{width:`max(100%, ${Math.min(1600,Math.max(480,bounds.width))}px)`,height:Math.min(480,Math.max(240,bounds.height))}}>
      <defs>{(['ink','olive','accent'] as const).map(paint=><marker key={paint} id={`${marker}-${paint}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={paint==='accent'?color.olive:color[paint]}/></marker>)}</defs>
      {frame.marks.filter(mark=>mark.opacity!==0).map(mark=>{
        const active=selection===`custom:${mark.id}`;
        return <g key={mark.id} role="button" tabIndex={0} opacity={mark.opacity??1} aria-label={mark.shape==='text'?`${mark.label}: ${Number(mark.value?.toPrecision(6))}`:mark.label} aria-pressed={active} onClick={()=>onSelect(mark.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(mark.id);}}}>
        <title>{mark.label}</title>
        {mark.shape==='circle'?<circle cx={mark.x} cy={mark.y} r={mark.radius} fill={color[mark.paint]} stroke="var(--ink)" strokeWidth={active?4:2}/>
        :mark.shape==='ellipse'?<ellipse cx={mark.x} cy={mark.y} rx={(mark.width??0)/2} ry={(mark.height??0)/2} fill={color[mark.paint]} stroke="var(--ink)" strokeWidth={active?4:2}/>
        :mark.shape==='rect'?<rect x={mark.x} y={mark.y} width={mark.width} height={mark.height} rx={6} fill={color[mark.paint]} stroke="var(--ink)" strokeWidth={active?4:2}/>
        :mark.shape==='line'||mark.shape==='arrow'?<><line x1={mark.x} y1={mark.y} x2={mark.x2} y2={mark.y2} stroke="transparent" strokeWidth={24}/><line x1={mark.x} y1={mark.y} x2={mark.x2} y2={mark.y2} stroke={mark.paint==='accent'?color.olive:color[mark.paint]} strokeWidth={active?5:3} markerEnd={mark.shape==='arrow'?`url(#${marker}-${mark.paint})`:undefined}/></>
        :<text x={mark.x} y={mark.y} fill="var(--ink)" fontSize={18}>{customLabelLines(mark).map((line,index)=><tspan key={index} x={mark.x} dy={index?24:0}>{line}</tspan>)}</text>}
      </g>;})}
    </svg></div>
    {selected&&<p className="widget-selection" aria-live="polite">Selected: {selected.label}{selected.opacity===0?' · hidden at this step':''}</p>}
  </div>;
}
