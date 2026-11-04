'use client';

import { useEffect, useRef, useState } from 'react';
import { svgPointer, histogramBins } from '@/lib/widgets/interaction';
import type { WidgetPoint } from '@/lib/widgets/compute';

const format = (value: number) => Number(value.toPrecision(5)).toString();
const tickLabel = (value: number) => Math.abs(value) < 1e-12 ? '0' : Math.abs(value) >= 1e5 || Math.abs(value) < 1e-3 ? Number(value.toPrecision(2)).toExponential() : Number(value.toPrecision(4)).toString();
/** Round tick positions within [min, max], widening the domain to a nearby round bound. */
export function niceTicks(min: number, max: number, target = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { min, max, ticks: [min, max] };
  const raw = (max - min) / target, power = 10 ** Math.floor(Math.log10(raw)), unit = raw / power;
  const step = (unit < 1.5 ? 1 : unit < 3 ? 2 : unit < 7 ? 5 : 10) * power;
  const low = Math.floor(min / step + 1e-9) * step, high = Math.ceil(max / step - 1e-9) * step, ticks: number[] = [];
  // Widen to a round outer tick only when it is close; never waste a large band of the plot.
  const slack = (max - min) * 0.12, domainMin = min - low <= slack ? low : min, domainMax = high - max <= slack ? high : max;
  for (let value = low; value <= high + step / 2 && ticks.length < 12; value += step) { const tick = Number(value.toPrecision(12)); if (tick >= domainMin - 1e-9 && tick <= domainMax + 1e-9) ticks.push(tick); }
  return { min: domainMin, max: domainMax, ticks };
}
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
  const yAxis = niceTicks(minY, maxY, 4), xAxis = niceTicks(minX, maxX, Math.max(3, Math.min(6, Math.floor(width / 120))));
  minY = yAxis.min; maxY = yAxis.max;
  // x stays on the data's own domain (probe and curve ends are meaningful); only ticks are rounded.
  const xTicks = xAxis.ticks.filter(value => value >= minX - 1e-9 && value <= maxX + 1e-9);
  const left = 58, right = width - 18, top = 34, bottom = 204;
  const mapX = (x: number) => left + (x - minX) / (maxX - minX) * (right - left);
  const mapY = (y: number) => bottom - (y - minY) / (maxY - minY) * (bottom - top);
  function path(data: WidgetPoint[]) { let gap = true; return data.map(point => { if (point.y === null) { gap = true; return ''; } if (point.breakBefore) gap = true; const token = `${gap ? 'M' : 'L'}${mapX(point.x)},${mapY(point.y)}`; gap = false; return token; }).join(' '); }
  function probe(event: React.PointerEvent<SVGSVGElement>) { if (!onProbe) return; const point = svgPointer(event.currentTarget, event.clientX, event.clientY); if (!point) return; onProbe(minX + (point.x - left) / (right - left) * (maxX - minX), minY + (bottom - point.y) / (bottom - top) * (maxY - minY)); }
  return <div ref={ref} className="widget-chart">
    <p className="widget-chart-label">{label}</p>
    <svg role="img" aria-label={`${label}. ${xLabel}: ${format(minX)} to ${format(maxX)}. ${yLabel}: ${format(minY)} to ${format(maxY)}.`} viewBox={`0 0 ${width} 260`} style={{ width: '100%', height: 260, touchAction: onProbe ? 'none' : undefined }}
      onPointerDown={event => { if (onProbe) { event.currentTarget.setPointerCapture(event.pointerId); probe(event); } }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) probe(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
      {yAxis.ticks.map(value => <g key={value} className="widget-axis-tick"><line x1={left} x2={right} y1={mapY(value)} y2={mapY(value)} stroke="var(--line)"/><text x={left - 8} y={mapY(value) + 4} textAnchor="end" fontSize={12} fill="var(--soft)">{tickLabel(value)}</text></g>)}
      {xTicks.map(value => <g key={value} className="widget-axis-tick"><line x1={mapX(value)} x2={mapX(value)} y1={bottom} y2={bottom + 5} stroke="var(--soft)"/><text x={mapX(value)} y={bottom + 19} textAnchor="middle" fontSize={12} fill="var(--soft)">{tickLabel(value)}</text></g>)}
      {minX<0&&maxX>0&&<line x1={mapX(0)} x2={mapX(0)} y1={top} y2={bottom} stroke="var(--soft)" strokeDasharray="3 4"/>}{minY<0&&maxY>0&&<line x1={left} x2={right} y1={mapY(0)} y2={mapY(0)} stroke="var(--soft)" strokeDasharray="3 4"/>}
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="currentColor"/>
      <text x={left} y={20} fontSize={13} fill="currentColor">{yLabel}</text>
      {discrete ? points.filter(point => point.y !== null).map((point, index) => <g key={index}><line x1={mapX(point.x)} x2={mapX(point.x)} y1={mapY(0)} y2={mapY(point.y!)} stroke="var(--olive)" strokeWidth={3}/><circle cx={mapX(point.x)} cy={mapY(point.y!)} r={4} fill="var(--olive)"/></g>) : <>{points.length>1&&points.every((point,index)=>point.y!==null&&(!index||!point.breakBefore))&&<path d={`${path(points.filter(point=>point.y!==null))} L${mapX(points.filter(point=>point.y!==null).at(-1)!.x)},${mapY(Math.max(minY,Math.min(0,maxY)))} L${mapX(points.find(point=>point.y!==null)!.x)},${mapY(Math.max(minY,Math.min(0,maxY)))} Z`} fill="var(--olive)" fillOpacity={0.07} stroke="none"/>}<path d={path(points)} fill="none" stroke="var(--olive)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"/></>}
      {secondary.length > 0 && <path d={path(secondary)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="6 4"/>}
      <text x={(left + right) / 2} y={250} textAnchor="middle" fontSize={13} fill="currentColor">{xLabel}</text>
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
  return <div ref={ref} className="widget-chart"><p className="widget-chart-label">Observed samples · {samples.length} draws</p><svg viewBox={`0 0 ${width} 185`} role="img" aria-label={`Sample frequency histogram, ${samples.length} actual seeded draws, range ${format(min)} to ${format(max)}. Exact draws are in Values.`} style={{ width: '100%', height: 185 }}><text x={42} y={20} fontSize={13} fill="currentColor">Count</text>{counts.map((count, index) => <rect key={index} x={42 + index * barWidth} y={145 - count / highest * 110} width={Math.max(1, barWidth - 2)} height={count / highest * 110} rx={2} fill="var(--olive)" fillOpacity={0.78}><title>{count} draws · {format(bins[index].from)}{bins[index].from!==bins[index].to?` to ${format(bins[index].to)}`:''}</title></rect>)}<text x={34} y={40} textAnchor="end" fontSize={12} fill="currentColor">{highest}</text><text x={42} y={168} fontSize={12} fill="var(--soft)">{tickLabel(min)}</text><text x={width - 24} y={168} textAnchor="end" fontSize={12} fill="var(--soft)">{tickLabel(max)}</text></svg></div>;
}
