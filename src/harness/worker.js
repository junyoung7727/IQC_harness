import { markRunning, reportFailure, requestNext, requeue, submitResult } from './client.js';
import { createBrainRuntime, preflightBrainAccess, runBrainSimulation } from './brain.js';

function noOpLogger() {}

function toLogLine(level, message) {
  return `[${new Date().toISOString()}] ${level} ${message}`;
}

async function executeQueuedItem({
  serverUrl,
  workerId,
  brainAccount,
  chromeProfile,
  brainCredentials,
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
      brainCredentials,
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
  brainCredentials,
  brainUrl,
  headed = false,
  requeueRetryable = false,
  executor = runBrainSimulation,
  preflight = preflightBrainAccess,
  brainRuntimeFactory = createBrainRuntime,
  concurrency = 3,
  shouldStop = () => false,
  logger
}) {
  const safeLogger = logger ?? noOpLogger;
  const processed = [];
  const useSharedRuntime = executor === runBrainSimulation && preflight === preflightBrainAccess;
  const runtime = useSharedRuntime
    ? brainRuntimeFactory({
      brainAccount,
      chromeProfile,
      brainCredentials,
      headed,
      sessionCount: concurrency
    })
    : null;
  const effectivePreflight = runtime
    ? async () => runtime.preflight()
    : preflight;
  const effectiveExecutor = runtime
    ? async ({ expression }) => runtime.runSimulation(expression)
    : executor;

  safeLogger(toLogLine('DEBUG', `prefetching queue with concurrency=${concurrency}`));

  try {
    await effectivePreflight({ brainAccount, chromeProfile, brainCredentials, headed });
    while (!shouldStop()) {
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
        brainCredentials,
        item,
        leaseId: batch.leaseId,
        executor: effectiveExecutor,
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

    safeLogger(toLogLine('INFO', 'stop requested, ending worker loop before next lease'));
    return processed;
  } finally {
    await runtime?.close();
  }
}
