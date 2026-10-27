import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareQuestionContext, questionContextKey, validateQuestionAnswer } from '../lib/questions';
import { sourceFixture, walkthroughFixture } from '../shared/fixtures';
import { preparedPapers } from '../data/papers';
import { createEngineFigure, createPreparedExperiment } from '../lib/prepared-figures';
import { createQuestionHandler } from '../server/questions/handler';
import { createSqliteUsageStore, DEFAULT_USAGE_LIMITS } from '../server/usage/store';
import { readMetaConfig } from '../server/meta/config';
import { AnalysisHttpError } from '../server/analysis/security';

const baseContext = () => ({ source: structuredClone(sourceFixture), blockId: 'array-passage' });
function responseAnswer() { return { answer: 'This is an interpretation of the cited comparison, not an executed experiment.', interpretation: true, citations: [{ blockId: 'array-passage', page: 2, quote: 'Compare the array values' }] }; }

test('question context is restricted to the selected passage and computes current synthetic input itself', () => {
  const paper = preparedPapers[0]; const state = createPreparedExperiment(paper);
  const figure = createEngineFigure(paper.document, 'test-figure', paper.illustrationAnchors.primary, state);
  const blockId = paper.document.anchors.find(anchor => anchor.id === paper.illustrationAnchors.primary)!.blockId;
  const prepared = prepareQuestionContext({ source: paper.document, blockId, figure, seed: 42, stepIndex: 0 });
  assert.equal(prepared.runs[0].status, 'completed');
  assert.equal(prepared.runs[0].selectedStep.index, 0);
  assert.match(prepared.runs[0].metricScope, /complete synthetic/);
  assert.equal(prepared.passages.length, 1);
  assert.equal(figure.kind, 'graph');
  if (figure.kind !== 'graph') return;
  const changed = structuredClone(figure); changed.input.edges.forEach(edge => { edge.weight = 1; });
  const later = prepareQuestionContext({ source: paper.document, blockId, figure: changed, seed: 42, stepIndex: 9_999 });
  assert.notDeepEqual(later.runs[0].finalMetrics, prepared.runs[0].finalMetrics);
  assert.notEqual(later.contextKey, prepared.contextKey);
  assert.equal(later.runs[0].selectedStep.state.kind, 'graph');
  assert.throws(() => prepareQuestionContext({ source: paper.document, blockId, figure, metrics: [{ fabricated: 0 }] }));
});

test('unexecuted walkthroughs and equations are honest contexts, with exact short-equation citations supported', () => {
  const prepared = prepareQuestionContext({ ...baseContext(), figure: walkthroughFixture });
  assert.equal(prepared.runs.length, 0);
  assert.match(prepared.text, /No algorithm has been executed/);
  const equation = prepareQuestionContext({ source: sourceFixture, blockId: 'equation' });
  assert.doesNotThrow(() => validateQuestionAnswer({ answer: 'The selected equation squares x; this is only an interpretation.', interpretation: true,
    citations: [{ blockId: 'equation', page: 2, quote: 'f(x) = x^2' }] }, equation));
});

test('fabricated quotes, other passages, wrong pages, markup and unrelated figure context are rejected', () => {
  const prepared = prepareQuestionContext(baseContext());
  assert.doesNotThrow(() => validateQuestionAnswer(responseAnswer(), prepared));
  for (const edit of [
    (answer: ReturnType<typeof responseAnswer>) => { answer.citations[0].quote = 'A fabricated original claim'; },
    (answer: ReturnType<typeof responseAnswer>) => { answer.citations[0].blockId = 'graph-passage'; },
    (answer: ReturnType<typeof responseAnswer>) => { answer.citations[0].page = 1; },
    (answer: ReturnType<typeof responseAnswer>) => { answer.answer = '<script>bad()</script>'; },
  ]) { const answer = responseAnswer(); edit(answer); assert.throws(() => validateQuestionAnswer(answer, prepared)); }
  assert.throws(() => prepareQuestionContext({ source: sourceFixture, blockId: 'graph-passage', figure: walkthroughFixture }), /does not reference/);
  assert.notEqual(questionContextKey(baseContext()), questionContextKey({ ...baseContext(), blockId: 'equation' }));
});

