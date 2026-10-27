'use client';

import { useEffect, useId, useState } from 'react';
import type { WidgetEnvelope, WidgetSpec } from '@/shared/widgets';
import { graphData, type WidgetResult } from '@/lib/widgets/compute';
import { svgPointer } from '@/lib/widgets/interaction';

export function GraphVisual({ envelope, result, step, setSpec, setView }: { envelope: WidgetEnvelope; result: WidgetResult; step: number; setSpec: (spec: WidgetSpec) => void; setView: (view: Partial<WidgetEnvelope['view']>) => void }) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const marker = useId().replaceAll(':', ''); const spec = envelope.spec;
  useEffect(() => { setDrag(null); }, [spec]);
  if (spec.kind !== 'diagram' && spec.kind !== 'graph') return null;
  const original = spec.kind === 'graph' ? graphData(spec) : spec;
  const graph = { ...original, nodes: original.nodes.map(node => drag?.id === node.id ? { ...node, x: drag.x, y: drag.y } : node) };
  const active = new Set(result.states?.[step]?.activeIds ?? []);
  const selected = graph.nodes.find(node => envelope.view.selection === `node:${node.id}`);
  const connections = selected ? graph.edges.filter(edge => edge.source === selected.id || edge.target === selected.id).map(edge => {
    const other = graph.nodes.find(node => node.id === (edge.source === selected.id ? edge.target : edge.source));
    return `${other?.label ?? 'Unknown'}${spec.kind === 'graph' ? ` (weight ${edge.weight})` : edge.label ? `: ${edge.label}` : ''}`;
  }) : [];
  return <div>
    <div className="widget-diagram-scroll" role="region" tabIndex={0} aria-label="Interactive diagram; scroll horizontally on small screens">
      <svg role="group" aria-label={`${spec.kind === 'diagram' ? 'Concept diagram' : 'Computed graph'} with ${graph.nodes.length} nodes`} viewBox="0 0 600 300" className="widget-diagram">
        <defs><marker id={`arrow-${marker}`} markerWidth="7" markerHeight="7" refX="16" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="var(--soft)"/></marker></defs>
        <g transform={spec.kind === 'diagram' ? `translate(${300 - 300 * envelope.view.zoom},${150 - 150 * envelope.view.zoom}) scale(${envelope.view.zoom})` : undefined}>
          {graph.edges.map(edge => { const a = graph.nodes.find(node => node.id === edge.source)!, b = graph.nodes.find(node => node.id === edge.target)!; return <g key={edge.id}><line x1={a.x * 5.4 + 30} y1={a.y * 2.3 + 30} x2={b.x * 5.4 + 30} y2={b.y * 2.3 + 30} stroke="var(--soft)" strokeWidth={2} markerEnd={spec.kind === 'graph' && spec.directed ? `url(#arrow-${marker})` : undefined}/><text x={(a.x + b.x) * 2.7 + 30} y={(a.y + b.y) * 1.15 + 22} textAnchor="middle" fill="currentColor" fontSize={14}>{spec.kind === 'graph' ? edge.weight : edge.label}</text></g>; })}
          {graph.nodes.map(node => <g key={node.id} role="button" tabIndex={0} aria-label={`${node.label}${active.has(node.id) ? ', active in this step' : ''}`} aria-pressed={selected?.id === node.id}
            onClick={event => { if (event.currentTarget.dataset.dragged === 'true') { delete event.currentTarget.dataset.dragged; return; } setView({ selection: `node:${node.id}` }); }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setView({ selection: `node:${node.id}` }); }
              if (spec.kind === 'graph' && spec.mode === 'graph' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setSpec({ ...spec, nodes: spec.nodes.map(item => item.id !== node.id ? item : { ...item, x: Math.max(0, Math.min(100, item.x + (event.key === 'ArrowLeft' ? -2 : event.key === 'ArrowRight' ? 2 : 0))), y: Math.max(0, Math.min(100, item.y + (event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : 0))) }) }); }
            }}
            onPointerDown={event => { if (spec.kind === 'graph' && spec.mode === 'graph') { event.currentTarget.dataset.startX = String(event.clientX); event.currentTarget.dataset.startY = String(event.clientY); event.currentTarget.setPointerCapture(event.pointerId); } }}
            onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; if (Math.hypot(event.clientX - Number(event.currentTarget.dataset.startX), event.clientY - Number(event.currentTarget.dataset.startY)) < 4) return; const point = svgPointer(event.currentTarget.ownerSVGElement!, event.clientX, event.clientY); if (point) setDrag({ id: node.id, x: Math.max(0, Math.min(100, (point.x - 30) / 5.4)), y: Math.max(0, Math.min(100, (point.y - 30) / 2.3)) }); }}
            onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; event.currentTarget.releasePointerCapture(event.pointerId); if (drag && spec.kind === 'graph') { event.currentTarget.dataset.dragged = 'true'; setSpec({ ...spec, nodes: spec.nodes.map(item => item.id === drag.id ? { ...item, x: drag.x, y: drag.y } : item) }); } else setDrag(null); }} onPointerCancel={() => setDrag(null)} className="widget-node">
            <title>{node.label}</title><circle cx={node.x * 5.4 + 30} cy={node.y * 2.3 + 30} r={27} fill="transparent"/>
            <circle cx={node.x * 5.4 + 30} cy={node.y * 2.3 + 30} r={spec.kind === 'diagram' ? 23 : 18} fill={active.has(node.id) || selected?.id === node.id ? 'var(--lime)' : 'var(--paper)'} stroke="var(--olive)" strokeWidth={selected?.id === node.id ? 4 : 2}/>
            <text x={node.x * 5.4 + 30} y={node.y * 2.3 + 35} textAnchor="middle" fontSize={14} fill="currentColor">{node.label.length > 12 ? `${node.label.slice(0, 10)}…` : node.label}</text>
          </g>)}
        </g>
      </svg>
    </div>
    {selected && <p className="widget-selection" aria-live="polite"><strong>{selected.label}</strong>{connections.length ? ` · Connected to ${connections.join('; ')}` : ' · No declared connections.'}</p>}
    <p className="widget-hint">Select a node for its full name and connections. On small screens, swipe the diagram to explore it.</p>
  </div>;
}
