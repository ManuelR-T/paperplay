'use client';

import { useEffect, useRef, useState } from 'react';
import { svgPointer, histogramBins } from '@/lib/widgets/interaction';
import type { WidgetPoint } from '@/lib/widgets/compute';

const format = (value: number) => Number(value.toPrecision(5)).toString();
function useChartWidth() {
  const [node,setNode]=useState<HTMLDivElement|null>(null);const [width,setWidth]=useState(600);
  useEffect(()=>{if(!node)return;const measure=()=>setWidth(Math.max(240,Math.floor(node.clientWidth)));measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[node]);
  return {ref:setNode,width};
}

export function Plot({ points, secondary = [], selected, label, onProbe, discrete = false, primaryLabel = 'Computed values', secondaryLabel = 'Reference', xLabel = 'x', yLabel = 'Value' }: {
  points: WidgetPoint[]; secondary?: WidgetPoint[]; selected?: WidgetPoint; label: string;
  onProbe?: (x: number, y: number) => void; discrete?: boolean; primaryLabel?: string; secondaryLabel?: string; xLabel?: string; yLabel?: string;
}) {
  const { ref, width } = useChartWidth();
  const finite = [...points, ...secondary].filter(point => point.y !== null);
  if (!finite.length) return <p role="status">No finite values in this domain. Try another input.</p>;
  let minX = Math.min(...finite.map(point => point.x)), maxX = Math.max(...finite.map(point => point.x));
  let minY = Math.min(0, ...finite.map(point => point.y!)), maxY = Math.max(0, ...finite.map(point => point.y!));
  if (minX === maxX) { minX -= 1; maxX += 1; } if (minY === maxY) { minY -= 1; maxY += 1; }
  const left = 58, right = width - 18, top = 34, bottom = 204;
  const mapX = (x: number) => left + (x - minX) / (maxX - minX) * (right - left);
  const mapY = (y: number) => bottom - (y - minY) / (maxY - minY) * (bottom - top);
  function path(data: WidgetPoint[]) { let gap = true; return data.map(point => { if (point.y === null) { gap = true; return ''; } if (point.breakBefore) gap = true; const token = `${gap ? 'M' : 'L'}${mapX(point.x)},${mapY(point.y)}`; gap = false; return token; }).join(' '); }
  function probe(event: React.PointerEvent<SVGSVGElement>) { if (!onProbe) return; const point = svgPointer(event.currentTarget, event.clientX, event.clientY); if (!point) return; onProbe(minX + (point.x - left) / (right - left) * (maxX - minX), minY + (bottom - point.y) / (bottom - top) * (maxY - minY)); }
  return <div ref={ref} className="widget-chart">
    <p className="widget-chart-label">{label}</p>
    <svg role="img" aria-label={`${label}. ${xLabel}: ${format(minX)} to ${format(maxX)}. ${yLabel}: ${format(minY)} to ${format(maxY)}.`} viewBox={`0 0 ${width} 260`} style={{ width: '100%', height: 260, touchAction: onProbe ? 'none' : undefined }}
      onPointerDown={event => { if (onProbe) { event.currentTarget.setPointerCapture(event.pointerId); probe(event); } }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) probe(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={right} y1={top + fraction * (bottom - top)} y2={top + fraction * (bottom - top)} stroke="var(--line)"/><text x={left - 8} y={top + fraction * (bottom - top) + 4} textAnchor="end" fontSize={12} fill="currentColor">{format(maxY - fraction * (maxY - minY))}</text></g>)}
      {minX<0&&maxX>0&&<line x1={mapX(0)} x2={mapX(0)} y1={top} y2={bottom} stroke="var(--soft)" strokeDasharray="3 4"/>}{minY<0&&maxY>0&&<line x1={left} x2={right} y1={mapY(0)} y2={mapY(0)} stroke="var(--soft)" strokeDasharray="3 4"/>}
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="currentColor"/>
      <text x={left} y={20} fontSize={13} fill="currentColor">{yLabel}</text>
      {discrete ? points.filter(point => point.y !== null).map((point, index) => <g key={index}><line x1={mapX(point.x)} x2={mapX(point.x)} y1={mapY(0)} y2={mapY(point.y!)} stroke="var(--olive)" strokeWidth={3}/><circle cx={mapX(point.x)} cy={mapY(point.y!)} r={4} fill="var(--olive)"/></g>) : <path d={path(points)} fill="none" stroke="var(--olive)" strokeWidth={3}/>}
      {secondary.length > 0 && <path d={path(secondary)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="6 4"/>}
      <text x={left} y={225} fontSize={13} fill="currentColor">{format(minX)}</text><text x={right} y={225} textAnchor="end" fontSize={13} fill="currentColor">{format(maxX)}</text><text x={(left + right) / 2} y={247} textAnchor="middle" fontSize={13} fill="currentColor">{xLabel}</text>
      {selected?.y != null && <><line x1={mapX(selected.x)} x2={mapX(selected.x)} y1={top} y2={bottom} stroke="currentColor" strokeDasharray="3 4"/><circle cx={mapX(selected.x)} cy={mapY(selected.y)} r={5} fill="var(--ink)"/></>}
    </svg>
    <div className="widget-chart-legend"><span><i/>{primaryLabel}</span>{secondary.length > 0 && <span><i className="dashed"/>{secondaryLabel}</span>}</div>
    {selected?.y != null && <p className="widget-probe-value" aria-live="polite">{xLabel} = {format(selected.x)} · {yLabel} = {format(selected.y)}</p>}
  </div>;
}

export function VectorInput({ vector, onChange }: { vector: number[]; onChange: (value: [number, number]) => void }) {
  const { ref, width } = useChartWidth(); const centerX = width / 2, centerY = 120, extent=Math.max(4,Math.ceil(Math.max(...vector.map(Math.abs)))),scale = Math.min((width - 40) / (2*extent), 100/extent);
  function move(event: React.PointerEvent<SVGSVGElement>) { const point = svgPointer(event.currentTarget, event.clientX, event.clientY); if (point) onChange([Number(Math.max(-extent, Math.min(extent, (point.x - centerX) / scale)).toPrecision(7)), Number(Math.max(-extent, Math.min(extent, (centerY - point.y) / scale)).toPrecision(7))]); }
  return <div ref={ref} className="widget-chart"><p className="widget-chart-label">Input vector</p><svg role="img" aria-label={`Input vector x ${format(vector[0])}, y ${format(vector[1])}. Tap or drag; the coordinate fields provide keyboard editing.`} viewBox={`0 0 ${width} 240`} style={{ width: '100%', height: 240, touchAction: 'none' }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
    {[-extent, -extent/2, 0, extent/2, extent].map(value => <g key={value}><line x1={centerX + value * scale} x2={centerX + value * scale} y1={20} y2={220} stroke={value ? 'var(--line)' : 'var(--soft)'}/><line x1={20} x2={width - 20} y1={centerY - value * scale} y2={centerY - value * scale} stroke={value ? 'var(--line)' : 'var(--soft)'}/></g>)}
    <line x1={centerX} y1={centerY} x2={centerX + vector[0] * scale} y2={centerY - vector[1] * scale} stroke="var(--olive)" strokeWidth={3}/><circle cx={centerX + vector[0] * scale} cy={centerY - vector[1] * scale} r={8} fill="var(--olive)"/><text x={width - 20} y={centerY - 8} textAnchor="end" fill="currentColor">x</text><text x={centerX + 8} y={20} fill="currentColor">y</text>
  </svg><p className="widget-hint">Tap or drag to set the input. Coordinates range from {-extent} to {extent}.</p></div>;
}

export function AttentionHeatmap({ weights, mask, query, onSelect }: { weights: number[][]; mask: boolean[][]; query: number; onSelect: (row: number, column: number) => void }) {
  return <div className="widget-table-region" role="region" tabIndex={0} aria-label="Attention weight heatmap"><table className="attention-heatmap"><caption>Attention weights · rows with allowed keys sum to 1</caption><thead><tr><th scope="col">Query / Key</th>{weights[0].map((_, index) => <th key={index} scope="col">K{index + 1}</th>)}</tr></thead><tbody>{weights.map((row, i) => <tr key={i} data-selected={i === query}><th scope="row">Q{i + 1}</th>{row.map((value, j) => <td key={j}><button aria-label={`Query ${i + 1}, key ${j + 1}: ${format(value)}${mask.length && !mask[i][j] ? ', masked' : ''}`} aria-pressed={i === query} onClick={() => onSelect(i, j)} style={{ background: `rgba(83,105,65,${.08 + .65 * value})` }}>{mask.length && !mask[i][j] ? <><span>0</span><small>masked</small></> : Number(value.toPrecision(3))}</button></td>)}</tr>)}</tbody></table></div>;
}

export function SampleHistogram({ samples,discrete=false }: { samples: number[];discrete?:boolean }) {
  const { ref, width } = useChartWidth();
  const bins=histogramBins(samples,discrete),min=bins[0]?.from??0,max=bins.at(-1)?.to??0,counts=bins.map(bin=>bin.count);
  const highest = Math.max(1, ...counts), barWidth = (width - 66) / Math.max(1,bins.length);
  return <div ref={ref} className="widget-chart"><p className="widget-chart-label">Observed samples · {samples.length} draws</p><svg viewBox={`0 0 ${width} 185`} role="img" aria-label={`Sample frequency histogram, ${samples.length} actual seeded draws, range ${format(min)} to ${format(max)}. Exact draws are in Values.`} style={{ width: '100%', height: 185 }}><text x={42} y={20} fontSize={13} fill="currentColor">Count</text>{counts.map((count, index) => <rect key={index} x={42 + index * barWidth} y={145 - count / highest * 110} width={Math.max(1, barWidth - 2)} height={count / highest * 110} fill="var(--olive)"><title>{count} draws · {format(bins[index].from)}{bins[index].from!==bins[index].to?` to ${format(bins[index].to)}`:''}</title></rect>)}<text x={34} y={40} textAnchor="end" fontSize={12} fill="currentColor">{highest}</text><text x={42} y={168} fontSize={13} fill="currentColor">{format(min)}</text><text x={width - 24} y={168} textAnchor="end" fontSize={13} fill="currentColor">{format(max)}</text></svg></div>;
}
