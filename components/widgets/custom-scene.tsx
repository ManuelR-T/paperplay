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
  const {regions,trails}=useMemo(()=>sceneLayers(frames,bounds),[frames,bounds]);
  const index=Math.max(0,frames.findIndex(item=>item.step===frame.step));
  return <div className="custom-scene">
    <div className="custom-scene-scroll" role="region" tabIndex={0} aria-label="Custom scene; scroll horizontally if needed">
    <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} role="group" aria-label={`Custom teaching scene at step ${frame.step}; select elements by keyboard or pointer`} style={{width:`max(100%, ${Math.min(1600,Math.max(480,bounds.width))}px)`,height:Math.min(480,Math.max(240,bounds.height))}}>
      <defs>{(['ink','olive','accent'] as const).map(paint=><marker key={paint} id={`${marker}-${paint}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={paint==='accent'?color.olive:color[paint]}/></marker>)}</defs>
      {frame.marks.filter(mark=>mark.opacity!==0&&regions.has(mark.id)).map(mark=><Region key={mark.id} mark={mark} active={selection===`custom:${mark.id}`} paint={color[mark.paint]} onSelect={()=>onSelect(mark.id)}/>)}
      {/* The whole path stays faintly visible, so changing a parameter reshapes it at once. */}
      {[...trails].map(id=>{const path=frames.map(item=>item.marks.find(mark=>mark.id===id)).filter(mark=>mark&&mark.opacity!==0).map(mark=>`${mark!.x},${mark!.y}`);return path.length>1?<polyline key={`ghost-${id}`} points={path.join(' ')} fill="none" stroke="var(--olive)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} pointerEvents="none" aria-hidden="true"/>:null;})}
      {[...trails].map(id=>{const points=frames.slice(0,index+1).map(item=>item.marks.find(mark=>mark.id===id)).filter(mark=>mark&&mark.opacity!==0).map(mark=>[mark!.x,mark!.y] as const);return points.length>1?<g key={`trail-${id}`} className="custom-trail" aria-hidden="true" pointerEvents="none"><polyline points={points.map(point=>point.join(',')).join(' ')} fill="none" stroke="var(--olive)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.65}/>{points.slice(0,-1).map(([x,y],i)=><circle key={i} cx={x} cy={y} r={3} fill="var(--olive)" opacity={0.25+0.45*(i/points.length)}/>)}</g>:null;})}
      {frame.marks.filter(mark=>mark.opacity!==0&&!regions.has(mark.id)).map(mark=>{
        const active=selection===`custom:${mark.id}`;
        return <g key={mark.id} role="button" tabIndex={0} opacity={mark.opacity??1} aria-label={mark.shape==='text'?`${mark.label}: ${Number(mark.value?.toPrecision(4))}`:mark.label} aria-pressed={active} onClick={()=>onSelect(mark.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(mark.id);}}}>
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

type Bounds={x:number;y:number;width:number;height:number};
/**
 * Presentation layers derived from the evaluated frames only. A large shape that never moves is a
 * region (drawn first, tinted, with level rings for ellipses); a circle that moves leaves a trail.
 */
function sceneLayers(frames:readonly CustomFrame[],bounds:Bounds){
  const regions=new Set<string>(),trails=new Set<string>();
  const first=frames[0];if(!first)return {regions,trails};
  const area=bounds.width*bounds.height;
  for(const mark of first.marks){
    const samples=frames.map(item=>item.marks.find(other=>other.id===mark.id)).filter(Boolean);
    const fixed=samples.every(other=>other!.x===mark.x&&other!.y===mark.y&&other!.width===mark.width&&other!.height===mark.height&&other!.radius===mark.radius);
    const size=mark.shape==='ellipse'?Math.PI*(mark.width??0)*(mark.height??0)/4:mark.shape==='rect'?(mark.width??0)*(mark.height??0):mark.shape==='circle'?Math.PI*(mark.radius??0)**2:0;
    if(fixed&&size>=area*0.06)regions.add(mark.id);
    else if(mark.shape==='circle'&&!fixed)trails.add(mark.id);
  }
  return {regions,trails};
}

function Region({mark,active,paint,onSelect}:{mark:CustomFrame['marks'][number];active:boolean;paint:string;onSelect:()=>void}){
  const props={fill:paint,fillOpacity:0.14,stroke:'var(--olive)',strokeOpacity:0.7,strokeWidth:active?3:1.5};
  return <g role="button" tabIndex={0} aria-label={mark.label} aria-pressed={active} onClick={onSelect} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect();}}}>
    <title>{mark.label}</title>
    {mark.shape==='ellipse'?<>
      <ellipse cx={mark.x} cy={mark.y} rx={(mark.width??0)/2} ry={(mark.height??0)/2} {...props}/>
      {[0.68,0.38].map(scale=><ellipse key={scale} cx={mark.x} cy={mark.y} rx={(mark.width??0)/2*scale} ry={(mark.height??0)/2*scale} fill="none" stroke="var(--olive)" strokeOpacity={0.35} strokeDasharray="4 5" pointerEvents="none"/>)}
    </>:mark.shape==='rect'?<rect x={mark.x} y={mark.y} width={mark.width} height={mark.height} rx={10} {...props}/>
    :<circle cx={mark.x} cy={mark.y} r={mark.radius} {...props}/>}
  </g>;
}
