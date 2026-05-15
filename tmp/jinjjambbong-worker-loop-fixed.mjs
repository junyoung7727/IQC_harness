import { markRunning, submitResult, reportFailure, requestNext } from '../src/harness/client.js';
import { runBrainSimulation } from '../src/harness/brain.js';

const serverUrl = 'http://127.0.0.1:3000';
const workerId = '진짬뽕';
const brainAccount = 'oceanic.graph782@phuturemail.com';
const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong';

let batch = {
  count: 3,
  leaseId: '31acbb2b-28d5-4349-9329-1c75c8369a8f',
  items: [
    { alphaId: 256, expression: 'rank(ts_delta(vec_avg(anl4_basicqfv4_maxguidance), 20))' },
    { alphaId: 257, expression: 'group_rank(vec_avg(anl4_basicdetailrec_ratingvalue), subindustry)' },
    { alphaId: 258, expression: 'normalize(ts_av_diff(vec_avg(anl4_basicconqfv110_numest), 40))' }
  ]
};

while (true) {
  const successSubmissions = [];
  const failureSubmissions = [];

  for (const item of batch.items) {
    await markRunning(serverUrl, { alphaId: item.alphaId, leaseId: batch.leaseId });
    try {
      const result = await runBrainSimulation({ brainAccount, chromeProfile, expression: item.expression, headed: false });
      const submit = await submitResult(serverUrl, {
        alphaId: item.alphaId,
        leaseId: batch.leaseId,
        workerId,
        brainAccount,
        chromeProfile,
        settings: result.settings,
        metrics: result.metrics
      });
      successSubmissions.push({ alpha_id: item.alphaId, state: submit.state, metrics: result.metrics });
    } catch (error) {
      const retryable = Boolean(error.retryable);
      const failureClass = error.failureClass ?? 'execution_error';
      const failureMessage = error.message;
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
      failureSubmissions.push({ alpha_id: item.alphaId, state: submit.state, retryable, failure_class: failureClass, error: failureMessage });
    }
  }

  const nextBatch = await requestNext(serverUrl, { count: 3, workerId, brainAccount, chromeProfile });

  console.log(`- request_result: status=ok, count=${batch.count}, lease_id=${batch.leaseId}`);
  console.log(`- leased_alpha_ids: ${batch.items.map((item) => item.alphaId).join(', ')}`);
  console.log(`- success_submissions: ${successSubmissions.length ? JSON.stringify(successSubmissions) : ''}`);
  console.log(`- failure_submissions: ${failureSubmissions.length ? JSON.stringify(failureSubmissions) : ''}`);
  console.log(`- next_action: ${nextBatch.count === 0 ? 'queue empty, worker stop' : `continue with lease_id=${nextBatch.leaseId}`}`);

  if (nextBatch.count === 0) {
    console.log('queue empty, worker stop');
    break;
  }

  batch = nextBatch;
}
