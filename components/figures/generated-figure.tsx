'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { validateFigure, type ExecutionTrace, type FigureSpecification, type SourceDocument } from '@/shared/schema';
import type { GeneratedFigure } from '@/shared/import-types';
import { engineMetadata, engineRegistry } from '@/lib/engines';
import { ContextualQuestion } from '../contextual-question';
import { ExperimentActions } from '../experiment-actions';
import { figureSnapshot, useReadingSession } from '../reading-session';
import type { BundleAttribution } from '@/lib/snapshots';
import { useEngineExecution } from '../use-engine-execution';
import { NumericView } from './numeric-view';
import { TraceView } from './trace-view';
import { PlaybackControls, usePlayback } from './playback';
import { ScientificValidationOutput } from '../scientific-validation-output';
import { IndependentComparisonRun } from './experiment';

function illustrativeState(figure: Extract<FigureSpecification, { kind: 'graph' | 'array' }>, selected: string): ExecutionTrace['steps'][number]['state'] {
  return figure.kind === 'graph' ? { kind: 'graph', activeNodeIds: selected ? [selected] : [], visitedNodeIds: [], activeEdgeIds: [] }
    : { kind: 'array', values: figure.input.values, activeIndices: selected === '' ? [] : [Number(selected)], originalIndices: figure.input.values.map((_, index) => index) };
}

