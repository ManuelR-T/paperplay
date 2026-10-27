import nextEnv from '@next/env';
import { createUsageStore } from '../server/usage/service';
nextEnv.loadEnvConfig(process.cwd());
try {
  const store = createUsageStore();
  const summary = await store.summary();
  console.log(JSON.stringify({ ...summary, accounting: 'Measured tokens are provider-reported. Unmeasured requests retain a conservative reservation; this is not a currency balance. Provider billing is the source of truth.', retention: '30 days; UTC daily allowance. No source bodies, questions, answers or API credentials are recorded.' }, null, 2));
  store.close?.();
} catch {
  console.error('Usage summary unavailable. Check the durable usage-store configuration.');
  process.exitCode = 1;
}
