import { getAlpha, markRunning, submitResult, reportFailure } from './src/harness/client.js';
import { runBrainSimulation } from './src/harness/brain.js';

const config = {
  serverUrl: 'http://127.0.0.1:3000',
  workerId: '새우탕',
  brainAccount: 'mask.27-e61ff11f@phuturemail.com',
  chromeProfile: 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\saewootang',
  leaseId: 'e9eaaf26-004d-4bed-8e5e-c3e5a69462dc'
};

const items = [
  { alphaId: 767, expression: 'funding_stress(ts_delta(loan_growth, 12), ts_delta(default_rate, 12), 0.5)' },
  { alphaId: 768, expression: 'market_microgap(ts_delta(small_cap_momentum, 9), ts_delta(large_cap_momentum, 9), 5)' },
  { alphaId: 769, expression: 'institutional_shift(ts_delta(foreign_ownership, 14), ts_delta(institutional_flow, 14), 9)' }
];

async function processItem(item) {
  const current = await getAlpha(config.serverUrl, item.alphaId);
  if (!current) {
    console.log(`alphaId=${item.alphaId} missing`);
    return { alphaId: item.alphaId, status: 'missing' };
  }
  console.log(`state alphaId=${item.alphaId} status=${current.status} lease=${current.leaseId}`);

  if (current.status === 'leased') {
    await markRunning(config.serverUrl, {
      alphaId: item.alphaId,
      leaseId: config.leaseId
    });
  } else if (current.status === 'running') {
    // already running with correct lease
  } else {
    console.log(`alphaId=${item.alphaId} skip (status=${current.status})`);
    return { alphaId: item.alphaId, status: 'skipped', reason: `status=${current.status}` };
  }

  const outcome = {};
  try {
    const result = await runBrainSimulation({
      brainAccount: config.brainAccount,
      chromeProfile: config.chromeProfile,
      expression: item.expression,
      headed: false
    });
    const submitted = await submitResult(config.serverUrl, {
      alphaId: item.alphaId,
      leaseId: config.leaseId,
      workerId: config.workerId,
      brainAccount: config.brainAccount,
      chromeProfile: config.chromeProfile,
      settings: result.settings,
      metrics: result.metrics
    });
    console.log(`ok alphaId=${item.alphaId} state=${submitted.state}`);
    return { alphaId: item.alphaId, status: 'ok', state: submitted.state, metrics: result.metrics };
  } catch (error) {
    const retryable = Boolean(error.retryable);
    const failure = await reportFailure(config.serverUrl, {
      alphaId: item.alphaId,
      leaseId: config.leaseId,
      workerId: config.workerId,
      brainAccount: config.brainAccount,
      chromeProfile: config.chromeProfile,
      retryable,
      failureClass: error.failureClass ?? 'execution_error',
      failureMessage: error.message ?? String(error)
    });
    console.log(`fail alphaId=${item.alphaId} state=${failure.state} retryable=${retryable} class=${error.failureClass ?? 'execution_error'}`);
    return { alphaId: item.alphaId, status: 'fail', state: failure.state, error: error.message };
  }
}

async function run() {
  const results = [];
  for (const item of items) {
    try {
      const result = await processItem(item);
      results.push(result);
    } catch (error) {
      results.push({ alphaId: item.alphaId, status: 'fatal', error: error.message });
      console.log(`fatal alphaId=${item.alphaId} ${error.message}`);
    }
  }
  console.log(JSON.stringify(results));
}

run().catch((error) => {
  console.error('batch_failed', error.message);
  process.exit(1);
});
