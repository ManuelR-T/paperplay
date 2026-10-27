'use client';

import { useState } from 'react';
import { AlertCircle, Check, FilePlus2, LoaderCircle, PauseCircle, RefreshCw, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { ImportRecord, ImportStage } from '@/shared/import-types';

const stageLabels: Record<ImportStage, string> = {
  extracting: 'Extracting the document', preparing: 'Preparing source passages', ready: 'Source ready to read',
  submitting: 'Submitting to Meta', queued: 'Queued by Meta', analyzing: 'Meta is planning figures',
  validating: 'Checking source links and figures', complete: 'Reading experience ready', cancelled: 'Analysis cancelled',
  failed: 'Analysis needs attention', uncertain: 'Submission outcome unknown', expired: 'Analysis reference expired',
};
const steps = [
  { label: 'Extract source', stages: ['extracting'] },
  { label: 'Prepare passages', stages: ['preparing', 'ready'] },
  { label: 'Analyze with Meta', stages: ['submitting', 'queued', 'analyzing'] },
  { label: 'Validate additions', stages: ['validating'] },
  { label: 'Assemble reading', stages: ['complete'] },
];

type Actions = { importPdf: (file: File) => Promise<void>; importArxiv: (input: string) => Promise<void> };
export function ImportDialog({ open, onOpenChange, busy, ...actions }: Actions & { open: boolean; onOpenChange: (value: boolean) => void; busy: boolean }) {
  const [mode, setMode] = useState<'pdf' | 'arxiv'>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [arxiv, setArxiv] = useState('');
  const [error, setError] = useState('');
  function submit() {
    setError('');
    if (mode === 'pdf') {
      if (!file) { setError('Choose a PDF to import.'); return; }
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') { setError('Choose a PDF file.'); return; }
      if (file.size > 10 * 1024 * 1024) { setError('Choose a PDF smaller than 10 MB.'); return; }
      onOpenChange(false);
      void actions.importPdf(file).catch(() => {});
    } else {
      if (!arxiv.trim()) { setError('Enter an arXiv link or identifier.'); return; }
      onOpenChange(false);
      void actions.importArxiv(arxiv.trim()).catch(() => {});
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="import-dialog">
    <div className="dialog-heading"><span className="dialog-icon"><FilePlus2 size={22}/></span></div>
    <DialogTitle>Add a research paper</DialogTitle>
    <DialogDescription>Keep the paper in view while Meta proposes source-linked interactive figures.</DialogDescription>
    <div className="import-mode" role="group" aria-label="Document source">
      <Button variant={mode === 'pdf' ? 'secondary' : 'outline'} aria-pressed={mode === 'pdf'} onClick={() => { setMode('pdf'); setError(''); }}>PDF file</Button>
      <Button variant={mode === 'arxiv' ? 'secondary' : 'outline'} aria-pressed={mode === 'arxiv'} onClick={() => { setMode('arxiv'); setError(''); }}>arXiv link</Button>
    </div>
    {mode === 'pdf' ? <label className="import-field">Research PDF<input aria-label="Research PDF" type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] ?? null)}/><span>Text-based PDF · up to 10 MB. Scanned documents need a text transcription.</span></label> : <label className="import-field">arXiv link or identifier<input aria-label="arXiv link or identifier" type="text" placeholder="https://arxiv.org/abs/1805.04154" value={arxiv} onChange={event => setArxiv(event.target.value)} autoComplete="off"/><span>Paperplay tries the structured article first and uses the PDF when needed.</span></label>}
    <p className="import-disclosure">The document is saved in this browser. Relevant extracted text is sent to Meta for analysis. Your original PDF is not uploaded to Meta by this flow.</p>
    <p className="control-hint">Long papers may exceed the current analysis limit. Extraction warnings and unsupported mechanisms are disclosed instead of replaced with guessed content.</p>
    {error && <p role="alert" className="figure-error">{error}</p>}
    <Button className="import-submit" onClick={submit} disabled={busy}><Upload size={17}/>{busy ? 'An import is already running' : 'Import & analyze with Meta'}</Button>
  </DialogContent></Dialog>;
}

export function ImportProgress({ stage, record, busy, error, warning, progress, cancel, resume, analyze }: {
  stage: ImportStage | null; record: ImportRecord | null; busy: boolean; error: string | null; warning: string | null; progress?: { page: number; total: number } | null;
  cancel: () => Promise<void>; resume: (id?: string) => Promise<void>; analyze: (id?: string) => Promise<void>;
}) {
  if (!stage && !error && !warning) return null;
  const currentStep = steps.findIndex(step => stage && (step.stages as string[]).includes(stage));
  const problem = stage === 'failed' || stage === 'uncertain' || stage === 'expired';
  const resumeAllowed = !!record?.job && stage === record.stage && !['complete', 'cancelled', 'expired'].includes(record.stage);
  const analyzeAllowed = record && stage === record.stage && !record.job && ['ready', 'failed', 'cancelled', 'expired'].includes(record.stage);
  return <section className={`import-progress ${problem ? 'needs-attention' : ''}`} aria-labelledby="import-progress-title" aria-live="polite">
    <div className="progress-title"><span>{busy ? <LoaderCircle size={19} className="import-spinner"/> : problem ? <AlertCircle size={19}/> : stage === 'complete' ? <Check size={19}/> : <PauseCircle size={19}/>}</span><div><strong id="import-progress-title">{busy && stage === 'cancelled' ? 'Cancelling the current operation' : stage ? stageLabels[stage] : 'Import information'}</strong>{record && record.stage === stage && <p>{record.source.title}</p>}</div>{stage && <Badge variant="outline">{stage === 'complete' ? 'Saved analysis' : busy ? 'In progress' : problem ? 'Needs attention' : 'Stopped'}</Badge>}</div>
    {currentStep >= 0 && <ol className="import-stages" aria-label="Import stages">{steps.map((step, index) => <li key={step.label} className={index < currentStep || stage === 'complete' ? 'done' : index === currentStep ? 'current' : ''} aria-current={index === currentStep ? 'step' : undefined}><span>{index < currentStep || stage === 'complete' ? <Check size={13}/> : index + 1}</span>{step.label}</li>)}</ol>}
    {stage === 'extracting' && progress && <p>Extracting page {progress.page} of {progress.total}.</p>}
    {stage === 'queued' && <p>Meta accepted this analysis. Waiting does not submit another request.</p>}
    {stage === 'uncertain' && <p>A connection ended before acceptance could be confirmed. Paperplay will not automatically submit another paid analysis. The extracted source remains available below.</p>}
    {(stage === 'cancelled' || stage === 'expired') && <p>{busy ? 'Waiting for cancellation confirmation. ' : ''}{record ? 'The source remains available to read. ' : ''}No new analysis is started automatically.</p>}
    {error && <p role="alert" className="progress-error">{error}</p>}
    {warning && <p role="status" className="progress-warning">{warning}</p>}
    <div className="progress-actions">
      {busy && <Button variant="outline" size="sm" disabled={stage === 'cancelled'} onClick={() => void cancel().catch(() => {})}><X size={15}/>Cancel</Button>}
      {!busy && resumeAllowed && <Button variant="outline" size="sm" onClick={() => void resume(record?.id).catch(() => {})}><RefreshCw size={15}/>Resume existing analysis</Button>}
      {!busy && analyzeAllowed && <Button variant="outline" size="sm" onClick={() => void analyze(record.id).catch(() => {})}>Analyze source with Meta</Button>}
    </div>
  </section>;
}
