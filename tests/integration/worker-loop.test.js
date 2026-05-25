import test from 'node:test';
import assert from 'node:assert/strict';
import { submitAlpha, getAlpha } from '../../src/harness/client.js';
import { runWorkerLoop } from '../../src/harness/worker.js';
import { startHarnessTestServer } from '../helpers.js';

test('worker loop fails closed before leasing work when preflight fails', async () => {
  const harness = await startHarnessTestServer();
  try {
    const accepted = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');

    await assert.rejects(
      () => runWorkerLoop({
        serverUrl: harness.baseUrl,
        workerId: 'worker-1',
        brainAccount: 'brain-a',
        chromeProfile: 'profile-a',
        preflight: async () => {
          const err = new Error('preflight blocked');
          err.failureClass = 'auth_state_proof_failed';
          err.retryable = false;
          throw err;
        },
        executor: async () => ({
          settings: { delay: 1 },
          metrics: { sharpe: 1, fitness: 1 }
        })
      }),
      /preflight blocked/
    );

    const stored = await getAlpha(harness.baseUrl, accepted.alphaId);
    assert.equal(stored.status, 'pending');
  } finally {
    await harness.cleanup();
  }
});

test('worker loop polls until queue is empty and records success plus failures', async () => {
  const harness = await startHarnessTestServer();
  try {
    const a1 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');
    const a2 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(low, 5))', 'agent-a');
    const a3 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(open, 5))', 'agent-a');
    const a4 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(high, 5))', 'agent-a');

    const executor = async ({ expression }) => {
      if (expression.includes('low')) {
        const err = new Error('invalid datafield used');
        err.failureClass = 'invalid_datafield';
        err.retryable = false;
        throw err;
      }
      if (expression.includes('open')) {
        const err = new Error('retryable mock failure');
        err.failureClass = 'retryable_platform';
        err.retryable = true;
        throw err;
      }
      return {
        settings: { delay: 1, universe: 'TOP3000' },
        metrics: { sharpe: 1.2, fitness: 1.1 }
      };
    };

    const processed = await runWorkerLoop({
      serverUrl: harness.baseUrl,
      workerId: 'worker-1',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      requeueRetryable: false,
      preflight: async () => ({ currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 }),
      executor
    });

    assert.equal(processed.length, 4);
    const states = new Map(processed.map((item) => [item.alphaId, item.outcome]));
    assert.equal(states.get(a1.alphaId), 'tested');
    assert.equal(states.get(a2.alphaId), 'failed_terminal');
    assert.equal(states.get(a3.alphaId), 'failed_retryable');
    assert.equal(states.get(a4.alphaId), 'tested');

    const stored1 = await getAlpha(harness.baseUrl, a1.alphaId);
    const stored2 = await getAlpha(harness.baseUrl, a2.alphaId);
    const stored3 = await getAlpha(harness.baseUrl, a3.alphaId);
    const stored4 = await getAlpha(harness.baseUrl, a4.alphaId);
    assert.equal(stored1.status, 'tested');
    assert.equal(stored1.settings.universe, 'TOP3000');
    assert.equal(stored1.metrics.fitness, 1.1);
    assert.equal(stored2.status, 'failed_terminal');
    assert.equal(stored3.status, 'failed_retryable');
    assert.equal(stored4.status, 'tested');

    const persisted = harness.repo.db.prepare(`
      SELECT settings_universe, metric_sharpe, metric_fitness
      FROM alphas
      WHERE alpha_id = ?
    `).get(a1.alphaId);
    assert.equal(persisted.settings_universe, 'TOP3000');
    assert.equal(persisted.metric_sharpe, 1.2);
    assert.equal(persisted.metric_fitness, 1.1);

    const pendingIds = harness.repo.listAlphaIdsByStatus('pending');
    assert.deepEqual(pendingIds, []);
  } finally {
    await harness.cleanup();
  }
});

test('worker loop executes up to 3 items in parallel for each batch', async () => {
  const harness = await startHarnessTestServer();
  try {
    const a1 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');
    const a2 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(low, 5))', 'agent-a');
    const a3 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(open, 5))', 'agent-a');
    const a4 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(high, 5))', 'agent-a');

    let inFlight = 0;
    let peakInFlight = 0;

    const executor = async () => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 50));
      inFlight -= 1;
      return {
        settings: { delay: 1, universe: 'TOP3000' },
        metrics: { sharpe: 1.0, fitness: 1.0 }
      };
    };

    const processed = await runWorkerLoop({
      serverUrl: harness.baseUrl,
      workerId: 'worker-1',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      preflight: async () => ({ currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 }),
      executor
    });

    assert.equal(processed.length, 4);
    assert.equal(peakInFlight, 3);

    const persisted = harness.repo.listAlphaIdsByStatus('tested');
    assert.deepEqual(persisted, [a1.alphaId, a2.alphaId, a3.alphaId, a4.alphaId]);
  } finally {
    await harness.cleanup();
  }
});

