/** Opt-in held-out evaluation. No source body, job capability or API key is printed. */
import nextEnv from '@next/env';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolveArxiv } from '../lib/import/arxiv';
import { extractPdfWithLibrary } from '../lib/import/pdf-core';
import { normalizeSource, NORMALIZER_VERSION } from '../lib/import/normalize';
import { ANALYSIS_CATALOG, ANALYSIS_INSTRUCTIONS, compileAnalysisPlan, prepareAnalysisContext } from '../lib/analysis';
import { createMetaAnalysisProvider, analysisJsonSchema, safeProviderError, type ProviderResponse } from '../server/analysis/provider';
import { readMetaConfig } from '../server/meta/config';
import { getUsageStore } from '../server/usage/service';
import type { SourceDocument } from '../shared/schema';
import { runEngine, engineRegistry } from '../lib/engines';
import { ANALYSIS_PIPELINE_VERSION } from '../shared/import-types';

nextEnv.loadEnvConfig(process.cwd());
const live = process.argv.includes('--live');
const excerpt = process.argv.includes('--theta-excerpt');
const runArg = process.argv.find(argument => argument.startsWith('--run='))?.slice(6) ?? 'm4-baseline';
if (!/^[a-zA-Z0-9_-]{1,50}$/.test(runArg)) throw Error('Invalid evaluation run identifier.');
const directory = `.paperplay/evaluation/${runArg}`;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const fingerprint = {
  instructionsSha256: sha(ANALYSIS_INSTRUCTIONS), catalogSha256: sha(JSON.stringify(ANALYSIS_CATALOG)), schemaSha256: sha(JSON.stringify(analysisJsonSchema)),
  sourceFiles: Object.fromEntries(await Promise.all(['lib/analysis.ts','shared/schema.ts','lib/engines/index.ts','lib/import/normalize.ts','lib/import/arxiv.ts','lib/import/pdf-core.ts'].map(async path => [path, sha(await readFile(path, 'utf8'))]))),
};
const reportPath = `docs/evaluation-${runArg}.json`;
let existingReport: { live?: boolean; frozen?: typeof fingerprint } | undefined;
try { existingReport = JSON.parse(await readFile(reportPath, 'utf8')); } catch { /* New run. */ }
if (existingReport && (JSON.stringify(existingReport.frozen) !== JSON.stringify(fingerprint) || existingReport.live && !live)) {
  throw Error('This run already records a different frozen baseline. Choose a new --run identifier; historical evidence will not be overwritten.');
}
const cases = [{ label: 'H1', id: '1401.3843v1' }, { label: 'H2', id: '2504.17327v2' }, { label: 'H3', id: '1706.03762v7' }];
const config = readMetaConfig(process.env);
if (live && !config.apiKey) throw Error('MODEL_API_KEY is required for explicitly live evaluation.');
const provider = live ? createMetaAnalysisProvider(config) : undefined;
const usage = live ? getUsageStore() : undefined;
await mkdir(directory, { recursive: true, mode: 0o700 });
const report: { run: string; checkedAt: string; live: boolean; frozen: typeof fingerprint; model: string; normalizerVersion: string; pipelineVersion: string; engineVersions: Record<string,string>; cases: Array<Record<string, unknown>>; note: string } = {
  run: runArg, checkedAt: new Date().toISOString(), live, frozen: fingerprint, model: config.model, cases: [],
  normalizerVersion: NORMALIZER_VERSION, pipelineVersion: ANALYSIS_PIPELINE_VERSION, engineVersions: Object.fromEntries(engineRegistry.map(engine => [engine.id, engine.version])),
  note: 'Developer self-review only; no participant study. Baseline preserves full-source rejection. Optional Theta excerpt is a separately declared diagnostic, not full-paper success.',
};
async function saveReport() { await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
async function load(id: string): Promise<SourceDocument> {
  const payload = await resolveArxiv(id);
  if (payload.kind === 'html') return payload.source;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const result = await extractPdfWithLibrary(new Blob([Buffer.from(payload.pdfBase64, 'base64')]), { name: `${id}.pdf`, sourceUrl: payload.originalUrl }, pdfjs,
    { cMapUrl: `${process.cwd()}/node_modules/pdfjs-dist/cmaps/`, standardFontDataUrl: `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`, wasmUrl: `${process.cwd()}/node_modules/pdfjs-dist/wasm/` });
  return result.source;
}
async function evaluate(label: string, id: string, source: SourceDocument, diagnostic = false) {
  const item: Record<string, unknown> = { label, arxivId: id, diagnostic, sourceId: source.id, sourceVersion: source.sourceVersion, title: source.title,
    sourceUrl: source.source.url, physicalPageCount: source.source.url?.includes('/html/') ? null : source.pageCount,
    blockCount: source.blocks.length, equationCount: source.blocks.filter(block => block.kind === 'equation').length,
    originalFigureReferences: source.blocks.filter(block => block.kind === 'original-figure').length, extractionWarnings: source.extractionWarnings };
  report.cases.push(item);
  let context;
  try { context = prepareAnalysisContext(source); item.contextCharacters = context.characters; }
  catch (error) { item.status = 'context-rejected'; item.error = error instanceof Error ? error.message : 'Context rejected.'; await saveReport(); return; }
  if (!live || !provider || !usage) { item.status = 'prepared-no-model-request'; await saveReport(); return; }
  const checkpointPath = `${directory}/${label}.json`;
  type Checkpoint = { stage: 'submitting' | 'accepted' | 'terminal' | 'uncertain'; sourceVersion: string; frozen: typeof fingerprint; responseId?: string; response?: ProviderResponse };
  let checkpoint: Checkpoint | undefined;
  try { checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')) as Checkpoint; } catch { /* First run has no checkpoint. */ }
  if (checkpoint && (checkpoint.sourceVersion !== source.sourceVersion || JSON.stringify(checkpoint.frozen) !== JSON.stringify(fingerprint))) throw Error('Existing checkpoint belongs to a changed source/catalog. Choose a new explicit run instead of resubmitting silently.');
  if (checkpoint && !checkpoint.responseId) { item.status = 'uncertain-no-retry'; await saveReport(); return; }
  const started = Date.now();
  const usageId = sha(`${runArg}:${label}:${source.sourceVersion}`);
  let response = checkpoint?.response;
  const storeCheckpoint = async () => writeFile(checkpointPath, JSON.stringify(checkpoint), { mode: 0o600 });
  try {
    if (!checkpoint) {
      const reservation = await usage.reserve({ id: usageId, sessionId: 'operator-heldout-evaluation', kind: 'analysis', maxOutputTokens: 6000, inputCharacters: context.characters, model: config.model, fingerprint: sha(context.text) });
      if (!reservation.created) throw Error('This evaluation was already reserved; no replacement analysis will be sent.');
      checkpoint = { stage: 'submitting', sourceVersion: source.sourceVersion, frozen: fingerprint }; await storeCheckpoint();
      response = await provider.start(source);
      checkpoint.stage = 'accepted'; checkpoint.responseId = response.id; checkpoint.response = response; await storeCheckpoint();
      await usage.settle(usageId, { status: 'accepted', providerId: response.id });
    }
    for (let polls = 0; polls < 120 && (!response?.status || ['queued','in_progress'].includes(response.status)); polls++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); response = await provider.retrieve(checkpoint!.responseId!);
      checkpoint!.response = response; await storeCheckpoint();
    }
    item.elapsedMs = Date.now() - started;
    if (!response || response.status !== 'completed') {
      item.status = response?.status ?? 'pending';
      await usage.settle(usageId, { status: response?.status === 'cancelled' ? 'cancelled' : response?.status === 'incomplete' ? 'incomplete' : response?.status === 'failed' ? 'failed' : 'uncertain', providerId: checkpoint!.responseId });
      await saveReport(); return;
    }
    const measured = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, totalTokens: response.usage.total_tokens } : undefined;
    item.usage = measured ?? null;
    try {
      const result = compileAnalysisPlan(JSON.parse(response.output_text ?? ''), source, config.model, measured);
      const proposed = JSON.parse(response.output_text ?? '{}') as { figures?: unknown[] };
      item.status = 'completed-validated'; item.proposedFigures = proposed.figures?.length ?? 0; item.acceptedFigures = result.figures.length; item.validationWarnings = result.warnings;
      item.figures = result.figures.map(entry => {
        const figure = entry.figure;
        const runs = figure.kind === 'comparison' ? figure.runs.map(run => run.binding) : figure.kind !== 'steps' && figure.execution.mode === 'computed' ? [figure.execution.binding] : [];
        return { id: figure.id, title: figure.title, kind: figure.kind, sourcePage: entry.sourcePage,
          sourceBlockId: result.document.anchors.find(anchor => anchor.id === figure.sourceAnchorIds[0])?.blockId, quoteSha256: sha(entry.sourceQuote),
          execution: runs.length ? 'computed-synthetic' : 'illustrative',
          runs: runs.map(binding => { const run = runEngine(binding.engineId, (figure as Exclude<typeof figure,{kind:'steps'}>).input, { parameters: binding.parameters, operationLimit: 10000 }); return { engineId: binding.engineId, engineVersion: binding.engineVersion, status: run.trace.status, metrics: run.trace.metrics, result: run.result }; }) };
      });
      await usage.settle(usageId, { status: 'completed', providerId: response.id, usage: measured });
    } catch (error) {
      item.status = 'validation-failed'; item.error = error instanceof Error ? error.message : 'Generated output rejected.';
      await usage.settle(usageId, { status: 'validation_failed', providerId: response.id, usage: measured });
    }
    checkpoint!.stage = 'terminal'; await storeCheckpoint();
  } catch (error) {
    item.elapsedMs = Date.now() - started; const safe = safeProviderError(error, !checkpoint?.responseId);
    item.status = 'provider-or-reporting-failed'; item.error = safe.message;
    if (checkpoint && !checkpoint.responseId) { checkpoint.stage = 'uncertain'; await storeCheckpoint(); }
  }
  await saveReport();
}
for (const entry of cases) {
  try { const source = await load(entry.id); await evaluate(entry.label, entry.id, source);
    if (entry.label === 'H1' && excerpt) {
      const selected = await normalizeSource({ kind: 'pdf', title: `${source.title} — explicit first-three-page evaluation excerpt`, authors: source.authors,
        url: source.source.url, pageCount: source.pageCount, blocks: source.blocks.filter(block => block.page <= 3),
        warnings: [...source.extractionWarnings, 'Evaluation diagnostic explicitly selects physical PDF pages 1–3; all other pages are excluded, not claimed normalized.'], identity: `${source.sourceVersion}:first-three-pages` });
      await evaluate('H1-excerpt', entry.id, selected, true);
    }
  } catch (error) { report.cases.push({ label: entry.label, arxivId: entry.id, status: 'ingestion-failed', error: error instanceof Error ? error.message : 'Source unavailable.' }); await saveReport(); }
  console.log(JSON.stringify({ completedCase: entry.label, status: report.cases.find(item => item.label === entry.label)?.status }));
}
console.log(JSON.stringify({ report: `docs/evaluation-${runArg}.json`, live, cases: report.cases.length }));
usage?.close?.();
