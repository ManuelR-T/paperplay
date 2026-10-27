'use client';

import { useEffect, useRef, useState } from 'react';
import { executeInWorker } from '@/lib/execution/client';
import type { ExecutionInput, ExecutionResult, EngineComparison } from '@/lib/execution/protocol';
import type { EngineRun } from '@/lib/engines';

type ExecutionState = { status: 'idle' | 'running' | 'complete' | 'failed' | 'cancelled'; progress: 'starting' | 'running' | null; result: ExecutionResult | null; error: string | null };
const idle: ExecutionState = { status: 'idle', progress: null, result: null, error: null };
export function useEngineExecution(input: ExecutionInput | null) {
  const [state, setState] = useState<ExecutionState>(idle);
  const [revision, setRevision] = useState(0);
  const activeIdentity = useRef('');
  const sequence = useRef(0); const abort = useRef<AbortController | null>(null);
  const identity = input ? JSON.stringify(input) : '';
  useEffect(() => {
    const current = ++sequence.current; activeIdentity.current = identity;
    abort.current?.abort();
    if (!input) { setState(idle); return; }
    const controller = new AbortController(); abort.current = controller;
    setState({ status: 'running', progress: 'starting', result: null, error: null });
    void executeInWorker(input, { signal: controller.signal, onProgress: progress => {
      if (sequence.current === current) setState(value => ({ ...value, progress }));
    } }).then(result => {
      if (sequence.current === current && !controller.signal.aborted) setState({ status: 'complete', progress: null, result, error: null });
    }).catch(error => {
      if (sequence.current !== current) return;
      setState({ status: controller.signal.aborted ? 'cancelled' : 'failed', progress: null, result: null, error: controller.signal.aborted ? null : error instanceof Error ? error.message : 'Background computation failed.' });
    });
    return () => { sequence.current++; controller.abort(); };
  // The versioned serializable input is the complete computation identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, revision]);
  const visible = activeIdentity.current === identity ? state : input ? { ...idle, status: 'running' as const, progress: 'starting' as const } : idle;
  return { ...visible, identity, cancel: () => { sequence.current++; abort.current?.abort(); setState({ status: 'cancelled', progress: null, result: null, error: null }); }, restart: () => setRevision(value => value + 1) };
}
export function useEngineRun(input: Extract<ExecutionInput, { kind: 'run' }> | null) {
  const state = useEngineExecution(input);
  return { ...state, run: state.result?.kind === 'run' ? state.result.run as EngineRun : null };
}
export function useEngineComparison(input: Extract<ExecutionInput, { kind: 'comparison' }> | null) {
  const state = useEngineExecution(input);
  return { ...state, comparison: state.result?.kind === 'comparison' ? state.result.comparison as EngineComparison : null };
}
