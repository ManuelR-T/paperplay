'use client';

import { NumericView } from './numeric-view';
import { useId } from 'react';
import type { AlgorithmInput, ExecutionTrace } from '@/shared/schema';

type State = ExecutionTrace['steps'][number]['state'];
export function TraceView({ input, state, compact = false, illustrative = false }: { input: AlgorithmInput; state: State; compact?: boolean; illustrative?: boolean }) {
  if (input.kind === 'matrix' && state.kind === 'matrix') return <NumericView input={input} state={state} illustrative={illustrative}/>;
  if (input.kind === 'graph' && state.kind === 'graph') return <GraphView input={input} state={state} compact={compact} illustrative={illustrative} />;
  if (input.kind === 'array' && state.kind === 'array') return <ArrayView state={state} illustrative={illustrative} />;
  return <p role="alert" className="figure-error">This trace cannot be shown with the supplied input.</p>;
}

function GraphView({ input, state, compact, illustrative }: { input: Extract<AlgorithmInput, { kind: 'graph' }>; state: Extract<State, { kind: 'graph' }>; compact: boolean; illustrative: boolean }) {
  const markerId = useId().replace(/:/g, '');
  const coordinates = new Map(input.nodes.map((node, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / input.nodes.length;
    return [node.id, { x: 280 + Math.cos(angle) * 195, y: 157 + Math.sin(angle) * 109 }];
  }));
  const distances = state.distances ?? {};
  return <div className={`trace-graph ${compact ? 'compact' : ''}`}>
    <div className="graph-viewport" tabIndex={0} role="region" aria-label="Graph visualization; scroll horizontally when needed"><svg viewBox="0 0 560 320" role="img" aria-label={illustrative ? `Illustrative graph with ${input.nodes.length} nodes. Selected: ${state.activeNodeIds.join(', ') || 'none'}.` : `Graph with ${input.nodes.length} nodes. Active: ${state.activeNodeIds.join(', ') || 'none'}. Settled: ${state.visitedNodeIds.join(', ') || 'none'}.`}>
      <defs><marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="currentColor" /></marker></defs>
      {input.edges.map(edge => {
        const from = coordinates.get(edge.source)!; const to = coordinates.get(edge.target)!;
        const dx = to.x - from.x; const dy = to.y - from.y; const distance = Math.hypot(dx, dy) || 1;
        const active = state.activeEdgeIds.includes(edge.id);
        const labelWidth = Math.max(34, String(edge.weight).length * 11 + 12);
        return <g key={edge.id} className={active ? 'trace-edge active' : 'trace-edge'}><line x1={from.x + dx / distance * 25} y1={from.y + dy / distance * 25} x2={to.x - dx / distance * 29} y2={to.y - dy / distance * 29} markerEnd={input.directed ? `url(#${markerId})` : undefined}/><rect x={(from.x + to.x) / 2 - labelWidth / 2} y={(from.y + to.y) / 2 - 12} width={labelWidth} height="22" rx="5"/><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 + 3}>{edge.weight}</text></g>;
      })}
      {input.nodes.map(node => {
        const point = coordinates.get(node.id)!; const active = state.activeNodeIds.includes(node.id); const visited = state.visitedNodeIds.includes(node.id); const frontier = state.frontierNodeIds?.includes(node.id);
        const value = Object.hasOwn(distances, node.id) ? distances[node.id] === null ? '∞' : String(distances[node.id]) : '—';
        return <g key={node.id} className={`trace-node ${active ? 'active' : visited ? 'visited' : frontier ? 'frontier' : ''}`}><circle cx={point.x} cy={point.y} r="24"/><text x={point.x} y={point.y + 5}>{node.label}</text>{!illustrative && <text className="node-detail" x={point.x} y={point.y + 43}>d={value}{visited ? ' ✓' : active ? ' •' : ''}</text>}</g>;
      })}
    </svg></div>
    <p className="graph-scroll-hint">{compact ? 'Scroll the graph horizontally to read all labels.' : 'Scroll the graph horizontally to read all labels. Node values are also listed in the table.'}</p>
    {illustrative ? <p className="control-hint">Highlight a node to inspect the conceptual structure. No algorithm is running.</p> : <div className="graph-legend"><span>● Active</span><span>✓ Settled</span><span>○ Frontier</span><span>d = tentative distance</span></div>}
    <div className="state-table">{illustrative ? <table><caption>Illustrative nodes</caption><thead><tr><th>Node</th><th>Selection</th></tr></thead><tbody>{input.nodes.map(node => <tr key={node.id}><th scope="row">{node.label}</th><td>{state.activeNodeIds.includes(node.id) ? 'Selected' : '—'}</td></tr>)}</tbody></table> : <table><caption>Current node state</caption><thead><tr><th>Node</th><th>Distance</th><th>Status</th></tr></thead><tbody>{input.nodes.map(node => <tr key={node.id}><th scope="row">{node.label}</th><td>{Object.hasOwn(distances, node.id) ? distances[node.id] ?? '∞' : '—'}</td><td>{state.activeNodeIds.includes(node.id) ? 'Active' : state.visitedNodeIds.includes(node.id) ? 'Settled' : state.frontierNodeIds?.includes(node.id) ? 'Frontier' : 'Unvisited'}</td></tr>)}</tbody></table>}</div>
  </div>;
}

function ArrayView({ state, illustrative }: { state: Extract<State, { kind: 'array' }>; illustrative: boolean }) {
  return <div className="trace-array">
    {state.mergeRange && <p className="array-range">Merging [{state.mergeRange.start}, {state.mergeRange.middle}) with [{state.mergeRange.middle}, {state.mergeRange.end})</p>}
    <ol className="array-cells" aria-label="Current array values">{state.values.map((value, index) => <li key={index} className={state.activeIndices.includes(index) ? 'active' : ''}><span className="array-index">{index}</span><strong>{value}</strong>{!illustrative && <small>origin {state.originalIndices?.[index] ?? index}</small>}{state.activeIndices.includes(index) && <span className="array-active-label">{illustrative ? 'selected' : 'active'}</span>}</li>)}</ol>
    {state.values.length === 0 && <p className="empty-array">Empty input: no values to sort.</p>}
    {state.runs && <p className="control-hint">Known runs: {state.runs.map(run => `[${run.start}, ${run.end})`).join(' · ') || 'none'}</p>}
    <p className="control-hint">{illustrative ? 'Inspect the example values without running an algorithm. Indices are zero-based.' : 'Origin indices make the order of equal values visible. Array indices and ranges are zero-based.'}</p>
  </div>;
}
