import { getAlpha, markRunning, requestNext, submitResult, reportFailure } from './src/harness/client.js';
import { runBrainSimulation } from './src/harness/brain.js';

const config = {
  serverUrl: 'http://127.0.0.1:3000',
  workerId: '새우탕',
  brainAccount: 'mask.27-e61ff11f@phuturemail.com',
  chromeProfile: 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\saewootang'
};

async function processItem(item, leaseId) {
  const current = await getAlpha(config.serverUrl, item.alphaId);
  if (!current) {
    return { alphaId: item.alphaId, status: 'missing' };
  }
  if (current.status === 'leased') {
    await markRunning(config.serverUrl, { alphaId: item.alphaId, leaseId });
  } else if (current.status === 'running') {
    // continue
  } else {
    return { alphaId: item.alphaId, status: 'skip', reason: current.status };
  }

  try {
    const result = await runBrainSimulation({
      brainAccount: config.brainAccount,
      chromeProfile: config.chromeProfile,
      expression: item.expression,
      headed: false
    });
    const submitted = await submitResult(config.serverUrl, {
      alphaId: item.alphaId,
      leaseId,
      workerId: config.workerId,
      brainAccount: config.brainAccount,
      chromeProfile: config.chromeProfile,
      settings: result.settings,
      metrics: result.metrics
    });
    return { alphaId: item.alphaId, status: 'ok', state: submitted.state, sharpe: result.metrics?.sharpe ?? null, fitness: result.metrics?.fitness ?? null };
  } catch (error) {
    const retryable = Boolean(error.retryable);
    const failure = await reportFailure(config.serverUrl, {
      alphaId: item.alphaId,
      leaseId,
      workerId: config.workerId,
      brainAccount: config.brainAccount,
      chromeProfile: config.chromeProfile,
      retryable,
      failureClass: error.failureClass ?? 'execution_error',
      failureMessage: error.message ?? String(error)
    });
    return { alphaId: item.alphaId, status: 'fail', state: failure.state, retryable, failureClass: error.failureClass ?? 'execution_error', error: error.message };
  }
}

async function run() {
  const batch = await requestNext(config.serverUrl, {
    count: 3,
    workerId: config.workerId,
    brainAccount: config.brainAccount,
    chromeProfile: config.chromeProfile
  });

  if (batch.count === 0) {
    console.log(JSON.stringify({ count: 0, leaseId: null, items: [] }));
    return;
  }

  const summary = { count: batch.count, leaseId: batch.leaseId, items: [] };
  for (const item of batch.items) {
    const result = await processItem(item, batch.leaseId);
    summary.items.push(result);
  }
  console.log(JSON.stringify(summary));
}

run().catch((error) => {
  console.error('batch_error', error.message);
  process.exit(1);
});
