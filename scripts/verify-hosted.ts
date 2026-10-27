/** Owner-only release smoke check. Reads private authentication from stdin; never prints it. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { preparedPapers } from '../data/papers';
import { snapshotFromPrepared } from '../lib/reading-state';
import { createPreparedExperiment } from '../lib/prepared-figures';
import { validateAnalysisResult } from '../lib/analysis';
import { extractPdfWithLibrary } from '../lib/import/pdf-core';
import type { AnalysisReply } from '../shared/import-types';

if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for private hosted smoke configuration on stdin (input is hidden).');
const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
const line = await new Promise<string>(resolve => reader.once('line', resolve)); reader.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false);
const config = JSON.parse(line) as { origin: string; bypass: string; phase: 'quota' | 'live' | 'retrieve' };
const origin = new URL(config.origin).origin;
if (!origin.endsWith('.chatgpt.site') || !config.bypass || !['quota','live','retrieve'].includes(config.phase)) throw Error('Use the selected Site and owner credential.');
let cookie = '';
async function call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const result = await fetch(origin + path, { method, redirect: 'manual', signal: AbortSignal.timeout(45_000), headers: { 'OAI-Sites-Authorization': `Bearer ${config.bypass}`, ...(body ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const session = result.headers.get('set-cookie')?.split(';')[0]; if (session?.startsWith('paperplay_session=')) cookie = session;
  return result;
}
const healthResponse = await call('/api/health');
if (!healthResponse.ok) throw Error(`Hosted health failed (${healthResponse.status}).`);
const health = await healthResponse.json();
if (health.hosting?.quotaStore !== 'd1') throw Error('Hosted shared D1 binding was not reported.');
const home = await call('/'); const worker = await call('/engine.worker.mjs');
if (!home.ok || !worker.ok || !(await worker.text()).includes('postMessage')) throw Error('Hosted frontend or executable worker asset failed.');
if (config.phase === 'quota') {
  const source = preparedPapers[0].document;
  const analysis = await call('/api/analysis/start', { source, requestId: 'hosted-quota-analysis-' + crypto.randomUUID() });
  const question = await call('/api/questions', { context: { source, blockId: source.anchors[0].blockId }, question: 'Explain this selected passage.', requestId: 'hosted-quota-question-' + crypto.randomUUID() });
  if (analysis.status !== 429 || question.status !== 429) throw Error(`Expected shared quota denials; got ${analysis.status}/${question.status}.`);
  const created = await call('/api/short-links', { snapshot: snapshotFromPrepared(preparedPapers[0], createPreparedExperiment(preparedPapers[0])) });
  if (created.status !== 201) throw Error(`Hosted public snapshot creation failed (${created.status}).`);
  const link = await created.json(); const opened = await call(link.path);
  const removed = await call('/api/short-links', { id: link.id, deleteToken: link.deleteToken }, 'DELETE');
  const afterDelete = await call(link.path);
  if (opened.status !== 302 || removed.status !== 200 || afterDelete.status !== 410) throw Error('Hosted snapshot lifecycle failed.');
  const report = { checkedAt: new Date().toISOString(), origin, phase: 'quota', health, frontend: home.status, engineWorker: worker.status, quota: { analysis: analysis.status, question: question.status, newPaidRequests: 0 }, shortLink: { create: created.status, resolve: opened.status, remove: removed.status, afterDelete: afterDelete.status } };
  await writeFile('docs/hosted-quota-smoke.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} else {
  await mkdir('.paperplay', { recursive: true, mode: 0o700 });
  const path = '.paperplay/hosted-live-checkpoint.json';
  let state: { source: typeof preparedPapers[number]['document']; reply: AnalysisReply; cookie: string; requestId: string };
  try { state = JSON.parse(await readFile(path, 'utf8')); cookie = state.cookie; }
  catch {
    if (config.phase === 'retrieve') throw Error('Retrieval requires an existing private checkpoint; no analysis was submitted.');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = await readFile('public/papers/priority-search-trees.pdf');
    const { source } = await extractPdfWithLibrary(new Blob([bytes], { type: 'application/pdf' }), { name: 'priority-search-trees.pdf' }, pdfjs);
    const requestId = crypto.randomUUID();
    // Persist an uncertain sending checkpoint before starting a possible paid job.
    await writeFile(path, JSON.stringify({ source, cookie, requestId, reply: { status: 'analyzing' } }), { mode: 0o600 });
    const started = await call('/api/analysis/start', { source, requestId });
    const reply = await started.json();
    if (!started.ok) throw Error(`Hosted creation failed (${started.status}): ${reply.error ?? 'No valid response.'}`);
    state = { source, cookie, requestId, reply }; await writeFile(path, JSON.stringify(state), { mode: 0o600 });
  }
  if (!state.reply.job && state.reply.status !== 'complete') throw Error('Submission outcome is uncertain; no automatic replacement analysis will be sent.');
  if (config.phase === 'retrieve') {
    if (!state.reply.job) throw Error('The checkpoint has no retained job capability.');
    const response = await call('/api/analysis/status', { source: state.source, job: state.reply.job });
    if (!response.ok) throw Error(`Saved hosted retrieval failed (${response.status}).`);
    state.reply = await response.json();
  }
  for (let attempt = 0; attempt < 90 && ['queued','analyzing'].includes(state.reply.status); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = await call('/api/analysis/status', { source: state.source, job: state.reply.job });
    const reply = await status.json(); if (!status.ok) throw Error(`Hosted retrieval failed (${status.status}). Existing checkpoint retained.`);
    state.reply = reply; state.cookie = cookie; await writeFile(path, JSON.stringify(state), { mode: 0o600 });
  }
  if (state.reply.status !== 'complete') throw Error(`Hosted analysis ended ${state.reply.status}; private checkpoint retained.`);
  const result = validateAnalysisResult(state.reply.result, state.source);
  const report = { checkedAt: new Date().toISOString(), origin, phase: config.phase, health, source: { id: state.source.id, version: state.source.sourceVersion, pages: state.source.pageCount, blocks: state.source.blocks.length }, model: result.model, usage: result.usage ?? null, figures: result.figures.map(item => ({ id: item.figure.id, title: item.figure.title, kind: item.figure.kind, sourcePage: item.sourcePage })), warnings: result.warnings, sourceBlocksPreserved: JSON.stringify(result.document.blocks) === JSON.stringify(state.source.blocks), newPaidRequests: config.phase === 'retrieve' ? 0 : 1 };
  await writeFile(config.phase === 'retrieve' ? 'docs/hosted-release-smoke.json' : 'docs/hosted-live-smoke.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
