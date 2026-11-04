'use client';

import { useEffect, useId, useState } from 'react';
import type { WidgetEnvelope, WidgetSpec } from '@/shared/widgets';
import { graphData, type WidgetResult } from '@/lib/widgets/compute';
import { svgPointer } from '@/lib/widgets/interaction';
import {conceptCanvas,conceptConnection,conceptRoutePath,layoutConceptNodes,placeEdgeLabels} from './concept-layout';

function readableLabel(label:string){
  const words=label.trim().split(/\s+/).flatMap(word=>word.match(/.{1,20}/gu)??[]),lines:string[]=[];
  for(const word of words){const last=lines.length-1;if(last>=0&&lines[last].length+word.length+1<=20)lines[last]+=' '+word;else lines.push(word);}
  return lines.length<=3?lines:[...lines.slice(0,2),lines[2].slice(0,18)+'…'];
}

export function GraphVisual({ envelope, result, step, setSpec, setView }: { envelope: WidgetEnvelope; result: WidgetResult; step: number; setSpec: (spec: WidgetSpec) => void; setView: (view: Partial<WidgetEnvelope['view']>) => void }) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const marker = useId().replaceAll(':', ''); const spec = envelope.spec;
  useEffect(() => { setDrag(null); }, [spec]);
  if (spec.kind !== 'diagram' && spec.kind !== 'graph') return null;
  const original = spec.kind === 'graph' ? graphData(spec) : spec;
  const graph = { ...original, nodes: original.nodes.map(node => drag?.id === node.id ? { ...node, x: drag.x, y: drag.y } : node) };
  const sharedEdgeLabel=spec.kind==='diagram'&&graph.edges.length>1&&graph.edges.every(edge=>edge.label===graph.edges[0].label)?graph.edges[0].label:undefined;
  const expandedLabels=graph.nodes.some(node=>node.label.length>4);
  const concept=spec.kind==='diagram'?layoutConceptNodes(graph.nodes,graph.edges):undefined;
  const conceptBoxes=new Map(concept?.nodes.map(node=>[node.id,node]));
  const conceptLabels=concept?placeEdgeLabels(concept.nodes,graph.edges,concept.routes):undefined;
  const canvas=concept&&conceptLabels?conceptCanvas(concept,graph.edges,conceptLabels):undefined;
  const edgeLines=graph.edges.map(edge=>{const a=graph.nodes.find(node=>node.id===edge.source)!,b=graph.nodes.find(node=>node.id===edge.target)!;return {edge,line:concept?conceptConnection(conceptBoxes.get(a.id)!,conceptBoxes.get(b.id)!):{x1:a.x*5.4+30,y1:a.y*2.3+30,x2:b.x*5.4+30,y2:b.y*2.3+30}};});
  const active = new Set(result.states?.[step]?.activeIds ?? []);
  const selected = graph.nodes.find(node => envelope.view.selection === `node:${node.id}`);
  const connections = selected ? graph.edges.filter(edge => edge.source === selected.id || edge.target === selected.id).map(edge => {
    const other = graph.nodes.find(node => node.id === (edge.source === selected.id ? edge.target : edge.source));
    return `${other?.label ?? 'Unknown'}${spec.kind === 'graph' ? ` (weight ${edge.weight})` : edge.label ? `: ${edge.label}` : ''}`;
  }) : [];
  return <div>
    <div className="widget-diagram-scroll" role="region" tabIndex={0} aria-label="Interactive diagram; scroll horizontally on small screens">
      <svg role="group" aria-label={`${spec.kind === 'diagram' ? 'Concept diagram' : 'Computed graph'} with ${graph.nodes.length} nodes`} viewBox={canvas?`${canvas.x} ${canvas.y} ${canvas.width} ${canvas.height}`:expandedLabels?'-55 -25 710 390':'0 0 600 300'} style={concept?{width:canvas!.width*envelope.view.zoom,height:'auto',minWidth:envelope.view.zoom>1?canvas!.width*envelope.view.zoom:Math.min(canvas!.width,520),maxWidth:envelope.view.zoom>1?'none':'100%'}:undefined} data-concept-layout={!!concept} data-expanded-labels={expandedLabels} className="widget-diagram">
        <defs><marker id={`arrow-${marker}`} markerWidth="7" markerHeight="7" refX={concept?7:16} refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="var(--soft)"/></marker></defs>
        <g>
          {edgeLines.map(({edge,line},index) => concept?.routes?.has(index) ? <path key={edge.id} d={conceptRoutePath(concept.routes.get(index)!)} fill="none" stroke="var(--soft)" strokeWidth={2} markerEnd={`url(#arrow-${marker})`}/> : <line key={edge.id} {...line} stroke="var(--soft)" strokeWidth={2} markerEnd={concept||spec.kind==='graph'&&spec.directed?`url(#arrow-${marker})`:undefined}/>)}
          {graph.nodes.map((node,index) => {const box=conceptBoxes.get(node.id);return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.label}${active.has(node.id) ? ', active in this step' : ''}`} aria-pressed={selected?.id === node.id}
            onClick={event => { if (event.currentTarget.dataset.dragged === 'true') { delete event.currentTarget.dataset.dragged; return; } setView({ selection: `node:${node.id}` }); }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setView({ selection: `node:${node.id}` }); }
              if (spec.kind === 'graph' && spec.mode === 'graph' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setSpec({ ...spec, nodes: spec.nodes.map(item => item.id !== node.id ? item : { ...item, x: Math.max(0, Math.min(100, item.x + (event.key === 'ArrowLeft' ? -2 : event.key === 'ArrowRight' ? 2 : 0))), y: Math.max(0, Math.min(100, item.y + (event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : 0))) }) }); }
            }}
            onPointerDown={event => { if (spec.kind === 'graph' && spec.mode === 'graph') { event.currentTarget.dataset.startX = String(event.clientX); event.currentTarget.dataset.startY = String(event.clientY); event.currentTarget.setPointerCapture(event.pointerId); } }}
            onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; if (Math.hypot(event.clientX - Number(event.currentTarget.dataset.startX), event.clientY - Number(event.currentTarget.dataset.startY)) < 4) return; const point = svgPointer(event.currentTarget.ownerSVGElement!, event.clientX, event.clientY); if (point) setDrag({ id: node.id, x: Math.max(0, Math.min(100, (point.x - 30) / 5.4)), y: Math.max(0, Math.min(100, (point.y - 30) / 2.3)) }); }}
            onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; event.currentTarget.releasePointerCapture(event.pointerId); if (drag && spec.kind === 'graph') { event.currentTarget.dataset.dragged = 'true'; setSpec({ ...spec, nodes: spec.nodes.map(item => item.id === drag.id ? { ...item, x: drag.x, y: drag.y } : item) }); } else setDrag(null); }} onPointerCancel={() => setDrag(null)} className="widget-node">
            <title>{node.label}</title>{box?<><rect x={box.x-box.width/2} y={box.y-box.height/2} width={box.width} height={box.height} rx={9} fill={active.has(node.id)||selected?.id===node.id?'var(--lime)':'var(--paper)'} stroke="var(--olive)" strokeWidth={selected?.id===node.id?4:2}/><text x={box.x} y={box.y-(box.lines.length-1)*10+5} textAnchor="middle" fontSize={16} fontWeight={500} fill="var(--ink)">{box.lines.map((line,lineIndex)=><tspan key={lineIndex} x={box.x} dy={lineIndex?20:0}>{line}</tspan>)}</text></>:<><circle cx={node.x * 5.4 + 30} cy={node.y * 2.3 + 30} r={27} fill="transparent"/>
            <circle cx={node.x * 5.4 + 30} cy={node.y * 2.3 + 30} r={18} fill={active.has(node.id) || selected?.id === node.id ? 'var(--lime)' : 'var(--paper)'} stroke="var(--olive)" strokeWidth={selected?.id === node.id ? 4 : 2}/>
            <text x={node.x * 5.4 + 30} y={node.y * 2.3 + 35} textAnchor="middle" fontSize={16} fontWeight={500} fill="var(--ink)">{node.label.length<=4?node.label:String(index+1)}</text>
            {node.label.length>4&&<text className="widget-node-label" x={node.x * 5.4 + 30} y={node.y * 2.3 + 72} textAnchor="middle" fontSize={16} fill="var(--ink)">{readableLabel(node.label).map((line,lineIndex)=><tspan key={lineIndex} x={node.x * 5.4 + 30} dy={lineIndex?19:0}>{line}</tspan>)}</text>}</>}
          </g>;})}
          {/* Labels render above the nodes so a box never hides what a connection means. */}
          {!sharedEdgeLabel&&edgeLines.map(({edge,line})=>{const at=conceptLabels?conceptLabels.get(edge.id):{x:(line.x1+line.x2)/2,y:(line.y1+line.y2)/2-14};return at?<text key={edge.id} className="widget-edge-label" x={at.x} y={at.y+5} textAnchor="middle" fill="var(--ink)" fontSize={concept?14:16}>{spec.kind === 'graph' ? edge.weight : edge.label}</text>:null;})}
        </g>
      </svg>
    </div>
    {sharedEdgeLabel&&<p className="widget-hint">Arrow → {sharedEdgeLabel}</p>}
    {selected && <p className="widget-selection" aria-live="polite"><strong>{selected.label}</strong>{connections.length ? ` · Connected to ${connections.join('; ')}` : ' · No declared connections.'}</p>}
    <p className="widget-hint">Select a node for its full name and connections. On small screens, swipe the diagram to explore it.</p>
  </div>;
}
