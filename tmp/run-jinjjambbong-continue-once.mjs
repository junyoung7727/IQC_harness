import { markRunning, submitResult, reportFailure, requestNext } from '../src/harness/client.js';
import { runBrainSimulation } from '../src/harness/brain.js';

const serverUrl = 'http://127.0.0.1:3000';
const workerId = '진짬뽕';
const brainAccount = 'oceanic.graph782@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/jinjjambbong';

function formatLine(label, value) {
  return `${label}: ${value}`;
}

async function processBatch(batch) {
  const successSubmissions = [];
  const failureSubmissions = [];

  for (const item of batch.items) {
    try {
      await markRunning(serverUrl, { alphaId: item.alphaId, leaseId: batch.leaseId });
    } catch (error) {
      failureSubmissions.push({
        alpha_id: item.alphaId,
        state: 'failed_to_start',
        retryable: false,
        failure_class: error.message,
        error: error.message
      });
      continue;
    }

    try {
      const result = await runBrainSimulation({
        brainAccount,
        chromeProfile,
        expression: item.expression,
        headed: false
      });
      const submit = await submitResult(serverUrl, {
        alphaId: item.alphaId,
        leaseId: batch.leaseId,
        workerId,
        brainAccount,
        chromeProfile,
        settings: result.settings,
        metrics: result.metrics
      });
      successSubmissions.push({
        alpha_id: item.alphaId,
        state: submit.state,
        metrics: result.metrics
      });
    } catch (error) {
      const retryable = Boolean(error.retryable);
      const failureClass = error.failureClass ?? 'execution_error';
      const failureMessage = error.message;
      try {
        const submit = await reportFailure(serverUrl, {
          alphaId: item.alphaId,
          leaseId: batch.leaseId,
          workerId,
          brainAccount,
          chromeProfile,
          retryable,
          failureClass,
          failureMessage
        });
        failureSubmissions.push({
          alpha_id: item.alphaId,
          state: submit.state,
          retryable,
          failure_class: failureClass,
          error: failureMessage
        });
      } catch (reportError) {
        failureSubmissions.push({
          alpha_id: item.alphaId,
          state: 'report_failed',
          retryable,
          failure_class: failureClass,
          error: `${failureMessage} | report_error=${reportError.message}`
        });
      }
    }
  }

  return { successSubmissions, failureSubmissions };
}

const batch = await requestNext(serverUrl, {
  count: 1,
  workerId,
  brainAccount,
  chromeProfile
});

if (batch.count === 0) {
  console.log(formatLine('request_result', 'status=ok, count=0, lease_id=' + (batch.leaseId ?? '')));
  console.log(formatLine('leased_alpha_ids', '[]'));
  console.log(formatLine('success_submissions', '[]'));
  console.log(formatLine('failure_submissions', '[]'));
  console.log(formatLine('next_action', 'queue empty, worker stop'));
  console.log('queue empty, worker stop');
  process.exit(0);
}

const leasedAlphaIds = batch.items.map((item) => item.alphaId);
const { successSubmissions, failureSubmissions } = await processBatch(batch);

console.log(formatLine('request_result', `status=ok, count=${batch.count}, lease_id=${batch.leaseId}`));
console.log(formatLine('leased_alpha_ids', JSON.stringify(leasedAlphaIds)));
console.log(formatLine('success_submissions', JSON.stringify(successSubmissions)));
console.log(formatLine('failure_submissions', JSON.stringify(failureSubmissions)));
console.log(formatLine('next_action', 'request next alpha 1'));
