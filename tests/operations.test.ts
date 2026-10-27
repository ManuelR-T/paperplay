import test from 'node:test';
import assert from 'node:assert/strict';
import { readMetaConfig, publicMetaStatus } from '../server/meta/config';
import { createAnalysisHandlers } from '../server/analysis/handlers';
import { createQuestionHandler } from '../server/questions/handler';
import { createSqliteUsageStore } from '../server/usage/store';
import { analysisSource } from './analysis-fixtures';

const origin = 'http://localhost:3000';
const request = (path: string, body: unknown, cookie?: string) => new Request(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
test('operator disable and an actual cutoff prevent creation without hiding prepared/saved capabilities', () => {
  const disabled = readMetaConfig({ MODEL_API_KEY: 'private-key', META_ANALYSIS_ENABLED: 'false' });
  assert.equal(disabled.inferenceEnabled, false);
  assert.equal(publicMetaStatus(disabled).configured, false);
  assert.ok(!JSON.stringify(publicMetaStatus(disabled)).includes('private-key'));
  const env = { MODEL_API_KEY: 'private-key', META_CREDITS_EXPIRE_AT: '2026-11-01T00:00:00Z' };
  assert.equal(readMetaConfig(env, Date.parse('2026-10-31T23:59:59Z')).inferenceEnabled, true);
  assert.equal(readMetaConfig(env, Date.parse('2026-11-01T00:00:00Z')).inferenceEnabled, false);
  assert.throws(() => readMetaConfig({ META_ANALYSIS_ENABLED: 'sometimes' }), /Invalid Meta server/);
  assert.throws(() => readMetaConfig({ META_CREDITS_EXPIRE_AT: 'maybe tomorrow' }), /Invalid Meta server/);
});
test('disabled analysis and questions stop before reservation while accepted jobs remain retrievable', async () => {
  const usage = createSqliteUsageStore({ path: ':memory:' });
  let creates = 0; let retrieves = 0;
  const source = analysisSource();
  const provider = () => ({ async start() { creates++; return { id: 'resp_operations', status: 'queued' }; }, async retrieve() { retrieves++; return { id: 'resp_operations', status: 'in_progress' }; }, async cancel() { return { id: 'resp_operations', status: 'cancelled' }; } });
  const enabled = createAnalysisHandlers({ getConfig: () => readMetaConfig({ MODEL_API_KEY: 'key' }), usage, provider });
  const started = await enabled.start(request('/api/analysis/start', { source, requestId: 'operations-enabled-0001' }));
  const cookie = started.headers.get('set-cookie')!.split(';')[0]; const job = (await started.json()).job;
  const getConfig = () => readMetaConfig({ MODEL_API_KEY: 'key', META_ANALYSIS_ENABLED: 'false' });
  const disabled = createAnalysisHandlers({ getConfig, usage, provider });
  assert.equal((await disabled.start(request('/api/analysis/start', { source, requestId: 'operations-disabled-0001' }, cookie))).status, 503);
  const question = createQuestionHandler({ getConfig, usage, provider: () => async () => { creates++; throw new Error('Must not call'); } });
  assert.equal((await question(request('/api/questions', { context: { source, blockId: 'method' }, question: 'Explain this method.', requestId: 'operations-question-0001' }, cookie))).status, 503);
  assert.equal((await usage.summary()).requests, 1);
  assert.equal((await disabled.status(request('/api/analysis/status', { source, job }, cookie))).status, 200);
  assert.equal(creates, 1); assert.equal(retrieves, 1); usage.close?.();
});