const origin = 'http://localhost:3000';
function request(body: unknown, cookie?: string, suppliedOrigin = origin) {
  return new Request(origin + '/api/questions', { method: 'POST', headers: { origin: suppliedOrigin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
function fixture(options: { quota?: number; answer?: unknown; failure?: Error; reportingFailure?: boolean } = {}) {
  const usage = createSqliteUsageStore({ path: ':memory:', limits: { ...DEFAULT_USAGE_LIMITS, sessionTenMinuteRequests: options.quota ?? 5 } });
  let calls = 0;
  const handler = createQuestionHandler({ usage: options.reportingFailure ? { ...usage, settle: async () => { throw new Error('Reporting store disconnected'); } } : usage,
    getConfig: () => readMetaConfig({ MODEL_API_KEY: 'private-test-key' }), signingSecret: 'question-test-signing',
    provider: () => async (context, question) => {
      calls++; assert.match(context, /array-passage/); assert.ok(question.length < 1_001);
      if (options.failure) throw options.failure;
      return { id: 'resp_question_fixture', status: 'completed', output_text: JSON.stringify(options.answer ?? responseAnswer()), usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } };
    } });
  return { handler, usage, calls: () => calls, body: { context: baseContext(), question: 'What does this passage mean?', requestId: 'question-request-00001' } };
}

test('contextual answers reserve shared usage before a single provider request and expose measured metadata only', async () => {
  const f = fixture();
  try {
    const response = await f.handler(request(f.body)); assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]; const body = await response.json();
    assert.equal(body.result.usage.totalTokens, 150); assert.equal(body.result.model, 'muse-spark-1.3');
    assert.equal(body.result.contextKey, questionContextKey(f.body.context));
    assert.equal((await f.usage.summary()).byKind.question, 1);
    const duplicate = await f.handler(request(f.body, cookie)); assert.equal(duplicate.status, 409); assert.equal(f.calls(), 1);
    assert.equal(JSON.stringify(body).includes('private-test-key'), false);
    assert.equal(JSON.stringify(await f.usage.summary()).includes('Compare the array'), false);
  } finally { f.usage.close?.(); }
});

test('quota exhaustion, disallowed origins, invalid context and missing configuration fail before new paid work', async () => {
  const f = fixture({ quota: 1 });
  try {
    const accepted = await f.handler(request(f.body)); const cookie = accepted.headers.get('set-cookie')!.split(';')[0];
    const limited = await f.handler(request({ ...f.body, requestId: 'question-request-00002' }, cookie)); assert.equal(limited.status, 429);
    assert.equal((await f.handler(request(f.body, cookie, 'https://attacker.example'))).status, 403);
    assert.equal((await f.handler(request({ ...f.body, context: { ...f.body.context, blockId: 'missing' } }, cookie))).status, 400);
    assert.equal((await f.handler(request({ ...f.body, question: 'x'.repeat(1_001) }, cookie))).status, 400);
    const noKey = createQuestionHandler({ usage: f.usage, getConfig: () => readMetaConfig({}) });
    assert.equal((await noKey(request(f.body))).status, 503);
    assert.equal(f.calls(), 1);
  } finally { f.usage.close?.(); }
});

test('invalid citations are withheld while measured usage remains recorded', async () => {
  const answer = responseAnswer(); answer.citations[0].quote = 'Invented source passage';
  const f = fixture({ answer });
  try {
    const response = await f.handler(request(f.body)); assert.equal(response.status, 502);
    const body = await response.json(); assert.equal(body.result, undefined); assert.match(body.error, /citation/);
    const summary = await f.usage.summary(); assert.equal(summary.byStatus.validation_failed, 1); assert.equal(summary.measured.totalTokens, 150);
  } finally { f.usage.close?.(); }
});

test('ambiguous provider transport is not retried and a confirmed rejection remains distinct', async () => {
  for (const known of [false, true]) {
    const f = fixture({ failure: known ? new AnalysisHttpError(502, 'Access rejected.', false) : new TypeError('private connection detail') });
    try {
      const response = await f.handler(request(f.body)); const body = await response.json();
      assert.equal(body.uncertain, !known); assert.equal(f.calls(), 1);
      assert.equal(JSON.stringify(body).includes('private connection detail'), false);
      const summary = await f.usage.summary(); assert.equal(summary.byStatus[known ? 'rejected' : 'uncertain'], 1);
    } finally { f.usage.close?.(); }
  }
});

test('usage reporting failure preserves the provider uncertainty and conservative reservation', async () => {
  const f = fixture({ reportingFailure: true, failure: new TypeError('Provider connection lost') });
  try {
    const response = await f.handler(request(f.body)); const body = await response.json();
    assert.equal(response.status, 504); assert.equal(body.uncertain, true);
    assert.match(body.error, /uncertain/); assert.equal(f.calls(), 1);
    const summary = await f.usage.summary();
    assert.equal(summary.byStatus.reserved, 1); assert.ok(summary.reservedUnmeasuredTokens > 0);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await f.handler(request(f.body, cookie))).status, 409);
    assert.equal(f.calls(), 1);
  } finally { f.usage.close?.(); }
});

test('a validated paid answer remains available if final usage reporting fails', async () => {
  const f = fixture({ reportingFailure: true });
  try {
    const response = await f.handler(request(f.body)); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.result.answer, responseAnswer().answer);
    assert.equal(body.result.usage.totalTokens, 150); assert.equal(f.calls(), 1);
    const summary = await f.usage.summary();
    assert.equal(summary.byStatus.reserved, 1); assert.equal(summary.measuredRequests, 0);
    assert.ok(summary.accountedTokens > 150, 'uncommitted reporting must retain the conservative reservation');
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await f.handler(request(f.body, cookie))).status, 409);
    assert.equal(f.calls(), 1);
  } finally { f.usage.close?.(); }
});
