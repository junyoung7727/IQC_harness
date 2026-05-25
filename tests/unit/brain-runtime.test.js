import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrainRuntime } from '../../src/harness/brain.js';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakePage(label) {
  let closed = false;
  return {
    label,
    isClosed() {
      return closed;
    },
    async close() {
      closed = true;
    }
  };
}

function createFakeBrowserHarness() {
  let contextCount = 0;
  let browserClosedCount = 0;
  const contextClosures = [];

  const browser = {
    async newContext() {
      contextCount += 1;
      const page = createFakePage(`page-${contextCount}`);
      let closed = false;
      const context = {
        id: contextCount,
        page,
        async newPage() {
          return page;
        },
        async close() {
          if (closed) return;
          closed = true;
          contextClosures.push(context.id);
          await page.close();
        }
      };
      return context;
    },
    async close() {
      browserClosedCount += 1;
    }
  };

  return {
    browser,
    get contextCount() {
      return contextCount;
    },
    get browserClosedCount() {
      return browserClosedCount;
    },
    get contextClosures() {
      return contextClosures.slice();
    }
  };
}

function createDependencies(overrides = {}) {
  const browserHarness = overrides.browserHarness ?? createFakeBrowserHarness();
  let launchCount = 0;
  let loginCount = 0;

  return {
    browserHarness,
    stats: {
      get launchCount() {
        return launchCount;
      },
      get loginCount() {
        return loginCount;
      }
    },
    deps: {
      async launchBrowser() {
        launchCount += 1;
        return browserHarness.browser;
      },
      async login(page) {
        loginCount += 1;
        return { page, proof: { currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 } };
      },
      async submitSimulation(page, credentials, expression) {
        if (overrides.submitSimulation) {
          return overrides.submitSimulation(page, credentials, expression);
        }
        return {
          location: `simulation:${expression}`,
          retryAfterMs: 0,
          settings: { expression }
        };
      },
      async pollSimulationResult(page, location) {
        if (overrides.pollSimulationResult) {
          return overrides.pollSimulationResult(page, location);
        }
        return { status: 'COMPLETE', alpha: `${location}:alpha`, progress: 1 };
      },
      async fetchAlpha(page, alphaId) {
        if (overrides.fetchAlpha) {
          return overrides.fetchAlpha(page, alphaId);
        }
        return { is: { sharpe: 1.1, fitness: 0.9, turnover: 0.2 }, grade: 'A' };
      },
      async verifySession(page) {
        if (overrides.verifySession) {
          return overrides.verifySession(page);
        }
        return { currentUrl: 'https://platform.worldquantbrain.com/simulate', protectedStatus: 200 };
      },
      async sleepMs() {}
    }
  };
}

test('createBrainRuntime launches one browser across multiple simulations', async () => {
  const { deps, stats, browserHarness } = createDependencies();
  const runtime = createBrainRuntime({
    brainAccount: 'brain-a',
    chromeProfile: 'profile-a',
    brainCredentials: { id: 'runtime@example.com', password: 'secret' },
    sessionCount: 1
  }, deps);

  try {
    await runtime.runSimulation('alpha-1');
    await runtime.runSimulation('alpha-2');

    assert.equal(stats.launchCount, 1);
    assert.equal(stats.loginCount, 1);
    assert.equal(browserHarness.contextCount, 1);
  } finally {
    await runtime.close();
  }
});

test('createBrainRuntime caps active slot creation at sessionCount', async () => {
  const firstGate = createDeferred();
  const secondGate = createDeferred();
  const thirdGate = createDeferred();
  const gates = [firstGate, secondGate, thirdGate];
  let active = 0;
  let peakActive = 0;
  const { deps, stats, browserHarness } = createDependencies({
    async pollSimulationResult(page, location) {
      active += 1;
      peakActive = Math.max(peakActive, active);
      const gate = gates.shift();
      await gate.promise;
      active -= 1;
      return { status: 'COMPLETE', alpha: `${location}:alpha`, progress: 1 };
    }
  });

  const runtime = createBrainRuntime({
    brainAccount: 'brain-a',
    chromeProfile: 'profile-a',
    brainCredentials: { id: 'runtime@example.com', password: 'secret' },
    sessionCount: 2
  }, deps);

  try {
    const first = runtime.runSimulation('alpha-1');
    const second = runtime.runSimulation('alpha-2');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const third = runtime.runSimulation('alpha-3');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(stats.launchCount, 1);
    assert.equal(browserHarness.contextCount, 2);
    assert.equal(peakActive, 2);

    firstGate.resolve();
    secondGate.resolve();
    await Promise.all([first, second]);
    thirdGate.resolve();
    await third;

    assert.equal(browserHarness.contextCount, 2);
  } finally {
    firstGate.resolve();
    secondGate.resolve();
    thirdGate.resolve();
    await runtime.close();
  }
});

test('createBrainRuntime closes all contexts and browser exactly once', async () => {
  const { deps, browserHarness } = createDependencies();
  const runtime = createBrainRuntime({
    brainAccount: 'brain-a',
    chromeProfile: 'profile-a',
    brainCredentials: { id: 'runtime@example.com', password: 'secret' },
    sessionCount: 2
  }, deps);

  await Promise.all([
    runtime.runSimulation('alpha-1'),
    runtime.runSimulation('alpha-2')
  ]);
  await runtime.close();
  await runtime.close();

  assert.deepEqual(browserHarness.contextClosures, [1, 2]);
  assert.equal(browserHarness.browserClosedCount, 1);
});

test('createBrainRuntime recycles only the failed slot on auth expiry', async () => {
  let submitCalls = 0;
  const { deps, browserHarness } = createDependencies({
    async submitSimulation(page, credentials, expression) {
      submitCalls += 1;
      if (submitCalls === 1) {
        const error = new Error('expired');
        error.failureClass = 'auth_session_expired';
        error.retryable = true;
        throw error;
      }
      return {
        location: `simulation:${expression}`,
        retryAfterMs: 0,
        settings: { expression }
      };
    }
  });

  const runtime = createBrainRuntime({
    brainAccount: 'brain-a',
    chromeProfile: 'profile-a',
    brainCredentials: { id: 'runtime@example.com', password: 'secret' },
    sessionCount: 1
  }, deps);

  try {
    const result = await runtime.runSimulation('alpha-1');
    assert.equal(result.metrics.alphaId, 'simulation:alpha-1:alpha');
    assert.equal(browserHarness.contextCount, 2);
    assert.deepEqual(browserHarness.contextClosures, [1]);
    assert.equal(browserHarness.browserClosedCount, 0);
  } finally {
    await runtime.close();
  }
});
