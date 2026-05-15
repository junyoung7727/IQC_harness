import { markRunning, reportFailure, requestNext, requeue, submitResult } from './client.js';
import { preflightBrainAccess, runBrainSimulation } from './brain.js';

export async function runWorkerLoop({
  serverUrl,
  workerId,
  brainAccount,
  chromeProfile,
  brainUrl,
  headed = false,
  requeueRetryable = false,
  executor = runBrainSimulation,
  preflight = preflightBrainAccess
}) {
  const processed = [];
  await preflight({ brainAccount, chromeProfile, headed });
  while (true) {
    const batch = await requestNext(serverUrl, { count: 3, workerId, brainAccount, chromeProfile });
    if (batch.count === 0) {
      return processed;
    }

    for (const item of batch.items) {
      await markRunning(serverUrl, { alphaId: item.alphaId, leaseId: batch.leaseId });
      try {
        const result = await executor({
          brainUrl,
          brainAccount,
          chromeProfile,
          expression: item.expression,
          headed
        });
        await submitResult(serverUrl, {
          alphaId: item.alphaId,
          leaseId: batch.leaseId,
          workerId,
          brainAccount,
          chromeProfile,
          settings: result.settings,
          metrics: result.metrics
        });
        processed.push({ alphaId: item.alphaId, outcome: 'tested' });
      } catch (error) {
        const retryable = Boolean(error.retryable);
        const failure = await reportFailure(serverUrl, {
          alphaId: item.alphaId,
          leaseId: batch.leaseId,
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
        processed.push({ alphaId: item.alphaId, outcome: failure.state });
      }
    }
  }
}
