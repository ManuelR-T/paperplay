'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { blockText } from '@/lib/analysis';
import { prepareQuestionContext, questionContextKey, questionResultSchema, validateQuestionAnswer, type QuestionContext, type QuestionResult } from '@/lib/questions';

/** All context is explicit, so switching passages or editing inputs invalidates the old answer. */
export function ContextualQuestion(context: QuestionContext) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const key = questionContextKey(context);
  const prepared = useMemo(() => {
    if (!open) return null;
    try { return { value: prepareQuestionContext(context), error: '' }; }
    catch (failure) { return { value: null, error: failure instanceof Error ? failure.message : 'This selection is unavailable.' }; }
  // A source version identifies immutable normalized source content.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);
  useEffect(() => {
    sequence.current++;
    request.current?.abort();
    setResult(null); setError(''); setBusy(false); setQuestion(''); setUncertain(false);
    return () => { sequence.current++; request.current?.abort(); };
  }, [key, open]);
  async function ask() {
    if (!prepared?.value || busy) return;
    if (question.trim().length < 3 || question.trim().length > 1_000) { setError('Ask a question of 3–1,000 characters about this selection.'); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const current = ++sequence.current;
    setBusy(true); setResult(null); setError(''); setUncertain(false);
    try {
      const response = await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: controller.signal,
        body: JSON.stringify({ context, question: question.trim(), requestId: crypto.randomUUID() }) });
      const body = await response.json();
      if (current !== sequence.current) return;
      if (!response.ok) { setUncertain(body.uncertain === true); throw new Error(typeof body.error === 'string' ? body.error : 'The question could not be answered.'); }
      const validated = questionResultSchema.parse(body.result);
      const { model: _model, usage: _usage, contextKey: returnedKey, ...answer } = validated;
      if (returnedKey !== key) throw new Error('The answer belongs to a different selection and was not displayed.');
      validateQuestionAnswer(answer, prepared.value);
      setResult(validated);
    } catch (failure) {
      if (current !== sequence.current || controller.signal.aborted) return;
      if (failure instanceof TypeError) setUncertain(true);
      setError(failure instanceof Error ? failure.message : 'The answer could not be validated.');
    } finally { if (current === sequence.current) setBusy(false); }
  }
  const answer = result?.contextKey === key ? result : null;
  const passage = context.source.blocks.find(block => block.id === context.blockId);
  const htmlSource = context.source.source.url?.includes('/html/') || context.source.extractionWarnings.some(warning => /logical HTML/i.test(warning));
  return <>
    <Button variant="outline" size="sm" className="contextual-question-button" onClick={() => setOpen(true)}><CircleHelp size={16}/>{context.figure ? 'Ask about this figure' : 'Ask about this passage'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="question-dialog">
      <DialogTitle>{context.figure ? 'Understand this figure' : 'Understand this passage'}</DialogTitle>
      <DialogDescription>Ask Meta about this selection. Answers are added interpretations with checked source quotations.</DialogDescription>
      <div className="question-selection"><strong>{context.figure?.title ?? context.source.title}</strong><span>{htmlSource ? 'HTML source reference' : `Source page ${passage?.page ?? 'unavailable'}`}</span>{passage && <blockquote>{blockText(passage).slice(0, 600)}{blockText(passage).length > 600 ? '…' : ''}</blockquote>}
        {prepared?.value && <details><summary>Context used for this question</summary><p>{prepared.value.runs.length ? 'The server recomputes the current synthetic input and parameters. Complete-run totals differ from the displayed step state.' : 'This is a conceptual selection. No computed algorithm result is available.'}</p>{prepared.value.runs.map(run => <p key={run.engineId}>{run.engineId} · seed {run.seed} · parameters {JSON.stringify(run.parameters)} · {run.status} · step {run.selectedStep.index + 1}</p>)}</details>}
      </div>
      {prepared?.error && <p className="figure-error" role="alert">{prepared.error}</p>}
      <label className="question-field">Your question<textarea value={question} maxLength={1_000} rows={3} placeholder="What does this assumption change?" onChange={event => setQuestion(event.target.value)} disabled={busy}/></label>
      <p className="control-hint">Only this selection and its figure context are sent to Meta. Each submitted question is a separate model request. There is no conversation history or automatic retry.</p>
      <Button onClick={() => void ask()} disabled={busy || !prepared?.value}>{busy ? <><LoaderCircle size={16} className="import-spinner"/>Asking Meta…</> : 'Ask Meta'}</Button>
      {error && <p className="figure-error" role="alert">{error}</p>}
      {uncertain && <p className="progress-warning">Meta may have processed the previous question. No retry was made. Clicking Ask Meta again submits a new paid request.</p>}
      {answer && <section className="question-answer" aria-live="polite"><Badge variant="outline">Meta interpretation</Badge><div className="question-answer-text">{answer.answer}</div><ul className="question-citations">{answer.citations.map((citation, index) => <li key={`${citation.blockId}-${index}`}><a href={`#source-${context.source.id}-${citation.blockId}`} onClick={() => { setOpen(false); requestAnimationFrame(() => document.getElementById(`source-${context.source.id}-${citation.blockId}`)?.focus()); }}>{htmlSource ? 'HTML source' : `Source page ${citation.page}`}</a><blockquote>{citation.quote}</blockquote></li>)}</ul><p className="analysis-usage">{answer.model} · {answer.usage ? `Measured usage: ${answer.usage.inputTokens.toLocaleString()} input tokens · ${answer.usage.outputTokens.toLocaleString()} output tokens` : 'Token usage unavailable'}</p><p className="control-hint">A matching quotation confirms its location, not the correctness of the interpretation. Check the paper and the stated engine limitations.</p></section>}
    </DialogContent></Dialog>
  </>;
}
