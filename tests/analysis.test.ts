import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAnalysisPlan, prepareAnalysisContext, sourceFingerprint, validateAnalysisResult, type GeneratedPlan } from '../lib/analysis';
import { analysisSource, analysisPlan } from './analysis-fixtures';

test('grounded model plan adds figures and anchors without rewriting source content', () => {
  const source = analysisSource(); const before = structuredClone(source);
  const result = compileAnalysisPlan(analysisPlan(source), source, 'test-model');
  assert.deepEqual(source, before);
  assert.deepEqual(result.document.blocks, source.blocks);
  assert.equal(result.figures[0].figure.kind, 'graph');
  assert.equal(result.document.anchors.length, 2);
  assert.equal(validateAnalysisResult(result, source).model, 'test-model');
});

test('wrong pages, absent quotations, untrusted fields and executable markup cannot activate figures', () => {
  const source = analysisSource();
  for (const edit of [
    (p: GeneratedPlan) => { p.figures[0].sourcePage = 2; },
    (p: GeneratedPlan) => { p.figures[0].sourceQuote = 'A fabricated quote from a different source.'; },
    (p: GeneratedPlan) => { p.figures[0].explanation = '<script>execute()</script>'; },
  ]) { const plan = analysisPlan(source); edit(plan); assert.throws(() => compileAnalysisPlan(plan, source, 'test')); }
  assert.throws(() => compileAnalysisPlan({ ...analysisPlan(source), fidelity: 'experiment-reproduction' }, source, 'test'));
  const result = compileAnalysisPlan(analysisPlan(source), source, 'test'); result.document.blocks[0] = { ...result.document.blocks[0], kind: 'paragraph', text: (source.blocks[0] as { text: string }).text + ' Replacement source text.' };
  assert.throws(() => validateAnalysisResult(result, source), /rewrite/);
});

test('a known engine cannot silently substitute for an unsupported new method', () => {
  const source = analysisSource('Theta*'); const plan = analysisPlan(source);
  const result = compileAnalysisPlan(plan, source, 'test');
  assert.equal(result.figures[0].figure.kind, 'steps');
  assert.match(result.warnings[0], /conceptual fallback/);
  assert.match(result.figures[0].figure.caption, /not the paper/);
});

test('incompatible comparison groups degrade to an explicitly conceptual figure', () => {
  const source = analysisSource(); const plan = analysisPlan(source);
  plan.figures[0].kind = 'comparison'; plan.figures[0].baselineEngineId = 'powersort';
  assert.equal(compileAnalysisPlan(plan, source, 'test').figures[0].figure.kind, 'steps');
});

test('context limits and deterministic identity prevent silent truncation or stale source reuse', async () => {
  const source = analysisSource();
  assert.ok(prepareAnalysisContext(source).characters > 200);
  assert.equal(await sourceFingerprint(source), await sourceFingerprint(structuredClone(source)));
  const changed = structuredClone(source); changed.title = 'Changed source';
  assert.notEqual(await sourceFingerprint(source), await sourceFingerprint(changed));
  const oversized = structuredClone(source);
  oversized.blocks = Array.from({ length: 5 }, (_, i) => ({ kind: 'paragraph' as const, id: `p${i}`, page: 1, text: 'x'.repeat(16_000) }));
  oversized.anchors = [];
  assert.throws(() => prepareAnalysisContext(oversized), /70,000/);
});


test('a conceptual fallback cannot promise an unavailable cell editor or slider', () => {
  const source = analysisSource(); const plan = analysisPlan(source);
  plan.figures[0].kind = 'steps'; plan.figures[0].engineId = 'none';
  plan.figures[0].steps[0].detail = 'Reader can toggle blocked cells to run a new search.';
  assert.throws(() => compileAnalysisPlan(plan, source, 'test'), /no source-grounded usable figures/);
});
