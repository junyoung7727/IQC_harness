import { loadLoginEntries } from '../src/harness/login-map.js';
import { runBrainSimulation } from '../src/harness/brain.js';

const expression = 'group_rank(ts_zscore(divide(cashflow_op, cap), 63), industry)';
const targetAgents = ['육개장', '새우탕', '간짜장'];

const entries = loadLoginEntries().filter((entry) => targetAgents.includes(entry.agent));
if (!entries.length) {
  throw new Error('no_good_accounts_found');
}

const results = [];
for (const entry of entries) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  try {
    const result = await runBrainSimulation({
      brainAccount: entry.id,
      chromeProfile: entry.chromeProfileDir,
      expression,
      headed: false
    });
    results.push({
      agent: entry.agent,
      startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedMs,
      ok: true,
      result
    });
  } catch (error) {
    results.push({
      agent: entry.agent,
      startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedMs,
      ok: false,
      error: {
        message: error.message,
        failureClass: error.failureClass ?? null,
        retryable: error.retryable ?? null,
        responseStatus: error.responseStatus ?? null,
        stack: error.stack
      }
    });
  }
}

console.log(JSON.stringify({ expression, results }, null, 2));
