'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { algorithmInputSchema, type FigureSpecification, type SourceDocument } from '@/shared/schema';
import { engineRegistry, engineMetadata, type EngineRun } from '@/lib/engines';
import { assessFigureFidelity } from '@/lib/fidelity';
import { PlaybackControls, usePlayback } from './playback';
import { ContextualQuestion } from '../contextual-question';
import { ExperimentActions } from '../experiment-actions';
import { figureSnapshot, useReadingSession } from '../reading-session';
import { useEngineRun, useEngineComparison } from '../use-engine-execution';
import { NumericView } from './numeric-view';
import { TraceView } from './trace-view';
import { createEngineFigure, createConvergenceFigure, createComparisonFigure, createWalkthroughFigure, type PreparedExperimentState } from '@/lib/prepared-figures';

type Run = EngineRun;
export type ExperimentState = PreparedExperimentState;

export function FidelityNote({ figure }: { figure: FigureSpecification }) {
  const evidence = assessFigureFidelity(figure);
  return <div className="fidelity-note"><Badge variant="outline">{evidence.label}</Badge><span>Implementation evidence · synthetic input · not an original benchmark</span><details><summary>Scope & verification</summary><p>{evidence.claim}</p><ul>{evidence.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>{evidence.referenceCaseIds.length > 0 && <p>Reference checks: {evidence.referenceCaseIds.join(', ')}</p>}</details></div>;
}

export function EngineFigure({ id, document, anchorId, state, setState, reset, mode }: { id: string; document: SourceDocument; anchorId: string; state: ExperimentState; setState: (state: ExperimentState) => void; reset: () => void; mode?: 'plot' }) {
  const capability = engineRegistry.find(engine => engine.id === state.engineId);
  const specification = useMemo(() => {
    try { return { figure: mode === 'plot' ? createConvergenceFigure(document, id, anchorId, state) : createEngineFigure(document, id, anchorId, state), error: null }; }
    catch (error) { return { figure: null, error: error instanceof Error ? error.message : 'Unable to configure this experiment.' }; }
  }, [document, id, anchorId, state, mode]);
  const execution = useEngineRun(specification.figure ? { kind: 'run', engineId: state.engineId, input: state.input, options: { seed: state.seed, parameters: state.parameters } } : null);
  const result = { figure: specification.figure, run: execution.run, error: specification.error ?? execution.error };
  const session = useReadingSession();
  const saved = session?.ready ? session.state.figures.find(item => item.snapshot.figure.id === id) : undefined;
  const playback = usePlayback(result.run?.trace.steps.length ?? 1, execution.identity, saved?.stepIndex ?? 0);
  useEffect(() => {
    if (session?.ready && result.figure && result.run) session.putFigure({ snapshot: figureSnapshot(document, result.figure, state.seed), stepIndex: playback.index, selection: '' });
  }, [result.figure, result.run, playback.index, session?.ready]);
  const [arrayDraft, setArrayDraft] = useState(state.input.kind === 'array' ? state.input.values.join(', ') : '');
  const [inputError, setInputError] = useState('');
  const [matrixDraft, setMatrixDraft] = useState(state.input.kind === 'matrix' ? JSON.stringify(state.input, null, 2) : '');
  const [selectedEdge, setSelectedEdge] = useState(0);
  useEffect(() => { if (state.input.kind === 'array') setArrayDraft(state.input.values.join(', ')); if (state.input.kind === 'matrix') setMatrixDraft(JSON.stringify(state.input, null, 2)); setInputError(''); }, [state.input]);
  const engines = engineRegistry.filter(engine => engine.inputKind === state.input.kind);
  const step = result.run?.trace.steps[playback.index];
  function applyArray() {
    const tokens = arrayDraft.trim() ? arrayDraft.split(',') : [];
    const values = tokens.map(value => Number(value.trim()));
    if (tokens.some(value => value.trim() === '') || values.length > 32 || values.some(value => !Number.isFinite(value) || Math.abs(value) > 1_000_000)) { setInputError('Enter at most 32 finite comma-separated numbers between −1,000,000 and 1,000,000.'); return; }
    setState({ ...state, input: { kind: 'array', values } }); setInputError('');
  }
  return <section id={id} tabIndex={-1} className="paperplay-figure" aria-labelledby={`${id}-title`}>
    <div className="added-figure-label"><span className="tiny-dot"/> ADDED BY PAPERPLAY <span>Interactive figure</span></div>
    <div className="experiment-heading"><h3 id={`${id}-title`}>{mode === 'plot' ? 'Inspect the computed residual trajectory.' : state.input.kind === 'matrix' ? 'Explore curvature and numerical updates.' : state.input.kind === 'graph' ? 'Inspect how shortest distances emerge.' : 'Watch the merge order take shape.'}</h3><Button variant="ghost" size="sm" onClick={() => { reset(); playback.reset(); }}><RotateCcw size={14}/>Reset experiment</Button></div>
    <p className="experiment-lead">{state.input.kind === 'matrix' ? 'Inspect a synthetic positive definite matrix, change the update parameters and compare actual residuals.' : state.input.kind === 'graph' ? 'Change an edge weight, then step through an actual shortest-distance computation.' : 'Change the values or regenerate the input, then inspect an actual stable sorting trace.'}</p>
    <div className="experiment-inputs">
      <label>Method<select value={state.engineId} onChange={event => { const engine = engineRegistry.find(item => item.id === event.target.value)!; setState({ ...state, engineId: engine.id, parameters: Object.fromEntries(engine.parameters.map(parameter => [parameter.key, parameter.initial])) }); }}>{engines.map(engine => <option key={engine.id} value={engine.id}>{engineMetadata[engine.id].name}</option>)}</select></label>
      {capability?.parameters.map(parameter => <label key={parameter.key}>{parameter.label}<input type="number" min={parameter.min} max={parameter.max} step={parameter.step} value={state.parameters[parameter.key]} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) setState({ ...state, parameters: { ...state.parameters, [parameter.key]: value } }); }}/></label>)}
    </div>
    {state.input.kind === 'graph' && state.input.edges.length > 0 && <div className="graph-inputs">
      <label>Edit edge<select aria-label="Edge to edit" value={Math.min(selectedEdge, state.input.edges.length - 1)} onChange={event => setSelectedEdge(Number(event.target.value))}>{state.input.edges.map((edge, index) => <option key={edge.id} value={index}>{edge.source} → {edge.target}</option>)}</select></label>
      <label>Weight<input aria-label="Selected edge weight" type="number" min={0} max={100} step={1} value={state.input.edges[Math.min(selectedEdge, state.input.edges.length - 1)].weight} onChange={event => { const value = Number(event.target.value); if (!Number.isFinite(value) || value < 0 || value > 100) return; if (state.input.kind !== 'graph') return; const index = Math.min(selectedEdge, state.input.edges.length - 1); setState({ ...state, input: { ...state.input, edges: state.input.edges.map((edge, position) => position === index ? { ...edge, weight: value } : edge) } }); }}/></label><span className="control-hint">Nonnegative weights are required by these engines.</span>
    </div>}
    {state.input.kind === 'array' && <div className="array-inputs"><label htmlFor={`${id}-values`}>Input values<input id={`${id}-values`} value={arrayDraft} onChange={event => setArrayDraft(event.target.value)} spellCheck={false}/></label><Button variant="outline" size="sm" onClick={applyArray}>Apply values</Button></div>}
    {state.input.kind === 'matrix' && mode !== 'plot' && <div className="matrix-inputs"><label htmlFor={`${id}-matrix`}>Synthetic matrix input (JSON)<textarea id={`${id}-matrix`} rows={6} value={matrixDraft} onChange={event => setMatrixDraft(event.target.value)}/></label><Button variant="outline" size="sm" onClick={() => { try { const input = algorithmInputSchema.parse(JSON.parse(matrixDraft)); if (input.kind !== 'matrix') throw new Error('Use a matrix input.'); setState({ ...state, input }); setInputError(''); } catch { setInputError('Supply a square symmetric positive definite matrix (up to 8×8), matching rhs and an initial vector or [].'); } }}>Apply matrix input</Button></div>}
    <ExecutionStatus execution={execution}/>
    {inputError && <p role="alert" className="figure-error">{inputError}</p>}
    {result.error ? <div role="alert" className="figure-error">{result.error} Reset the experiment or correct the input.</div> : result.run && step && <>
      <div className="trace-surface">{state.input.kind === 'matrix' && step.state.kind === 'matrix' ? <NumericView input={state.input} state={step.state} mode={mode ?? 'matrix'} history={mode === 'plot' && result.run?.trace.steps.at(-1)?.state.kind === 'matrix' ? (result.run.trace.steps.at(-1)!.state as Extract<typeof step.state, {kind:'matrix'}>).history : undefined}/> : <TraceView input={state.input} state={step.state}/>}</div>
      <div className="trace-description" aria-live="polite"><span>{step.operations} counted operations</span><p>{step.description}</p></div>
      <PlaybackControls playback={playback} length={result.run.trace.steps.length} label="algorithm"/>
      <RunSummary run={result.run}/>
    </>}
    {result.figure && <><FidelityNote figure={result.figure}/><div className="figure-tools"><ContextualQuestion source={document} blockId={document.anchors.find(item => item.id === anchorId)!.blockId} figure={result.figure} seed={state.seed} stepIndex={playback.index}/><ExperimentActions source={document} snapshot={figureSnapshot(document, result.figure, state.seed)}/></div></>}
    <SourceReturn document={document} anchorId={anchorId}/>
  </section>;
}

