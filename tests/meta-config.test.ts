import { test } from 'node:test';
import assert from 'node:assert/strict';
import { META_BASE_URL, readMetaConfig, publicMetaStatus } from '../server/meta/config';

test('a missing key keeps the prepared demo available without marking Meta verified', () => {
  const config = readMetaConfig({});
  assert.deepEqual(publicMetaStatus(config), { configured: false, model: 'muse-spark-1.3' });
  assert.equal(config.baseURL, META_BASE_URL);
});

test('public status cannot serialize private credentials or claim provider connectivity', () => {
  const config = readMetaConfig({ MODEL_API_KEY: ' private-test-value ', META_MODEL: 'muse-spark-1.3' });
  assert.deepEqual(publicMetaStatus(config), { configured: true, model: 'muse-spark-1.3' });
  const serialized = JSON.stringify(publicMetaStatus(config));
  assert.equal(serialized.includes('private-test-value'), false);
  assert.equal(serialized.includes('verified'), false);
});

test('invalid model overrides fail with a sanitized configuration error', () => {
  assert.throws(() => readMetaConfig({ MODEL_API_KEY: 'do-not-print', META_MODEL: 'https://example.com?key=secret' }),
    { message: 'Invalid Meta server configuration. Check .env.example.' });
  assert.equal(readMetaConfig({ MODEL_API_KEY: '   ' }).apiKey, undefined);
});
