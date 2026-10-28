import { ExtractionEvidenceError, validateExtractionEvidenceManifest } from './extraction/model';
import type { ExtractionEvidenceManifest } from '../shared/extraction-evidence';
import { ANALYSIS_PIPELINE_VERSION, type AnalysisReply, type ImportedSource, type ImportRecord, type ImportStage } from '../shared/import-types';
import { prepareAnalysisContext, validateAnalysisResult } from './analysis';
import { type ImportStorage } from './import-storage';

export type ImportControllerState = {
  failureExtraction?:{manifest:ExtractionEvidenceManifest;original:Blob;name:string};
  records: ImportRecord[]; currentId: string | null; stage: ImportStage | null;
  busy: boolean; error: string | null; warning: string | null; progress: { page: number; total: number } | null;
};
export const INITIAL_IMPORT_STATE: ImportControllerState = { records: [], currentId: null, stage: null, busy: false, error: null, warning: null, progress: null };
type SourceOptions = { signal?: AbortSignal; onProgress?: (page: number, total: number) => void };
type Dependencies = {
  storage: ImportStorage;
  extractPdf(file: File, options: SourceOptions): Promise<ImportedSource>;
  importArxiv(input: string, options: SourceOptions): Promise<ImportedSource>;
  fetch?: typeof fetch;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  pollAttempts?: number;
  pollInterval?: number;
  now?: () => number;
  requestId?: () => string;
};
const pendingStages = new Set<ImportStage>(['submitting', 'queued', 'analyzing', 'validating']);
const message = (error: unknown) => error instanceof Error ? error.message : 'The import could not be completed.';
const aborted = (error: unknown) => error instanceof Error && error.name === 'AbortError';
function defaultWait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, milliseconds);
    function stop() { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }
    signal.addEventListener('abort', stop, { once: true });
  });
}

