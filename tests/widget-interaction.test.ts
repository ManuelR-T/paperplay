import test from 'node:test';
import assert from 'node:assert/strict';
import { histogramBins, parseNumericDraft, widgetGuides } from '../lib/widgets/interaction';
import { WIDGET_KINDS } from '../shared/widgets';
import { filterSavedPapers } from '../lib/explore/saved';
import type { ArxivPaper } from '../shared/explore';

test('numeric drafts preserve incomplete negative, decimal and scientific input until a complete value exists', () => {
  for (const text of ['', '-', '+', '.', '-.', '1e', '1e-', '-.2e+']) assert.equal(parseNumericDraft(text).kind, 'incomplete', text);
  for (const [text, value] of [['-0.25', -.25], ['1e-3', .001], ['.5', .5], ['+2', 2], [' 3. ', 3]] as const) assert.deepEqual(parseNumericDraft(text), { kind: 'valid', value });
});

test('numeric drafts reject non-finite, out-of-bounds and non-integer values without clamping or coercing them', () => {
  for (const text of ['NaN', 'Infinity', '1e999', '0x10', '1,2', '2px']) assert.equal(parseNumericDraft(text).kind, 'invalid');
  assert.equal(parseNumericDraft('0.04', .05, 100).kind, 'invalid');
  assert.deepEqual(parseNumericDraft('0.05', .05, 100), { kind: 'valid', value: .05 });
  assert.equal(parseNumericDraft('2.5', 1, 40, true).kind, 'invalid');
  assert.deepEqual(parseNumericDraft('2', 1, 40, true), { kind: 'valid', value: 2 });
});

test('continuous histograms count every actual draw once, including exact bin boundaries and the maximum', () => {
  const draws = [0, 1, 2, 3, 6, 12, 12];
  const bins = histogramBins(draws);
  assert.equal(bins.length, 12); assert.equal(bins[0].from, 0); assert.equal(bins.at(-1)!.to, 12);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), draws.length);
  assert.equal(bins[0].count, 1); assert.equal(bins[1].count, 1); assert.equal(bins.at(-1)!.count, 2);
});

test('discrete and degenerate samples remain discrete rather than inventing a continuous range', () => {
  assert.deepEqual(histogramBins([1, 0, 1, 1], true), [{ from: 0, to: 0, count: 1 }, { from: 1, to: 1, count: 3 }]);
  assert.deepEqual(histogramBins([4, 4, 4]), [{ from: 4, to: 4, count: 3 }]);
  assert.deepEqual(histogramBins([]), []);
});

test('all catalog widget families have a specific reader action and step label', () => {
  assert.deepEqual(Object.keys(widgetGuides).sort(), [...WIDGET_KINDS].sort());
  assert.equal(widgetGuides.attention.step, 'Query'); assert.equal(widgetGuides.custom.step, 'Frame');
  assert.equal(widgetGuides.signal.step, 'Output');
});

test('saved reading-list search matches words across title and authors, ignores accents, and preserves originals', () => {
  const papers = [{ id: '1706.03762v7', title: 'Attention mechanisms', authors: ['André Researcher'], categories: ['cs.CL'], abstract: 'Language modelling.' }, { id: '1805.04154v1', title: 'Stable sorting', authors: ['B'], categories: ['cs.DS'], abstract: 'Mergesort.' }] as ArxivPaper[];
  const before = structuredClone(papers);
  assert.equal(filterSavedPapers(papers, 'attention andre')[0].id, papers[0].id);
  assert.equal(filterSavedPapers(papers, 'cs.ds').length, 1); assert.equal(filterSavedPapers(papers, 'unmatched').length, 0);
  assert.deepEqual(filterSavedPapers(papers, ''), papers); assert.deepEqual(papers, before);
});
