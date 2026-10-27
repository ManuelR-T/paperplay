/** Repeatable validation seam comparison; this is not a browser FPS or research benchmark. */
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { extractPdfWithLibrary } from '../lib/import/pdf-core';
import { prepareWidgetSource, validateWidgetEnvelope, WIDGET_KINDS } from '../shared/widgets';
import { createWidgetForSource } from '../lib/widgets/presets';
import { computeWidget } from '../lib/widgets/compute';

const file = process.argv[2] ?? 'public/papers/adaptive-mergesort.pdf';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { source } = await extractPdfWithLibrary(new Blob([await readFile(file)]), { name: file.split('/').at(-1) }, pdfjs);
const widgets = Array.from({ length: 24 }, (_, i) => ({ ...createWidgetForSource('diagram', source), id: `validation-${i}` }));
const start = performance.now();
const trusted = prepareWidgetSource(source);
const prepareMs = performance.now() - start;
function sample(doc: typeof source) {
  const values = [];
  for (let n = 0; n < 7; n++) {
    const begin = performance.now();
    for (const widget of widgets) validateWidgetEnvelope(widget, doc);
    values.push(performance.now() - begin);
  }
  return values;
}
const beforeMs = sample(source), afterMs = sample(trusted);
const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
const transfers = WIDGET_KINDS.map(kind => {
  const envelope = createWidgetForSource(kind, source);
  return { kind, inputBytes: new TextEncoder().encode(JSON.stringify(envelope.spec)).length,
    resultBytes: new TextEncoder().encode(JSON.stringify(computeWidget(envelope.spec, envelope.seed))).length };
});
const report = { checkedAt: new Date().toISOString(), scope: 'Node validation seam before/after immutable source preparation; seven batches of 24 widgets each. No whole-UI or hardware-speedup claim.',
  environment: { node: process.version, platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length },
  source: { file: file.split('/').at(-1), version: source.sourceVersion, blocks: source.blocks.length, bytes: new TextEncoder().encode(JSON.stringify(source)).length },
  prepareMs, beforeMs, afterMs, beforeMedianMs: median(beforeMs), afterMedianMs: median(afterMs), transfers,
  budget: { maxInputBytes: 128 * 1024, maxResultBytes: 2 * 1024 * 1024, maxRunMs: 15000 },
  safety: 'Only privately marked, deeply frozen validated copies bypass repeated document cloning. Mutable foreign source objects always pass full source validation.' };
await writeFile('docs/widget-validation-performance.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
