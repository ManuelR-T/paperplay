import { createSqliteUsageStore } from '../server/usage/store';
const store = createSqliteUsageStore({ path: process.argv[2], limits: { globalHourlyRequests: 5, sessionTenMinuteRequests: 100, dailyRequests: 100, dailyTokens: 1_000_000 }, now: () => 1_000_000 });
let accepted = 0;
for (let i = 0; i < 4; i++) {
  try { const result = await store.reserve({ id: `worker-${process.argv[3]}-${i}`, sessionId: `session-${process.argv[3]}`, kind: 'question', maxOutputTokens: 1200, inputCharacters: 400, model: 'test-model' }); if (result.created) accepted++; } catch { /* quota is the expected loser */ }
}
store.close?.();
console.log(JSON.stringify({ accepted }));