/** Browser orchestration is separate from React so recovery semantics can be exercised directly. */
export class ImportController {
  private state: ImportControllerState = { ...INITIAL_IMPORT_STATE };
  private listeners = new Set<() => void>();
  private generation = 0;
  private lifecycle = 0;
  private disposed = false;
  private activeId: string | null = null;
  private abortController: AbortController | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private readonly dependencies: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ImportControllerState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private now() { return (this.dependencies.now ?? Date.now)(); }
  activate() { this.disposed = false; this.lifecycle++; this.activeId = null; this.update({ busy: false, progress: null }); }
  dispose() { this.disposed = true; this.lifecycle++; this.generation++; this.abortController?.abort(); }
  private record(id?: string) { return this.state.records.find(record => record.id === (id ?? this.state.currentId)); }
  private putMemory(record: ImportRecord) {
    this.update({ records: [record, ...this.state.records.filter(item => item.id !== record.id)] });
  }
  private async enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.writes.catch(() => undefined).then(action);
    this.writes = next;
    return next;
  }
  private async save(record: ImportRecord, required = false): Promise<boolean> {
    this.putMemory(record);
    try { await this.enqueue(() => this.dependencies.storage.put(record)); return true; }
    catch (error) {
      this.update({ warning: message(error) });
      if (required) throw new Error(`Analysis was not started because its recovery checkpoint could not be saved. ${message(error)}`);
      return false;
    }
  }
  private begin(stage: ImportStage, id: string | null) {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.activeId = id;
    const operation = ++this.generation;
    this.update({ busy: true, stage, error: null, progress: null, failureExtraction:undefined });
    return { operation, signal: this.abortController.signal };
  }
  private active(operation: number) { return !this.disposed && operation === this.generation; }
  private finish(operation: number) { if (this.active(operation)) { this.activeId = null; this.update({ busy: false, progress: null }); } }

  select = (id: string) => {
    const record = id ? this.record(id) : undefined;
    this.update({ currentId: record?.id ?? null, error: record?.error ?? null, ...(!this.state.busy ? { stage: record?.stage ?? null } : {}) });
  };

  refresh = async () => {
    const lifecycle = this.lifecycle;
    try {
      await this.writes.catch(() => undefined);
      const records = await this.dependencies.storage.list();
      if (this.disposed || lifecycle !== this.lifecycle) return;
      const recovered = records.map(record => record.stage === 'submitting' && !record.job ? {
        ...record, stage: 'uncertain' as const, updatedAt: this.now(), error: 'The previous submission has no saved response reference. Its outcome is unknown; it will not be retried automatically.',
      } : record);
      for (const record of recovered) if (record.stage === 'uncertain' && records.find(item => item.id === record.id)?.stage === 'submitting') {
        try { await this.enqueue(() => this.dependencies.storage.put(record)); } catch (error) { this.update({ warning: message(error) }); }
      }
      if (this.disposed || lifecycle !== this.lifecycle) return;
      this.update({ records: recovered, warning: this.dependencies.storage.warning ?? this.state.warning });
      const pending = recovered.find(record => record.job && pendingStages.has(record.stage));
      if (pending && !this.state.busy) { this.select(pending.id); void this.resume(pending.id); }
    } catch (error) { if (!this.disposed && lifecycle === this.lifecycle) this.update({ warning: message(error) }); }
  };

  importPdf = async (file: File, options?:{analyze?:boolean}) => this.importSource(config => this.dependencies.extractPdf(file, config),options?.analyze!==false);
  importArxiv = async (input: string, options?:{analyze?:boolean}) => this.importSource(config => this.dependencies.importArxiv(input, config),options?.analyze!==false);
  private async importSource(extract: (options: SourceOptions) => Promise<ImportedSource>,analyzeAfter=true) {
    if (this.state.busy) { this.update({ error: 'Another import or analysis is already running.' }); return; }
    const { operation, signal } = this.begin('extracting', null);
    try {
      const extracted = await extract({ signal, onProgress: (page, total) => { if (this.active(operation)) this.update({ progress: { page, total } }); } });
      if (!this.active(operation)) return;
      this.update({ stage: 'preparing', progress: null });
      const existing = this.record(extracted.source.id);
      // The original source record is immutable input; a generated result has its own anchored document copy.
      if (existing?.source.sourceVersion === extracted.source.sourceVersion && existing.pipelineVersion === ANALYSIS_PIPELINE_VERSION) {
        // A repeat import may refresh extraction without repeating an accepted or uncertain model job.
        if(extracted.extractionEvidence){
          const extractionEvidence=await validateExtractionEvidenceManifest(extracted.extractionEvidence,existing.source);
          if(!this.active(operation))return;
          await this.save({...existing,extractionEvidence,
            ...(extracted.original?{original:extracted.original,originalName:extracted.originalName}:{}),
            ...(extracted.originalUrl?{originalUrl:extracted.originalUrl}:{}),updatedAt:this.now()});
          if(!this.active(operation))return;
        }
        this.select(existing.id);
        if (existing.analysis && existing.stage === 'complete') { this.update({ stage: 'complete' }); return existing.id; }
        if (existing.job || existing.stage === 'uncertain' || existing.stage === 'submitting') {
          this.update({ stage: existing.stage, error: existing.error ?? null });
          if (analyzeAfter && existing.job && pendingStages.has(existing.stage)) { this.finish(operation); await this.resume(existing.id); }
          return existing.id;
        }
      }
      const record: ImportRecord = { ...extracted, id: extracted.source.id, pipelineVersion: ANALYSIS_PIPELINE_VERSION, stage: 'ready', updatedAt: this.now() };
      this.activeId = record.id;
      this.update({ currentId: record.id });
      await this.save(record);
      if (!this.active(operation)) return;
      if(!analyzeAfter){this.update({stage:'ready',error:null});return record.id;}
      // A too-large document stays readable even though analysis preparation is rejected.
      prepareAnalysisContext(record.source);
      this.finish(operation);
      await this.analyze(record.id);
    } catch (error) {
      if (!this.active(operation)) return;
      if(error instanceof ExtractionEvidenceError)this.update({failureExtraction:{manifest:error.extractionEvidence,original:error.original,name:error.originalName}});
      if (aborted(error)) this.update({ stage: 'cancelled' });
      else {
        const record = this.activeId ? this.record(this.activeId) : undefined;
        if (record) await this.save({ ...record, stage: 'ready', error: message(error), updatedAt: this.now() });
        this.update({ stage: record ? 'ready' : 'failed', error: message(error) });
      }
    } finally { this.finish(operation); }
  }

  analyze = async (id?: string) => {
    if (this.state.busy) { this.update({ error: 'Another import or analysis is already running.' }); return; }
    const record = this.record(id);
    if (!record) { this.update({ error: 'Choose an imported document first.' }); return; }
    if (record.analysis && record.stage === 'complete') { this.select(record.id); this.update({ stage: 'complete' }); return; }
    if (record.job && pendingStages.has(record.stage)) { await this.resume(record.id); return; }
    if (record.stage === 'uncertain' || (record.stage === 'submitting' && !record.job)) {
      this.update({ error: 'This submission has an unknown outcome and cannot be automatically repeated. Check the provider account before explicitly starting a new import.' }); return;
    }
    const { operation, signal } = this.begin('preparing', record.id);
    this.update({ currentId: record.id });
    let creationAttempted = false;
    try {
      prepareAnalysisContext(record.source);
      // Both checkpoints must be durable before any paid creation request.
      await this.save({ ...record, stage: 'ready', error: undefined, updatedAt: this.now() }, true);
      const submitting = { ...record, stage: 'submitting' as const, analysis: undefined, job: undefined,
        error: undefined, requestId: (this.dependencies.requestId ?? (() => crypto.randomUUID()))(), updatedAt: this.now() };
      await this.save(submitting, true);
      if (!this.active(operation)) return;
      this.update({ stage: 'submitting' });
      let response: Response;
      try {
        creationAttempted = true;
        response = await (this.dependencies.fetch ?? fetch)('/api/analysis/start', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: record.source, requestId: submitting.requestId }), signal, credentials: 'same-origin' });
      } catch (error) {
        if (!this.active(operation)) return;
        await this.uncertain(submitting, 'The submission response was lost. Meta may have accepted the analysis; no automatic retry will be made.');
        return;
      }
      let body: unknown;
      try { body = await response.json(); }
      catch { await this.uncertain(submitting, 'The submission returned an unreadable response. Its outcome is unknown; no automatic retry will be made.'); return; }
      if (!this.active(operation)) return;
      if (!response.ok) {
        const error = (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') ? body.error : 'Analysis could not be started.';
        const declaredUncertainty = body && typeof body === 'object' && 'uncertain' in body && typeof body.uncertain === 'boolean' ? body.uncertain : undefined;
        if (declaredUncertainty === true || (declaredUncertainty === undefined && response.status >= 500 && response.status !== 503)) {
          await this.uncertain(submitting, error); return;
        }
        await this.save({ ...submitting, stage: 'failed', error, updatedAt: this.now() });
        this.update({ stage: 'failed', error }); return;
      }
      const reply = this.reply(body);
      if (!reply.job && reply.status !== 'complete') { await this.uncertain(submitting, 'Meta accepted a submission without a recoverable job reference. No automatic retry will be made.'); return; }
      const accepted = await this.applyReply(submitting, reply, operation);
      if (accepted?.job && pendingStages.has(accepted.stage)) await this.poll(accepted, operation, signal);
    } catch (error) {
      if (!this.active(operation)) return;
      const latest = this.record(record.id) ?? record;
      const uncertain = creationAttempted && latest.stage === 'submitting' && !latest.job;
      if (uncertain) await this.uncertain(latest, 'Submission handling failed before a response reference was saved. Its outcome is unknown; no automatic retry will be made.');
      else {
        const stage = latest.job ? latest.stage : 'failed';
        await this.save({ ...latest, stage, error: message(error), updatedAt: this.now() });
        this.update({ stage, error: message(error) });
      }
    } finally { this.finish(operation); }
  };

  private async uncertain(record: ImportRecord, error: string) {
    await this.save({ ...record, stage: 'uncertain', error, updatedAt: this.now() });
    this.update({ stage: 'uncertain', error });
  }
  private reply(body: unknown): AnalysisReply {
    if (!body || typeof body !== 'object' || !('status' in body) || !['queued','analyzing','complete','cancelled','failed','expired','incomplete'].includes(String(body.status))) throw new Error('The server returned an invalid analysis state.');
    return body as AnalysisReply;
  }
  private async applyReply(record: ImportRecord, reply: AnalysisReply, operation: number): Promise<ImportRecord | undefined> {
    if (!this.active(operation)) return;
    if (reply.job && (reply.job.sourceId !== record.source.id || reply.job.sourceVersion !== record.source.sourceVersion)) throw new Error('The job response does not belong to this source.');
    const job = reply.job ?? record.job;
    let next: ImportRecord;
    if (reply.status === 'complete') {
      this.update({ stage: 'validating' });
      try {
        const analysis = validateAnalysisResult(reply.result, record.source);
        next = { ...record, job, analysis, stage: 'complete', error: undefined, updatedAt: this.now() };
      } catch {
        next = { ...record, job, analysis: undefined, stage: 'failed', error: 'The generated result failed source/figure validation and was not activated.', updatedAt: this.now() };
      }
    } else {
      const stage: ImportStage = reply.status === 'incomplete' ? 'failed' : reply.status;
      next = { ...record, job, stage, error: reply.error, updatedAt: this.now() };
    }
    await this.save(next);
    if (this.active(operation)) this.update({ stage: next.stage, error: next.error ?? null });
    return next;
  }
  private async poll(initial: ImportRecord, operation: number, signal: AbortSignal) {
    let record = initial;
    const attempts = Math.min(120, Math.max(1, this.dependencies.pollAttempts ?? 120));
    for (let attempt = 0; attempt < attempts && this.active(operation); attempt++) {
      try {
        await (this.dependencies.wait ?? defaultWait)(this.dependencies.pollInterval ?? 2000, signal);
        const response = await (this.dependencies.fetch ?? fetch)('/api/analysis/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: record.source, job: record.job }), credentials: 'same-origin', signal });
        if (!this.active(operation)) return;
        const body = await response.json();
        if (!response.ok) {
          if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 410) {
            await this.applyReply(record, { status: 'expired', error: 'This analysis reference is unavailable or expired. No new analysis was started.' }, operation); return;
          }
          throw new Error(typeof body.error === 'string' ? body.error : 'Status retrieval is temporarily unavailable.');
        }
        const next = await this.applyReply(record, this.reply(body), operation);
        if (!next || !pendingStages.has(next.stage)) return;
        record = next;
      } catch (error) {
        if (!this.active(operation) || aborted(error)) return;
        // Keep the accepted job, not a failed/newly-created replacement.
        const text = `Analysis status is paused: ${message(error)} Use Resume to retrieve the existing job.`;
        await this.save({ ...record, error: text, updatedAt: this.now() });
        this.update({ stage: record.stage, error: text }); return;
      }
    }
    if (this.active(operation)) this.update({ error: 'Analysis is still running. Use Resume to check the existing job; no new request will be created.' });
  }

  resume = async (id?: string) => {
    if (this.state.busy) { this.update({ error: 'Another import or analysis is already running.' }); return; }
    const record = this.record(id);
    if (!record) return;
    if (record.stage === 'complete' && record.analysis) { this.select(record.id); this.update({ stage: 'complete' }); return; }
    if (!record.job) {
      this.update({ error: record.stage === 'uncertain' ? 'The previous submission has no saved reference. Its outcome is unknown and it will not be retried automatically.' : 'There is no accepted analysis to resume.' }); return;
    }
    const { operation, signal } = this.begin(record.stage === 'queued' ? 'queued' : 'analyzing', record.id);
    this.update({ currentId: record.id });
    try { await this.poll(record, operation, signal); }
    finally { this.finish(operation); }
  };

  cancel = async () => this.cancelRecord(this.state.busy ? this.activeId : this.state.currentId);
  private async cancelRecord(id: string | null) {
    const record = id ? this.record(id) : undefined;
    this.abortController?.abort();
    const { operation, signal } = this.begin('cancelled', id);
    try {
      if (record?.job) {
        const response = await (this.dependencies.fetch ?? fetch)('/api/analysis/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: record.source, job: record.job }), credentials: 'same-origin', signal });
        const body = await response.json();
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Cancellation could not be confirmed.');
        await this.applyReply(record, this.reply(body), operation);
      } else if (record && record.stage === 'submitting') {
        await this.uncertain(record, 'Submission was interrupted before a job reference was saved. Meta may still be running it; no automatic retry will be made.');
      } else if (record) {
        await this.save({ ...record, stage: 'cancelled', error: undefined, updatedAt: this.now() });
        this.update({ stage: 'cancelled', error: null });
      } else this.update({ stage: 'cancelled', error: null });
    } catch (error) {
      if (!this.active(operation)) return;
      const text = `Cancellation could not be confirmed. ${message(error)} The saved job reference was retained.`;
      if (record) await this.save({ ...record, error: text, updatedAt: this.now() });
      this.update({ stage: record?.stage ?? 'failed', error: text });
    } finally { this.finish(operation); }
  };

  remove = async (id: string) => {
    let record = this.record(id);
    if (!record) return;
    if (record.job && pendingStages.has(record.stage)) {
      if (this.state.busy && this.activeId !== id) { this.update({ error: 'Finish the current operation before removing another pending analysis.' }); return; }
      await this.cancelRecord(id);
      record = this.record(id);
      if (record && pendingStages.has(record.stage)) { this.update({ error: 'The pending analysis could not be cancelled. Its recovery record was kept.' }); return; }
    }
    if (record?.stage === 'uncertain') this.update({ warning: 'An uncertain provider request may still exist. Removing its local paper does not cancel work without a saved job reference.' });
    try {
      await this.enqueue(() => this.dependencies.storage.remove(id));
      const removedCurrent = this.state.currentId === id;
      this.update({ records: this.state.records.filter(item => item.id !== id), currentId: removedCurrent ? null : this.state.currentId, ...(!this.state.busy && removedCurrent ? { stage: null } : {}), error: null });
    } catch (error) { this.update({ warning: message(error), error: 'The local record was not removed.' }); }
  };
}
