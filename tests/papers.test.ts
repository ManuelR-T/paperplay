import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { preparedPapers, getPreparedPaper } from '../data/papers';
import provenance from '../data/papers.provenance.json';
import { validateDocument } from '../shared/schema';

const publisherPapers = preparedPapers.filter(paper => paper.pdfUrl.startsWith('/papers/'));

test('two pinned publisher PDF selections retain valid source/page anchors and licensing', () => {
  assert.equal(publisherPapers.length, 2);
  assert.deepEqual(publisherPapers.map(paper => paper.id), ['priority-search-trees', 'adaptive-mergesort']);
  for (const paper of publisherPapers) {
    assert.equal(validateDocument(paper.document).id, paper.id);
    assert.match(paper.sourceUrl, /^https:\/\/doi\.org\/10\.4230\//);
    assert.equal(paper.attribution.license, 'CC BY 3.0 Unported');
    assert.equal(paper.attribution.licenseUrl, 'https://creativecommons.org/licenses/by/3.0/');
    assert.match(paper.coverage, /Selected original passages/);
    assert.ok(paper.document.blocks.filter(block => block.kind === 'paragraph').length >= 12);
    assert.ok(paper.document.blocks.some(block => block.kind === 'equation'));
    assert.ok(paper.document.blocks.some(block => block.kind === 'original-figure'));
    for (const anchorId of Object.values(paper.illustrationAnchors)) {
      assert.ok(paper.document.anchors.find(anchor => anchor.id === anchorId));
    }
    const pages = paper.document.blocks.map(block => block.page);
    assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
  }
  assert.equal(getPreparedPaper('not-a-paper'), undefined);
});

test('source selections keep critical original claims separate from engine capabilities', () => {
  const graph = getPreparedPaper('priority-search-trees')!;
  const sorting = getPreparedPaper('adaptive-mergesort')!;
  const text = (id: string, paper = graph) => {
    const block = paper.document.blocks.find(block => block.id === id);
    assert.ok(block?.kind === 'paragraph');
    return block.text;
  };
  assert.match(text('g-distances-not-paths'), /does not compute actual shortest paths, but only their weights/);
  assert.equal(graph.document.anchors.find(anchor => anchor.id === graph.illustrationAnchors.primary)?.page, 15);
  assert.match(text('s-powersort-mechanism', sorting), /next internal node has a smaller power/);
  assert.match(text('s-runs', sorting), /maximal strictly decreasing region/);
  assert.equal(sorting.document.anchors.find(anchor => anchor.id === sorting.illustrationAnchors.comparison)?.page, 6);
});

test('bundled originals match pinned publisher PDF checksums and figure page references', () => {
  for (const paper of publisherPapers) {
    const pinned = provenance.find(entry => entry.id === paper.id)!;
    assert.equal(pinned.sourceVersion, paper.document.sourceVersion);
    const bytes = readFileSync(`public${paper.pdfUrl}`);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pinned.pdfSha256);
    for (const block of paper.document.blocks) {
      if (block.kind !== 'original-figure') continue;
      assert.equal(new URL(block.sourceUrl!).hash, `#page=${block.page}`);
      assert.match(block.alt, /original|Original/);
    }
  }
});


test('the third real source retains its HTML location semantics and distinct CC license', () => {
  const paper = getPreparedPaper('quadratic-optimization')!;
  assert.equal(validateDocument(paper.document).id, paper.id);
  assert.equal(paper.sourceUrl, 'https://distill.pub/2017/momentum/');
  assert.equal(paper.attribution.license, 'CC BY 2.0');
  assert.match(paper.coverage, /logical HTML/);
  assert.ok(paper.document.blocks.some(block => block.kind === 'equation'));
  assert.ok(paper.document.extractionWarnings.some(warning => /not a physical PDF page/.test(warning)));
  for (const anchor of Object.values(paper.illustrationAnchors)) assert.ok(paper.document.anchors.some(item => item.id === anchor));
});
