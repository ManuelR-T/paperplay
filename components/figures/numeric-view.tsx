'use client';

import { useState } from 'react';
import type { AlgorithmInput, ExecutionTrace } from '@/shared/schema';

type MatrixInput = Extract<AlgorithmInput, { kind: 'matrix' }>;
type NumericState = Extract<ExecutionTrace['steps'][number]['state'], { kind: 'matrix' }>;
const number = (value: number) => Number.isInteger(value) ? String(value) : value.toPrecision(5);
/** Registry-independent numeric renderer: all values are explicit input or trusted trace data. */
export function NumericView({ input, state, mode = 'matrix', illustrative = false, history: completeHistory }: { input: MatrixInput; state?: NumericState; mode?: 'matrix' | 'plot'; illustrative?: boolean; history?: NumericState['history'] }) {
  const [selected, setSelected] = useState<[number, number]>([0, 0]);
  const max = Math.max(1, ...input.matrix.flat().map(Math.abs));
  const computed = !illustrative && !!state;
  const history = computed ? completeHistory ?? state.history : [];
  const [row, column] = selected;
  const safeRow = Math.min(row, input.matrix.length - 1); const safeColumn = Math.min(column, input.matrix.length - 1);
  return <div className="numeric-view" style={{ minWidth: 0, padding: '16px' }}>
    <p className="control-hint">{computed ? 'Computed trajectory on synthetic inputs. These are not measurements reported by the source paper.' : 'Illustrative synthetic matrix. No algorithm run or measured convergence is available.'}</p>
    {mode === 'matrix' ? <>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}><table className="matrix-table" style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%', minWidth: 240 }}><caption>Matrix A · inspect a cell by keyboard or pointer</caption><thead><tr><th scope="col">Row</th>{input.matrix.map((_, index) => <th scope="col" key={index}>{index + 1}</th>)}</tr></thead><tbody>{input.matrix.map((values, r) => <tr key={r}><th scope="row">{r + 1}</th>{values.map((value, c) => <td key={c}><button type="button" aria-label={`Matrix row ${r + 1}, column ${c + 1}: ${number(value)}`} aria-pressed={safeRow === r && safeColumn === c} onFocus={() => setSelected([r, c])} onClick={() => setSelected([r, c])} style={{ width: '100%', minHeight: 40, padding: 6, fontSize: 16, borderRadius: 5, background: `rgba(113, 139, 69, ${0.1 + Math.abs(value) / max * 0.35})`, color: '#26321f', border: safeRow === r && safeColumn === c ? '2px solid #455a3b' : '2px solid transparent' }}>{number(value)}</button></td>)}</tr>)}</tbody></table></div>
      <p role="status" className="control-hint">Selected A[{safeRow + 1}, {safeColumn + 1}] = {number(input.matrix[safeRow][safeColumn])}. Shade indicates magnitude; the number gives its sign.</p>
      <div style={{ overflowX: 'auto' }}><table className="numeric-vectors" style={{ width: '100%', fontSize: 14 }}><caption>Supplied RHS and {computed ? 'computed current iterate' : 'initial guess'}</caption><thead><tr><th scope="col">Coordinate</th><th scope="col">b</th><th scope="col">x</th></tr></thead><tbody>{input.rhs.map((rhs, i) => <tr key={i}><th scope="row">{i + 1}</th><td>{number(rhs)}</td><td>{number(computed ? state.values[i] : input.initial[i] ?? 0)}</td></tr>)}</tbody></table></div>
    </> : history.length ? <ConvergencePlot history={history} selectedIteration={state?.iteration}/> : <p role="status">No computed residual history is available. This figure does not invent convergence measurements.</p>}
    {computed && <p className="control-hint" aria-live="polite">Displayed iteration {state.iteration}: residual ‖Ax−b‖₂ = {state.residual.toPrecision(6)}. This describes the displayed iterate, not a hardware timing or a claim of general convergence.</p>}
  </div>;
}
function ConvergencePlot({ history, selectedIteration }: { history: NumericState['history']; selectedIteration?: number }) {
  const floor = 1e-15;
  const logs = history.map(point => Math.log10(Math.max(floor, point.residual)));
  const upper = Math.max(0, ...logs); const lower = Math.min(upper - 1, ...logs);
  const maxIteration = Math.max(1, history.at(-1)!.iteration);
  const x = (iteration: number) => 62 + iteration / maxIteration * 480;
  const y = (log: number) => 220 - (log - lower) / (upper - lower) * 180;
  const first = history[0]; const last = history.at(-1)!;
  const selected = history.find(point => point.iteration === selectedIteration);
  return <figure className="convergence-plot" style={{ margin: 0 }}>
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}><svg viewBox="0 0 580 270" role="img" aria-label={`Computed residual convergence: iteration ${first.iteration} residual ${first.residual.toPrecision(5)}, iteration ${last.iteration} residual ${last.residual.toPrecision(5)}. Logarithmic vertical scale.`} style={{ display: 'block', width: '100%', minWidth: 420, fontSize: 14 }}>
      <line x1={62} x2={542} y1={220} y2={220} stroke="#6a735f"/><line x1={62} x2={62} y1={40} y2={220} stroke="#6a735f"/>
      {[0, 0.5, 1].map(fraction => { const value = lower + fraction * (upper - lower); return <g key={fraction}><line x1={62} x2={542} y1={y(value)} y2={y(value)} stroke="#d7ddcf"/><text x={54} y={y(value) + 5} textAnchor="end" fill="#34452b">10^{value.toFixed(1)}</text></g>; })}
      <polyline points={history.map((point, i) => `${x(point.iteration)},${y(logs[i])}`).join(' ')} fill="none" stroke="#455a3b" strokeWidth={3}/>
      <circle cx={x(last.iteration)} cy={y(logs.at(-1)!)} r={4} fill="#455a3b"/>
      {selected && <circle cx={x(selected.iteration)} cy={y(Math.log10(Math.max(floor, selected.residual)))} r={5} fill="#455a3b" stroke="#faf9f5" strokeWidth={2}/>}
      <text x={62} y={245} fill="#34452b">0</text><text x={542} y={245} textAnchor="end" fill="#34452b">{last.iteration}</text><text x={300} y={264} textAnchor="middle" fill="#34452b">Iteration · actual synthetic updates</text>
    </svg></div>
    <figcaption className="control-hint">Computed residual norm, logarithmic vertical scale. Zero is drawn at the display floor 10⁻¹⁵. {history.length} actual samples from the complete configured run; the marker follows playback. No interpolated measurements or original-paper benchmark values.</figcaption>
    <details><summary style={{ fontSize: 14 }}>Read the numeric convergence values</summary><div style={{ maxHeight: 260, overflow: 'auto' }}><table style={{ width: '100%', fontSize: 14 }}><thead><tr><th scope="col">Iteration</th><th scope="col">Residual norm</th></tr></thead><tbody>{history.map(point => <tr key={point.iteration}><th scope="row">{point.iteration}</th><td>{point.residual.toPrecision(8)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