export function GeneratedFigureView({ entry, source, htmlSource, origin = 'meta', original, originalName, attribution }: { entry: GeneratedFigure; source: SourceDocument; htmlSource: boolean; origin?: 'meta' | 'bundle'; original?: Blob; originalName?: string; attribution?: BundleAttribution }) {
  const session = useReadingSession();
  const saved = session?.ready ? session.state.figures.find(item => item.snapshot.figure.id === entry.figure.id) : undefined;
  const [figure, setFigure] = useState(() => structuredClone(saved?.snapshot.figure ?? entry.figure));
  const seed = saved?.snapshot.seed ?? 42;
  const previousEntry = useRef(entry.figure);
  const [stepIndex, setStepIndex] = useState(saved?.stepIndex ?? 0);
  const [selected, setSelected] = useState(saved?.selection ?? '');
  const [independent,setIndependent]=useState(saved?.selection!=='index');
  const [runPositions,setRunPositions]=useState<number[]>(()=>{try{const x=JSON.parse(saved?.selection?.replace(/^independent:/,'')??'[]');return Array.isArray(x)?x.slice(0,4).map(n=>Number.isInteger(n)&&n>=0&&n<10000?n:0):[];}catch{return[];}});
  const [arrayDraft, setArrayDraft] = useState(figure.kind === 'array' ? figure.input.values.join(', ') : '');
  const [inputError, setInputError] = useState('');
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => { if (previousEntry.current === entry.figure) return; previousEntry.current = entry.figure; setFigure(structuredClone(entry.figure)); setSelected(''); setStepIndex(0); setInputError(''); if (entry.figure.kind === 'array') setArrayDraft(entry.figure.input.values.join(', ')); }, [entry.figure]);
  const specification = useMemo(() => {
    try { return { valid: validateFigure(figure, source, engineRegistry), error: '' }; }
    catch (error) { return { valid: null, error: error instanceof Error ? error.message : 'This figure could not be validated.' }; }
  }, [figure, source]);
  const valid = specification.valid;
  const execution = useEngineExecution(valid && valid.kind !== 'steps' && (valid.kind === 'comparison' || valid.execution.mode === 'computed')
    ? valid.kind === 'comparison' ? { kind: 'comparison', engineIds: valid.runs.map(run => run.binding.engineId), input: valid.input, options: { seed, parametersByEngine: Object.fromEntries(valid.runs.map(run => [run.binding.engineId, run.binding.parameters])) } }
      : valid.execution.mode === 'computed' ? { kind: 'run', engineId: valid.execution.binding.engineId, input: valid.input, options: { seed, parameters: valid.execution.binding.parameters } } : null
    : null);
  const currentRuns=useMemo(()=>execution.result?.kind === 'run' ? [execution.result.run] : execution.result?.kind === 'comparison' ? execution.result.comparison.runs : [],[execution.result]);
  const computed = { valid, error: specification.error || execution.error, runs:currentRuns };
  const length = Math.max(1, ...computed.runs.map(run => run.trace.steps.length));
  const playback = usePlayback(length, execution.identity, saved?.stepIndex ?? 0);
  useEffect(() => {
    if (session?.ready && !computed.error && (figure.kind === 'steps' || figure.kind !== 'comparison' && figure.execution.mode === 'illustrative' || execution.status === 'complete')) session.putFigure({ snapshot: figureSnapshot(source, figure, saved?.snapshot.seed ?? 42), stepIndex: figure.kind === 'steps' ? stepIndex : playback.index, selection: figure.kind==='comparison'?(independent?`independent:${JSON.stringify(runPositions)}`:'index'):selected });
  }, [figure, stepIndex, playback.index, selected, session?.ready, execution.status,independent,runPositions]);
  const anchor = source.anchors.find(item => item.id === figure.sourceAnchorIds[0]);
  const explanatory = figure.kind === 'steps' || figure.kind !== 'comparison' && figure.execution.mode === 'illustrative';
  function reset() { setFigure(structuredClone(entry.figure)); setSelected(''); setInputError(''); setResetVersion(value => value + 1); setStepIndex(0); if (entry.figure.kind === 'array') setArrayDraft(entry.figure.input.values.join(', ')); playback.reset(); }
  function parameter(key: string, value: number) {
    if (!Number.isFinite(value)) return;
    if (figure.kind !== 'steps' && figure.kind !== 'comparison') {
      if (figure.execution.mode !== 'computed') return;
      const binding = { ...figure.execution.binding, parameters: { ...figure.execution.binding.parameters, [key]: value } };
      setFigure({ ...figure, controls: figure.controls.map(control => control.key === key ? { ...control, initial: value } : control), execution: { mode: 'computed', binding } });
    }
  }
  function applyValues() {
    if (figure.kind !== 'array') return;
    const tokens = arrayDraft.trim() ? arrayDraft.split(',') : [];
    const values = tokens.map(value => Number(value.trim()));
    if (values.length > 32 || tokens.some(value => !value.trim()) || values.some(value => !Number.isFinite(value) || Math.abs(value) > 1_000_000)) { setInputError('Enter at most 32 finite comma-separated values between −1,000,000 and 1,000,000.'); return; }
    setFigure({ ...figure, input: { kind: 'array', values } }); setInputError(''); setSelected('');
  }
  const metrics = computed.runs[0]?.trace.metrics.filter(metric => computed.runs.every(run => run.trace.metrics.some(other => other.id === metric.id && other.unit === metric.unit))) ?? [];
  return <section className="paperplay-figure generated-figure" id={figure.id} tabIndex={-1} aria-labelledby={`${figure.id}-title`}>
    <div className="added-figure-label"><span className="tiny-dot"/> ADDED BY PAPERPLAY <span>{origin === 'meta' ? 'Selected with Meta' : 'Imported experiment snapshot'}</span></div>
    <div className="experiment-heading"><h3 id={`${figure.id}-title`}>{figure.title}</h3><Button variant="ghost" size="sm" onClick={reset}><RotateCcw size={15}/>Reset figure</Button></div>
    <p className="control-hint">Available interaction: {figure.kind === 'steps' ? 'navigate the explanatory steps; this figure has no cell, graph or parameter editor.' : figure.kind === 'comparison' ? 'step through the computed comparison; parameter choices are stored with each run.' : figure.execution.mode === 'illustrative' ? 'inspect the supplied synthetic data; no algorithm is executed.' : 'edit the displayed controls and inspect a recomputed synthetic trace.'}</p>
    <p className="generated-explanation">{entry.explanation}</p><p className="control-hint">{figure.caption}</p>
    {figure.assumptions.length > 0 && <details className="generated-assumptions"><summary>Assumptions and simplifications</summary><ul>{figure.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></details>}
    {figure.kind === 'steps' ? <GeneratedSteps key={resetVersion} steps={figure.steps} index={stepIndex} setIndex={setStepIndex}/> : <>
      {figure.kind !== 'comparison' && figure.execution.mode === 'computed' && figure.controls.length > 0 && <div className="experiment-inputs">{figure.controls.map(control => <label key={control.key}>{control.label}<input type="number" min={control.min} max={control.max} step={control.step} value={control.initial} onChange={event => parameter(control.key, Number(event.target.value))}/></label>)}</div>}
      {figure.kind === 'array' && <div className="array-inputs"><label htmlFor={`${figure.id}-values`}>Synthetic input values<input id={`${figure.id}-values`} value={arrayDraft} onChange={event => setArrayDraft(event.target.value)}/></label><Button variant="outline" size="sm" onClick={applyValues}>Apply values</Button></div>}
      {inputError && <p role="alert" className="figure-error">{inputError}</p>}
      {execution.status === 'running' && <div className="execution-status" role="status">Computing in a background worker… <Button variant="outline" size="sm" onClick={execution.cancel}>Cancel computation</Button></div>}
      {execution.status === 'cancelled' && <div className="execution-status" role="status">Computation cancelled. <Button variant="outline" size="sm" onClick={execution.restart}>Recompute</Button></div>}
      {computed.error && <p role="alert" className="figure-error">{computed.error}</p>}
      {!computed.error && (figure.kind === 'graph' || figure.kind === 'array') && figure.execution.mode === 'illustrative' && <>
        <label className="illustration-inspector">{figure.kind === 'graph' ? 'Inspect a node' : 'Inspect a value'}<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Nothing selected</option>{figure.kind === 'graph' ? figure.input.nodes.map(node => <option value={node.id} key={node.id}>{node.label}</option>) : figure.input.values.map((value, index) => <option value={String(index)} key={index}>Index {index}: {value}</option>)}</select></label>
        <div className="trace-surface"><TraceView input={figure.input} state={illustrativeState(figure, selected)} illustrative/></div>
      </>}
      {!computed.error && (figure.kind === 'matrix' || figure.kind === 'plot') && figure.execution.mode === 'illustrative' && <NumericView input={figure.input} mode={figure.kind} illustrative/>}
      {!computed.error && computed.runs.length > 0 && <>
        {computed.runs.length>1&&<label className="control-hint"><input type="checkbox" checked={!independent} onChange={e=>setIndependent(!e.target.checked)}/> Move both by trace index (visual convenience only)</label>}
        <div className={computed.runs.length > 1 ? 'comparison-traces' : 'generated-single-trace'}>{computed.runs.map((run,runIndex) => { if(computed.runs.length>1&&independent)return <IndependentComparisonRun key={run.engineId} run={run} initialIndex={runPositions[runIndex]??saved?.stepIndex??0} onIndex={index=>setRunPositions(old=>{if(old[runIndex]===index)return old;const next=[...old];next[runIndex]=index;return next;})}/>;const step = run.trace.steps[Math.min(playback.index, run.trace.steps.length - 1)]; return <div key={run.engineId}><h4>{run.name}</h4><div className="trace-surface">{run.trace.input.kind === 'matrix' && step.state.kind === 'matrix' ? <NumericView input={run.trace.input} state={step.state} mode={figure.kind === 'plot' ? 'plot' : 'matrix'} history={figure.kind === 'plot' && run.trace.steps.at(-1)?.state.kind === 'matrix' ? (run.trace.steps.at(-1)!.state as Extract<typeof step.state, {kind:'matrix'}>).history : undefined}/> : <TraceView input={run.trace.input} state={step.state} compact={computed.runs.length > 1}/>}</div><p className="comparison-step">{step.description}</p><Badge variant="outline">{run.trace.status}</Badge></div>; })}</div>
        {(computed.runs.length===1||!independent)&&<PlaybackControls playback={playback} length={length} label={`generated ${figure.id}`}/>}
        {computed.runs.length > 1 && <p className="control-hint">{independent?'Each method has independent playback; these engines do not declare equivalent intermediate semantic checkpoints.':'Trace indices are visual convenience, not equal computational work or matching events.'} Each method keeps its own configured parameters.</p>}
        <div className="comparison-table"><table><caption>Actual {computed.runs.some(run => run.trace.status !== 'completed') ? 'partial' : 'complete-run'} totals on synthetic input</caption><thead><tr><th>Method</th>{metrics.map(metric => <th key={metric.id}>{engineRegistry.find(engine => engine.id === computed.runs[0].engineId)?.metrics.find(item => item.id === metric.id)?.label ?? metric.id}<small>{metric.unit}</small></th>)}</tr></thead><tbody>{computed.runs.map(run => <tr key={run.engineId}><th scope="row">{engineMetadata[run.engineId].name}</th>{metrics.map(metric => <td key={metric.id}>{run.trace.metrics.find(item => item.id === metric.id)?.value ?? '—'}</td>)}</tr>)}</tbody></table></div>
      </>}
    </>}
    <div className="fidelity-note"><Badge variant="outline">{explanatory ? 'Illustrative explanation' : 'Illustrative simulation'}</Badge><span>{origin === 'meta' ? 'Model-selected addition' : 'Imported snapshot'} · no original experiment reproduction</span><p className="control-hint">{explanatory ? 'This figure does not execute the paper’s algorithm.' : 'A supported implementation computes these synthetic inputs. Its selection does not verify the paper’s full method or reported results.'}</p></div>
    {!explanatory&&valid&&<ScientificValidationOutput target={{kind:'legacy-engine',source,figure:valid,seed}} output={computed.runs.length?computed.runs:null} unavailable={execution.status!=='complete'?'The current computation must complete before checking.':undefined}/>}
    {figure.kind==='comparison'&&independent&&<p className="control-hint">A figure question needs one shared trace index. <Button variant="outline" onClick={()=>setIndependent(false)}>Use shared index for a contextual question</Button></p>}
    <div className="figure-tools">{anchor && (figure.kind!=='comparison'||!independent) && <ContextualQuestion source={source} blockId={anchor.blockId} figure={figure} seed={saved?.snapshot.seed ?? 42} stepIndex={figure.kind === 'steps' ? stepIndex : playback.index}/>}<ExperimentActions source={source} snapshot={figureSnapshot(source, figure, saved?.snapshot.seed ?? 42)} original={original} originalName={originalName} attribution={attribution}/></div>
    <details className="generated-source-quote"><summary>Quoted source passage</summary><blockquote>{entry.sourceQuote}</blockquote></details>
    {anchor ? <a className="return-to-source" href={`#source-${source.id}-${anchor.blockId}`} onClick={() => requestAnimationFrame(() => document.getElementById(`source-${source.id}-${anchor.blockId}`)?.focus())}><ArrowUp size={14}/>Return to source · {htmlSource ? 'HTML section' : `page ${entry.sourcePage}`}</a> : <p role="alert" className="figure-error">Source anchor unavailable. This addition has not been reassigned to another passage.</p>}
  </section>;
}

function GeneratedSteps({ steps, index: selected, setIndex }: { steps: Extract<FigureSpecification, { kind: 'steps' }>['steps']; index: number; setIndex: (value: number) => void }) {
  const index = Math.min(selected, steps.length - 1);
  return <><ol className="walkthrough-tabs">{steps.map((step, position) => <li key={`${position}-${step.label}`}><Button variant={index === position ? 'secondary' : 'ghost'} aria-pressed={index === position} onClick={() => setIndex(position)}><span>{position + 1}</span>{step.label}</Button></li>)}</ol><div className="walkthrough-detail" aria-live="polite"><h4>{steps[index]?.label}</h4><p>{steps[index]?.detail}</p></div></>;
}