test('worker loop forwards runtime brain credentials to preflight and executor', async () => {
  const harness = await startHarnessTestServer();
  try {
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');

    const brainCredentials = {
      id: 'runtime@example.com',
      password: 'secret'
    };
    const seen = [];

    const processed = await runWorkerLoop({
      serverUrl: harness.baseUrl,
      workerId: 'worker-1',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      brainCredentials,
      preflight: async (args) => {
        seen.push({ stage: 'preflight', args });
        return { currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 };
      },
      executor: async (args) => {
        seen.push({ stage: 'executor', args });
        return {
          settings: { delay: 1 },
          metrics: { sharpe: 1, fitness: 1 }
        };
      }
    });

    assert.equal(processed.length, 1);
    assert.deepEqual(seen[0], {
      stage: 'preflight',
      args: {
        brainAccount: 'brain-a',
        chromeProfile: 'profile-a',
        brainCredentials,
        headed: false
      }
    });
    assert.equal(seen[1].stage, 'executor');
    assert.deepEqual(seen[1].args.brainCredentials, brainCredentials);
    assert.equal(seen[1].args.chromeProfile, 'profile-a');
    assert.equal(seen[1].args.brainAccount, 'brain-a');
  } finally {
    await harness.cleanup();
  }
});

test('worker loop reuses one shared brain runtime and closes it after processing', async () => {
  const harness = await startHarnessTestServer();
  try {
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(low, 5))', 'agent-a');

    const seen = {
      factoryArgs: null,
      preflightCalls: 0,
      closeCalls: 0,
      expressions: []
    };

    const processed = await runWorkerLoop({
      serverUrl: harness.baseUrl,
      workerId: 'worker-1',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      brainCredentials: { id: 'runtime@example.com', password: 'secret' },
      concurrency: 2,
      brainRuntimeFactory: (args) => {
        seen.factoryArgs = args;
        return {
          async preflight() {
            seen.preflightCalls += 1;
            return { currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 };
          },
          async runSimulation(expression) {
            seen.expressions.push(expression);
            return {
              settings: { delay: 1 },
              metrics: { sharpe: 1, fitness: 1 }
            };
          },
          async close() {
            seen.closeCalls += 1;
          }
        };
      }
    });

    assert.equal(processed.length, 2);
    assert.equal(seen.preflightCalls, 1);
    assert.equal(seen.closeCalls, 1);
    assert.equal(seen.factoryArgs.sessionCount, 2);
    assert.equal(seen.factoryArgs.brainAccount, 'brain-a');
    assert.equal(seen.factoryArgs.chromeProfile, 'profile-a');
    assert.deepEqual(seen.expressions.sort(), [
      'rank(ts_delta(close, 5))',
      'rank(ts_delta(low, 5))'
    ]);
  } finally {
    await harness.cleanup();
  }
});

test('worker loop closes shared brain runtime when preflight fails', async () => {
  const harness = await startHarnessTestServer();
  try {
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');

    let closeCalls = 0;

    await assert.rejects(
      () => runWorkerLoop({
        serverUrl: harness.baseUrl,
        workerId: 'worker-1',
        brainAccount: 'brain-a',
        chromeProfile: 'profile-a',
        brainRuntimeFactory: () => ({
          async preflight() {
            const error = new Error('runtime preflight blocked');
            error.failureClass = 'auth_state_proof_failed';
            error.retryable = false;
            throw error;
          },
          async runSimulation() {
            throw new Error('should not run');
          },
          async close() {
            closeCalls += 1;
          }
        })
      }),
      /runtime preflight blocked/
    );

    assert.equal(closeCalls, 1);
  } finally {
    await harness.cleanup();
  }
});

test('worker loop stops before requesting another lease after stop is requested during a batch', async () => {
  const harness = await startHarnessTestServer();
  try {
    const a1 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a');
    const a2 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(low, 5))', 'agent-a');

    let shouldStop = false;
    let executorRuns = 0;
    const processed = await runWorkerLoop({
      serverUrl: harness.baseUrl,
      workerId: 'worker-1',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      concurrency: 1,
      shouldStop: () => shouldStop,
      preflight: async () => ({ currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 }),
      executor: async () => {
        executorRuns += 1;
        shouldStop = true;
        return {
          settings: { delay: 1 },
          metrics: { sharpe: 1, fitness: 1 }
        };
      }
    });

    assert.equal(executorRuns, 1);
    assert.equal(processed.length, 1);
    assert.equal(processed[0].alphaId, a1.alphaId);
    const stored1 = await getAlpha(harness.baseUrl, a1.alphaId);
    const stored2 = await getAlpha(harness.baseUrl, a2.alphaId);
    assert.equal(stored1.status, 'tested');
    assert.equal(stored2.status, 'pending');
  } finally {
    await harness.cleanup();
  }
});