function RunSummary({ run }: { run: Run }) {
  return <div className="run-summary"><div className="run-status"><Badge variant="outline">{run.trace.status}</Badge><span>{run.summary}</span></div><dl>{run.trace.metrics.map(metric => <div key={metric.id}><dt>{engineRegistry.find(engine => engine.id === run.engineId)?.metrics.find(item => item.id === metric.id)?.label ?? metric.id}</dt><dd>{metric.value} <small>{metric.unit}</small></dd></div>)}</dl><p className="control-hint">{run.trace.status === 'completed' ? 'Totals for the complete computed run' : 'Partial totals from interrupted computation'}, independent of the current playback position. No hardware timing is claimed.</p></div>;
}

export function ComparisonFigure({ id, document, anchorId, state, inputFigureId }: { id: string; document: SourceDocument; anchorId: string; state: ExperimentState; inputFigureId: string }) {
  const specification = useMemo(() => {
    try { return { figure: createComparisonFigure(document, id, anchorId, state), error: null }; }
    catch (error) { return { figure: null, error: error instanceof Error ? error.message : 'These methods cannot be compared.' }; }
  }, [document, anchorId, id, state]);
  const execution = useEngineComparison(specification.figure ? { kind: 'comparison', engineIds: specification.figure.runs.map(run => run.binding.engineId), input: state.input, options: { seed: state.seed, parameters: state.parameters } } : null);
  const computed = { figure: specification.figure, comparison: execution.comparison, error: specification.error ?? execution.error };
  const maxLength = Math.max(1, ...(computed.comparison?.runs.map(run => run.trace.steps.length) ?? []));
  const session = useReadingSession();
  const saved = session?.ready ? session.state.figures.find(item => item.snapshot.figure.id === id) : undefined;
  const playback = usePlayback(maxLength, execution.identity, saved?.stepIndex ?? 0);
  useEffect(() => {
    if (session?.ready && computed.figure && computed.comparison) session.putFigure({ snapshot: figureSnapshot(document, computed.figure, state.seed), stepIndex: playback.index, selection: '' });
  }, [computed.figure, computed.comparison, playback.index, session?.ready]);
  return <section id={id} tabIndex={-1} className="paperplay-figure comparison-figure" aria-labelledby={`${id}-title`}>
    <div className="added-figure-label"><span className="tiny-dot"/> ADDED BY PAPERPLAY <span>Method comparison</span></div><h3 id={`${id}-title`}>Same input. Two ways to solve it.</h3><p className="experiment-lead">These runs use the same input, seed and operation limit. <a href={`#${inputFigureId}`}>Edit the mechanism figure’s input</a> or use the shared seed controls to recompute both methods.</p>
    <ExecutionStatus execution={execution}/>
    {computed.error ? <p role="alert" className="figure-error">{computed.error} This comparison is unavailable rather than estimated.</p> : computed.comparison && <>
      <div className="comparison-traces">{computed.comparison.runs.map(run => { const index = Math.min(playback.index, run.trace.steps.length - 1); return <div key={run.engineId}><h4>{run.name}</h4><TraceView input={state.input} state={run.trace.steps[index].state} compact/><p className="comparison-step">Step {index + 1}: {run.trace.steps[index].description}</p></div>; })}</div>
      <PlaybackControls playback={playback} length={maxLength} label="comparison"/>
      <p className="control-hint">Playback aligns trace indexes, not equal amounts of computational work. Each method stops at its final state.</p>
      <div className="comparison-table"><table><caption>Measured totals from these runs</caption><thead><tr><th>Method</th>{computed.comparison.commonMetrics.map(metric => <th key={metric.id}>{metric.label}<small>{metric.unit}</small></th>)}<th>Status</th></tr></thead><tbody>{computed.comparison.runs.map(run => <tr key={run.engineId}><th scope="row">{run.name}</th>{computed.comparison!.commonMetrics.map(metric => <td key={metric.id}>{run.trace.metrics.find(item => item.id === metric.id)?.value ?? '—'}</td>)}<td>{run.trace.status}</td></tr>)}</tbody></table></div>
    </>}
    {computed.figure && <><FidelityNote figure={computed.figure}/><div className="figure-tools"><ContextualQuestion source={document} blockId={document.anchors.find(item => item.id === anchorId)!.blockId} figure={computed.figure} seed={state.seed} stepIndex={playback.index}/><ExperimentActions source={document} snapshot={figureSnapshot(document, computed.figure, state.seed)}/></div></>}<SourceReturn document={document} anchorId={anchorId}/>
  </section>;
}

