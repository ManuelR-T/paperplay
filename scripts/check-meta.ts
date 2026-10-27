import nextEnv from '@next/env';
import OpenAI from 'openai';
import { writeFile } from 'node:fs/promises';
import { readMetaConfig, publicMetaStatus } from '../server/meta/config';

nextEnv.loadEnvConfig(process.cwd());
const config = readMetaConfig(process.env);
const live = process.argv.includes('--live');
const report = {
  checkedAt: new Date().toISOString(),
  endpoint: config.baseURL,
  model: config.model,
  mode: live ? 'live' : 'configuration-only',
  configured: publicMetaStatus(config).configured,
  accountCredits: 'Not exposed by this probe. Successful requests establish ability to bill, not remaining credits.',
  result: 'not-tested',
  checks: [] as Array<Record<string, unknown>>,
};

async function save() {
  await writeFile('docs/meta-capabilities.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

if (!live || !config.apiKey) {
  report.result = !config.apiKey ? 'blocked-missing-key' : 'ready-for-explicit-live-probe';
  await save();
  if (live && !config.apiKey) process.exitCode = 1;
} else {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 20_000, maxRetries: 0 });
  const request = {
    model: config.model,
    input: 'Return the JSON object {"ok":true}. No explanation.',
    max_output_tokens: 512,
    text: { format: { type: 'json_schema' as const, name: 'paperplay_capability_probe', strict: true,
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } } },
  };
  const usage = (response: OpenAI.Responses.Response) => response.usage ? {
    inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens,
  } : null;
  function validateOutput(response: OpenAI.Responses.Response) {
    if (response.status !== 'completed') throw new Error('Probe output did not complete within the bound.');
    const parsed = JSON.parse(response.output_text);
    if (parsed.ok !== true || Object.keys(parsed).length !== 1) throw new Error('Probe output did not match its schema.');
  }
  let pendingId: string | undefined;
  try {
    const structured = await client.responses.create(request);
    validateOutput(structured);
    report.checks.push({ name: 'structured-output', passed: true, status: structured.status, usage: usage(structured) });

    const started = await client.responses.create({ ...request, background: true });
    pendingId = started.id;
    report.checks.push({ name: 'background-create', passed: started.background === true, status: started.status });
    let result = started;
    for (let attempt = 0; attempt < 20 && (result.status === 'queued' || result.status === 'in_progress'); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      result = await client.responses.retrieve(started.id);
    }
    validateOutput(result);
    pendingId = undefined;
    report.checks.push({ name: 'background-retrieve', passed: true, status: result.status, usage: usage(result) });

    const cancellable = await client.responses.create({ ...request, background: true });
    pendingId = cancellable.id;
    const cancelled = await client.responses.cancel(cancellable.id);
    const cancellationObserved = await client.responses.retrieve(cancellable.id);
    const stopped = cancellationObserved.status === 'cancelled';
    report.checks.push({ name: 'background-cancel', passed: stopped, status: cancelled.status,
      observedStatus: cancellationObserved.status,
      note: stopped ? 'Cancellation observed after retrieve.' : 'Job reached another state; cancellation has not been demonstrated.',
      usage: usage(cancellationObserved),
    });
    if (stopped || cancellationObserved.status === 'completed' || cancellationObserved.status === 'failed') pendingId = undefined;
    report.result = report.checks.every(check => check.passed === true) ? 'verified' : 'partially-verified';
    if (report.result !== 'verified') process.exitCode = 1;
  } catch (error) {
    report.result = 'blocked-live-verification';
    // Do not serialize provider error bodies, request headers or credentials.
    report.checks.push({ name: 'provider-error', passed: false,
      httpStatus: error instanceof OpenAI.APIError ? error.status : null,
      errorType: error instanceof OpenAI.APIError ? 'provider-api-error' : 'probe-validation-or-network-error',
      action: error instanceof OpenAI.APIError && error.status === 401 ? 'Check local MODEL_API_KEY and project access.'
        : error instanceof OpenAI.APIError && error.status === 402 ? 'Activate billing or hackathon credits in the Meta dashboard.'
        : 'Check provider/model access and the bounded probe result. No automatic paid retry was attempted.',
    });
    process.exitCode = 1;
  } finally {
    if (pendingId) {
      try { await client.responses.cancel(pendingId); report.checks.push({ name: 'cleanup-cancel', passed: true }); }
      catch { report.checks.push({ name: 'cleanup-cancel', passed: false, note: 'Inspect pending jobs in the Meta dashboard.' }); }
    }
    await save();
  }
}
