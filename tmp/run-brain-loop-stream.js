import { markRunning, submitResult, reportFailure, requestNext } from '../src/harness/client.js';
import { runBrainSimulation } from '../src/harness/brain.js';

const serverUrl = 'http://127.0.0.1:3000';
const workerId = '진짬뽕';
const brainAccount = 'oceanic.graph782@phuturemail.com';
const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong';

while (true) {
  const current = await requestNext(serverUrl, {
    count: 3,
    workerId,
    brainAccount,
    chromeProfile
  });

  const currentIds = (current.items || []).map((item) => item.alphaId);
  const successSubmissions = [];
  const failureSubmissions = [];

  if (current.count === 0) {
    console.log(`request_result: status=${current.status}, count=${current.count}, lease_id=${current.leaseId ?? ''}`);
    console.log(`leased_alpha_ids: ${currentIds.join(', ')}`);
    console.log(`success_submissions: ${successSubmissions.length ? JSON.stringify(successSubmissions) : ''}`);
    console.log(`failure_submissions: ${failureSubmissions.length ? JSON.stringify(failureSubmissions) : ''}`);
    console.log('next_action: queue empty, worker stop');
    console.log('queue empty, worker stop');
    break;
  }

  for (const item of current.items) {
    await markRunning(serverUrl, { alphaId: item.alphaId, leaseId: current.leaseId });
    try {
      const result = await runBrainSimulation({
        brainAccount,
        chromeProfile,
        expression: item.expression,
        headed: false
      });

      const submit = await submitResult(serverUrl, {
        alphaId: item.alphaId,
        leaseId: current.leaseId,
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
      const failure = await reportFailure(serverUrl, {
        alphaId: item.alphaId,
        leaseId: current.leaseId,
        workerId,
        brainAccount,
        chromeProfile,
        retryable,
        failureClass: error.failureClass ?? 'execution_error',
        failureMessage: error.message
      });

      failureSubmissions.push({
        alpha_id: item.alphaId,
        state: failure.state,
        retryable,
        failure_class: error.failureClass ?? 'execution_error',
        error: error.message
      });
    }
  }

  console.log(`request_result: status=${current.status}, count=${current.count}, lease_id=${current.leaseId ?? ''}`);
  console.log(`leased_alpha_ids: ${currentIds.join(', ')}`);
  console.log(`success_submissions: ${successSubmissions.length ? JSON.stringify(successSubmissions) : ''}`);
  console.log(`failure_submissions: ${failureSubmissions.length ? JSON.stringify(failureSubmissions) : ''}`);
  console.log('next_action: continue');
}