export function WalkthroughFigure({ id, document, anchorId, family }: { id: string; document: SourceDocument; anchorId: string; family: ExperimentState['input']['kind'] }) {
  const session = useReadingSession();
  const saved = session?.ready ? session.state.figures.find(item => item.snapshot.figure.id === id) : undefined;
  const [selected, setSelected] = useState(saved?.stepIndex ?? 0);
  let figure: Extract<FigureSpecification, { kind: 'steps' }>;
  try { figure = createWalkthroughFigure(document, id, anchorId, family); }
  catch { return <p role="alert" className="figure-error">A source anchor for this walkthrough is unavailable. No explanation has been attached to a different passage.</p>; }
  const steps = figure.steps;
  const select = (index: number) => { setSelected(index); session?.putFigure({ snapshot: figureSnapshot(document, figure), stepIndex: index, selection: '' }); };
  const selectedStep = Math.min(selected, steps.length - 1);
  return <section id={id} tabIndex={-1} className="paperplay-figure" aria-labelledby={`${id}-title`}><div className="added-figure-label"><span className="tiny-dot"/> ADDED BY PAPERPLAY <span>Conceptual walkthrough</span></div><h3 id={`${id}-title`}>Read the idea one step at a time.</h3><ol className="walkthrough-tabs">{steps.map((step, index) => <li key={step.label}><Button variant={index === selectedStep ? 'secondary' : 'ghost'} aria-pressed={index === selectedStep} onClick={() => select(index)}><span>{index + 1}</span>{step.label}</Button></li>)}</ol><div className="walkthrough-detail" aria-live="polite"><h4>{steps[selectedStep].label}</h4><p>{steps[selectedStep].detail}</p></div><FidelityNote figure={figure}/><div className="figure-tools"><ContextualQuestion source={document} blockId={document.anchors.find(item => item.id === anchorId)!.blockId} figure={figure} stepIndex={selectedStep}/><ExperimentActions source={document} snapshot={figureSnapshot(document, figure)}/></div><SourceReturn document={document} anchorId={anchorId}/></section>;
}

export function SourceReturn({ document, anchorId }: { document: SourceDocument; anchorId: string }) {
  const anchor = document.anchors.find(item => item.id === anchorId);
  if (!anchor) return <p className="figure-error">Source anchor unavailable.</p>;
  return <a className="return-to-source" href={`#source-${document.id}-${anchor.blockId}`} onClick={() => requestAnimationFrame(() => window.document.getElementById(`source-${document.id}-${anchor.blockId}`)?.focus())}><ArrowUp size={13}/>Return to source · {document.extractionWarnings.some(warning => /logical HTML/i.test(warning)) ? 'HTML section' : `page ${anchor.page}`}</a>;
}

function ExecutionStatus({ execution }: { execution: { status: string; error: string | null; cancel: () => void; restart: () => void } }) {
  return execution.status === 'running' ? <div className="execution-status" role="status">Computing in a background worker… <Button variant="outline" size="sm" onClick={execution.cancel}>Cancel computation</Button></div> : execution.status === 'cancelled' ? <div className="execution-status" role="status">Computation cancelled. The source and input are retained. <Button variant="outline" size="sm" onClick={execution.restart}>Recompute</Button></div> : null;
}
