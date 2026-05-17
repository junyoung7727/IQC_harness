import { markRunning, reportFailure, requestNext, requeue, submitResult } from './client.js';
import { preflightBrainAccess, runBrainSimulation } from './brain.js';

function noOpLogger() {}

function toLogLine(level, message) {
  return `[${new Date().toISOString()}] ${level} ${message}`;
}

async function executeQueuedItem({
  serverUrl,
  workerId,
  brainAccount,
  chromeProfile,
  brainUrl,
  headed,
  requeueRetryable,
  item,
  leaseId,
  executor,
  logger
}) {
  const safeLogger = logger ?? noOpLogger;
  safeLogger(toLogLine('INFO', `start alpha=${item.alphaId} expr=${item.expression}`));
  try {
    await markRunning(serverUrl, { alphaId: item.alphaId, leaseId });
    const result = await executor({
      brainUrl,
      brainAccount,
      chromeProfile,
      expression: item.expression,
      headed
    });
    await submitResult(serverUrl, {
      alphaId: item.alphaId,
      leaseId,
      workerId,
      brainAccount,
      chromeProfile,
      settings: result.settings,
      metrics: result.metrics
    });
    safeLogger(toLogLine('INFO', `done alpha=${item.alphaId} status=tested`));
    return { alphaId: item.alphaId, outcome: 'tested' };
  } catch (error) {
    const retryable = Boolean(error.retryable);
    const failure = await reportFailure(serverUrl, {
      alphaId: item.alphaId,
      leaseId,
      workerId,
      brainAccount,
      chromeProfile,
      retryable,
      failureClass: error.failureClass ?? 'execution_error',
      failureMessage: error.message
    });
    if (retryable && requeueRetryable) {
      await requeue(serverUrl, item.alphaId);
    }
    safeLogger(toLogLine('WARN', `done alpha=${item.alphaId} status=${failure.state} class=${error.failureClass ?? 'execution_error'}`));
    return { alphaId: item.alphaId, outcome: failure.state };
  }
}

export async function runWorkerLoop({
  serverUrl,
  workerId,
  brainAccount,
  chromeProfile,
  brainUrl,
  headed = false,
  requeueRetryable = false,
  executor = runBrainSimulation,
  preflight = preflightBrainAccess,
  concurrency = 3,
  logger
}) {
  const safeLogger = logger ?? noOpLogger;
  const processed = [];
  safeLogger(toLogLine('DEBUG', `prefetching queue with concurrency=${concurrency}`));
  await preflight({ brainAccount, chromeProfile, headed });
  while (true) {
    const batch = await requestNext(serverUrl, { count: concurrency, workerId, brainAccount, chromeProfile });
    if (batch.count === 0) {
      safeLogger(toLogLine('DEBUG', 'no work available now'));
      return processed;
    }

    safeLogger(toLogLine('INFO', `fetched ${batch.count} item(s), lease=${batch.leaseId}`));

    const promises = batch.items.map((item) => executeQueuedItem({
      serverUrl,
      workerId,
      brainAccount,
      chromeProfile,
      brainUrl,
      headed,
      requeueRetryable,
      item,
      leaseId: batch.leaseId,
      executor,
      logger: safeLogger
    }));

    const outcomes = await Promise.allSettled(promises);

    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        processed.push(outcome.value);
      } else {
        safeLogger(toLogLine('ERROR', `batch error: ${outcome.reason?.message ?? outcome.reason}`));
        throw outcome.reason;
      }
    }
  }
}
