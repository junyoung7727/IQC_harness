import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { getAlpha, reportFailure, requestNext, requeue, resetPendingStates, submitAlpha, submitResult, markRunning } from '../../src/harness/client.js';
import { normalizeCurrentHarnessDb } from '../../src/harness/admin.js';
import { startServer } from '../../src/harness/server.js';
import { makeTempDir, startHarnessTestServer } from '../helpers.js';

const execFileAsync = promisify(execFile);

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function viewerAuthHeaders(username = 'viewer', password = 'secret') {
  return {
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  };
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.text() };
}

test('submit accepts novel alpha and rejects near-duplicate before storage', async () => {
  const harness = await startHarnessTestServer();
  try {
    const hypothesis = 'Short-term price reversal after an outsized move.';
    const first = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a', hypothesis);
    assert.equal(first.status, 'accepted');

    const stored = await getAlpha(harness.baseUrl, first.alphaId);
    assert.equal(stored.hypothesis, hypothesis);

    const persisted = harness.repo.db.prepare(`
      SELECT hypothesis
      FROM alphas
      WHERE alpha_id = ?
    `).get(first.alphaId);
    assert.equal(persisted.hypothesis, hypothesis);

    const second = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-b', 'Duplicate thesis');
    assert.equal(second.status, 'rejected_similarity');
    assert.equal(harness.repo.countStored(), 1);
  } finally {
    await harness.cleanup();
  }
});

test('cli submit forwards hypothesis into stored alpha record', async () => {
  const harness = await startHarnessTestServer();
  try {
    const hypothesis = 'Fundamental news diffuses slowly into prices.';
    const { stdout } = await execFileAsync(
      'node',
      [
        'src/harness/cli.js',
        'submit',
        'alpha',
        '--server-url',
        harness.baseUrl,
        '--expr',
        'rank(ts_delta(close, 5))',
        '--submitted-by',
        'cli-agent',
        '--hypothesis',
        hypothesis
      ],
      { cwd: 'C:/Users/user/worldquant-multi-agent-harness' }
    );

    assert.match(stdout, /status=accepted/);

    const stored = await getAlpha(harness.baseUrl, 1);
    assert.equal(stored.hypothesis, hypothesis);
    assert.equal(stored.submittedBy, 'cli-agent');
  } finally {
    await harness.cleanup();
  }
});

test('parallel workers do not receive the same alpha lease', async () => {
  const harness = await startHarnessTestServer();
  try {
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))');
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(open, 5))');
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(volume, 5))');
    await submitAlpha(harness.baseUrl, 'rank(ts_delta(high, 5))');

    const [a, b] = await Promise.all([
      requestNext(harness.baseUrl, { count: 3, workerId: 'w1', brainAccount: 'a1', chromeProfile: 'p1' }),
      requestNext(harness.baseUrl, { count: 3, workerId: 'w2', brainAccount: 'a2', chromeProfile: 'p2' })
    ]);

    const ids = [...a.items, ...b.items].map((item) => item.alphaId);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 4);
  } finally {
    await harness.cleanup();
  }
});

test('result and failure state transitions persist canonical record', async () => {
  const harness = await startHarnessTestServer();
  try {
    const accepted = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))');
    const leased = await requestNext(harness.baseUrl, { count: 3, workerId: 'w1', brainAccount: 'a1', chromeProfile: 'p1' });
    await markRunning(harness.baseUrl, { alphaId: accepted.alphaId, leaseId: leased.leaseId });
    await submitResult(harness.baseUrl, {
      alphaId: accepted.alphaId,
      leaseId: leased.leaseId,
      workerId: 'w1',
      brainAccount: 'a1',
      chromeProfile: 'p1',
      settings: { delay: 1 },
      metrics: { sharpe: 1.2, fitness: 1.1 }
    });
    const stored = await getAlpha(harness.baseUrl, accepted.alphaId);
    assert.equal(stored.status, 'tested');
    assert.equal(stored.settings.delay, 1);
    assert.equal(stored.metrics.sharpe, 1.2);

    const persisted = harness.repo.db.prepare(`
      SELECT settings_delay, metric_sharpe, metric_fitness, brain_account_id, chrome_profile_id, lease_id, leased_to
      FROM alphas
      WHERE alpha_id = ?
    `).get(accepted.alphaId);
    assert.equal(persisted.settings_delay, 1);
    assert.equal(persisted.metric_sharpe, 1.2);
    assert.equal(persisted.metric_fitness, 1.1);
    assert.equal(persisted.brain_account_id, 'a1');
    assert.equal(persisted.chrome_profile_id, 'p1');
    assert.equal(persisted.lease_id, null);
    assert.equal(persisted.leased_to, null);

    const accepted2 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(low, 5))');
    const leased2 = await requestNext(harness.baseUrl, { count: 3, workerId: 'w2', brainAccount: 'a2', chromeProfile: 'p2' });
    await markRunning(harness.baseUrl, { alphaId: accepted2.alphaId, leaseId: leased2.leaseId });
    await reportFailure(harness.baseUrl, {
      alphaId: accepted2.alphaId,
      leaseId: leased2.leaseId,
      workerId: 'w2',
      brainAccount: 'a2',
      chromeProfile: 'p2',
      retryable: true,
      failureClass: 'retryable_platform',
      failureMessage: 'temp'
    });
    const failed = await getAlpha(harness.baseUrl, accepted2.alphaId);
    assert.equal(failed.status, 'failed_retryable');
    assert.equal(failed.leaseId, null);
    assert.equal(failed.leasedTo, null);
    await requeue(harness.baseUrl, accepted2.alphaId);
    const requeued = await getAlpha(harness.baseUrl, accepted2.alphaId);
    assert.equal(requeued.status, 'pending');
  } finally {
    await harness.cleanup();
  }
});

test('server rejects result and failure submissions when lease identity does not match', async () => {
  const harness = await startHarnessTestServer();
  try {
    const accepted = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))');
    const leased = await requestNext(harness.baseUrl, { count: 3, workerId: 'w1', brainAccount: 'a1', chromeProfile: 'p1' });
    await markRunning(harness.baseUrl, { alphaId: accepted.alphaId, leaseId: leased.leaseId });

    await assert.rejects(
      () => submitResult(harness.baseUrl, {
        alphaId: accepted.alphaId,
        leaseId: leased.leaseId,
        workerId: 'w1',
        brainAccount: 'wrong-account',
        chromeProfile: 'p1',
        settings: { delay: 1 },
        metrics: { sharpe: 1.2, fitness: 1.1 }
      }),
      /lease_identity_mismatch/
    );

    await assert.rejects(
      () => reportFailure(harness.baseUrl, {
        alphaId: accepted.alphaId,
        leaseId: leased.leaseId,
        workerId: 'w1',
        brainAccount: 'a1',
        chromeProfile: 'wrong-profile',
        retryable: true,
        failureClass: 'retryable_platform',
        failureMessage: 'temp'
      }),
      /lease_identity_mismatch/
    );
  } finally {
    await harness.cleanup();
  }
});

test('normalizeCurrentHarnessDb clears stale terminal leases and requeues 401 submission failures', async () => {
  const harness = await startHarnessTestServer();
  try {
    const alpha401 = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))');
    const alphaTerminal = await submitAlpha(harness.baseUrl, 'rank(ts_delta(open, 5))');
    const leased = await requestNext(harness.baseUrl, { count: 3, workerId: 'w1', brainAccount: 'a1', chromeProfile: 'p1' });
    await markRunning(harness.baseUrl, { alphaId: alpha401.alphaId, leaseId: leased.leaseId });
    await reportFailure(harness.baseUrl, {
      alphaId: alpha401.alphaId,
      leaseId: leased.leaseId,
      workerId: 'w1',
      brainAccount: 'a1',
      chromeProfile: 'p1',
      retryable: false,
      failureClass: 'submission_error',
      failureMessage: 'simulation_submit_failed:401:{"detail":"Incorrect authentication credentials."}'
    });

    await markRunning(harness.baseUrl, { alphaId: alphaTerminal.alphaId, leaseId: leased.leaseId });
    await reportFailure(harness.baseUrl, {
      alphaId: alphaTerminal.alphaId,
      leaseId: leased.leaseId,
      workerId: 'w1',
      brainAccount: 'a1',
      chromeProfile: 'p1',
      retryable: false,
      failureClass: 'invalid_datafield',
      failureMessage: 'bad field'
    });

    harness.repo.db.prepare("UPDATE alphas SET lease_id = 'stale-lease', leased_to = 'stale-worker' WHERE alpha_id = ?").run(alphaTerminal.alphaId);

    const summary = normalizeCurrentHarnessDb(harness.repo.db);
    assert.equal(summary.requeued401Rows, 1);
    assert.ok(summary.clearedLeaseRows >= 1);

    const updated401 = await getAlpha(harness.baseUrl, alpha401.alphaId);
    const updatedTerminal = await getAlpha(harness.baseUrl, alphaTerminal.alphaId);
    assert.equal(updated401.status, 'pending');
    assert.equal(updated401.leaseId, null);
    assert.equal(updated401.leasedTo, null);
    assert.equal(updatedTerminal.status, 'failed_terminal');
    assert.equal(updatedTerminal.leaseId, null);
    assert.equal(updatedTerminal.leasedTo, null);
  } finally {
    await harness.cleanup();
  }
});

test('admin reset endpoint moves leased and failed_retryable rows back to pending', async () => {
  const harness = await startHarnessTestServer();
  try {
    const leasedAlpha = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))');
    const retryableAlpha = await submitAlpha(harness.baseUrl, 'rank(ts_delta(open, 5))');
    const terminalAlpha = await submitAlpha(harness.baseUrl, 'rank(ts_delta(low, 5))');
    const leased = await requestNext(harness.baseUrl, { count: 3, workerId: 'w1', brainAccount: 'a1', chromeProfile: 'p1' });

    await markRunning(harness.baseUrl, { alphaId: retryableAlpha.alphaId, leaseId: leased.leaseId });
    await reportFailure(harness.baseUrl, {
      alphaId: retryableAlpha.alphaId,
      leaseId: leased.leaseId,
      workerId: 'w1',
      brainAccount: 'a1',
      chromeProfile: 'p1',
      retryable: true,
      failureClass: 'retryable_platform',
      failureMessage: 'temp'
    });

    await markRunning(harness.baseUrl, { alphaId: terminalAlpha.alphaId, leaseId: leased.leaseId });
    await reportFailure(harness.baseUrl, {
      alphaId: terminalAlpha.alphaId,
      leaseId: leased.leaseId,
      workerId: 'w1',
      brainAccount: 'a1',
      chromeProfile: 'p1',
      retryable: false,
      failureClass: 'terminal_platform',
      failureMessage: 'bad'
    });

    const summary = await resetPendingStates(harness.baseUrl);
    assert.equal(summary.status, 'accepted');
    assert.equal(summary.before.leased, 1);
    assert.equal(summary.before.failedRetryable, 1);
    assert.equal(summary.after.leased, 0);
    assert.equal(summary.after.failedRetryable, 0);

    const leasedRow = await getAlpha(harness.baseUrl, leasedAlpha.alphaId);
    const retryableRow = await getAlpha(harness.baseUrl, retryableAlpha.alphaId);
    const terminalRow = await getAlpha(harness.baseUrl, terminalAlpha.alphaId);
    assert.equal(leasedRow.status, 'pending');
    assert.equal(retryableRow.status, 'pending');
    assert.equal(terminalRow.status, 'failed_terminal');
    assert.equal(leasedRow.leaseId, null);
    assert.equal(retryableRow.leaseId, null);
  } finally {
    await harness.cleanup();
  }
});

test('server migrates legacy JSON result blobs into structured columns', async () => {
  const dir = makeTempDir('harness-legacy-db-');
  const dbPath = join(dir, 'harness.db');
  const seedDb = new DatabaseSync(dbPath);
  seedDb.exec(`
    CREATE TABLE alphas (
      alpha_id INTEGER PRIMARY KEY AUTOINCREMENT,
      expression TEXT NOT NULL,
      status TEXT NOT NULL,
      submitted_by TEXT,
      lease_id TEXT,
      leased_to TEXT,
      brain_account_id TEXT,
      chrome_profile_id TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error_class TEXT,
      last_error_message TEXT,
      function_counts TEXT NOT NULL,
      datafield_counts TEXT NOT NULL,
      operator_counts TEXT NOT NULL,
      structure_counts TEXT NOT NULL,
      max_similarity_at_submit REAL,
      closest_alpha_id_at_submit INTEGER,
      settings_json TEXT,
      metrics_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE failures (
      failure_id INTEGER PRIMARY KEY AUTOINCREMENT,
      alpha_id INTEGER NOT NULL,
      worker_id TEXT NOT NULL,
      brain_account_id TEXT,
      chrome_profile_id TEXT,
      lease_id TEXT,
      attempt_number INTEGER NOT NULL,
      failure_class TEXT NOT NULL,
      failure_message TEXT NOT NULL,
      retryable INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);
  seedDb.prepare(`
    INSERT INTO alphas (
      expression, status, submitted_by, function_counts, datafield_counts, operator_counts, structure_counts,
      max_similarity_at_submit, closest_alpha_id_at_submit, settings_json, metrics_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'rank(ts_delta(close, 5))',
    'tested',
    'agent-a',
    '{}',
    '{}',
    '{}',
    '{}',
    0,
    null,
    JSON.stringify({ delay: 1, universe: 'TOP3000' }),
    JSON.stringify({ sharpe: 1.2, fitness: 1.1, grade: 'A' }),
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  );
  seedDb.close();

  const harness = await startServer({ dbPath, port: 0 });
  try {
    const stored = await getAlpha(harness.baseUrl, 1);
    assert.equal(stored.hypothesis, null);
    assert.equal(stored.settings.delay, 1);
    assert.equal(stored.settings.universe, 'TOP3000');
    assert.equal(stored.metrics.sharpe, 1.2);
    assert.equal(stored.metrics.grade, 'A');

    const persisted = harness.repo.db.prepare(`
      SELECT hypothesis, settings_delay, settings_universe, metric_sharpe, metric_fitness, metric_grade
      FROM alphas
      WHERE alpha_id = 1
    `).get();
    assert.equal(persisted.hypothesis, null);
    assert.equal(persisted.settings_delay, 1);
    assert.equal(persisted.settings_universe, 'TOP3000');
    assert.equal(persisted.metric_sharpe, 1.2);
    assert.equal(persisted.metric_fitness, 1.1);
    assert.equal(persisted.metric_grade, 'A');

    const afterMigration = await submitAlpha(
      harness.baseUrl,
      'rank(ts_delta(open, 5))',
      'agent-b',
      'Legacy database now accepts stored hypotheses.'
    );
    const migratedStored = await getAlpha(harness.baseUrl, afterMigration.alphaId);
    assert.equal(migratedStored.hypothesis, 'Legacy database now accepts stored hypotheses.');
  } finally {
    await closeServer(harness.server);
    harness.repo.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('viewer requires basic auth', async () => {
  const harness = await startHarnessTestServer({ viewerAuth: { username: 'viewer', password: 'secret' } });
  try {
    const { response, body } = await fetchText(`${harness.baseUrl}/viewer`);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Basic realm="viewer", charset="UTF-8"');
    assert.match(body, /viewer_auth_required/);
  } finally {
    await harness.cleanup();
  }
});

test('viewer rate limits repeated unauthorized basic auth attempts', async () => {
  const harness = await startHarnessTestServer({
    viewerAuth: { username: 'viewer', password: 'secret' },
    viewerRateLimit: { maxUnauthorizedAttempts: 2, windowMs: 60_000, blockDurationMs: 5_000 }
  });
  try {
    const first = await fetchText(`${harness.baseUrl}/viewer`, {
      headers: viewerAuthHeaders('viewer', 'wrong-secret')
    });
    assert.equal(first.response.status, 401);
    assert.equal(first.response.headers.get('www-authenticate'), 'Basic realm="viewer", charset="UTF-8"');
    assert.match(first.body, /viewer_auth_required/);

    const second = await fetchText(`${harness.baseUrl}/viewer`, {
      headers: viewerAuthHeaders('viewer', 'wrong-secret')
    });
    assert.equal(second.response.status, 401);
    assert.match(second.body, /viewer_auth_required/);

    const third = await fetchText(`${harness.baseUrl}/viewer`, {
      headers: viewerAuthHeaders('viewer', 'wrong-secret')
    });
    assert.equal(third.response.status, 429);
    assert.equal(third.response.headers.get('retry-after'), '5');
    assert.match(third.body, /viewer_rate_limited/);
  } finally {
    await harness.cleanup();
  }
});

test('viewer serves authenticated read-only html with security headers and allowlisted fields', async () => {
  const harness = await startHarnessTestServer({ viewerAuth: { username: 'viewer', password: 'secret' } });
  try {
    const accepted = await submitAlpha(
      harness.baseUrl,
      'rank(ts_delta(close, 5))',
      'agent-a',
      'Public thesis for tested alpha.'
    );
    const leased = await requestNext(harness.baseUrl, { count: 1, workerId: 'worker-a', brainAccount: 'brain-a', chromeProfile: 'profile-a' });
    await markRunning(harness.baseUrl, { alphaId: accepted.alphaId, leaseId: leased.leaseId });
    await submitResult(harness.baseUrl, {
      alphaId: accepted.alphaId,
      leaseId: leased.leaseId,
      workerId: 'worker-a',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      settings: { delay: 1, universe: 'TOP3000' },
      metrics: { sharpe: 1.2, fitness: 0.9, grade: 'A' }
    });

    const { response, body } = await fetchText(`${harness.baseUrl}/viewer/alphas/${accepted.alphaId}`, {
      headers: viewerAuthHeaders()
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(body, /Harness viewer alpha/);
    assert.match(body, /Public thesis for tested alpha/);
    assert.match(body, /TOP3000/);
    assert.match(body, /1\.2/);
    assert.doesNotMatch(body, /worker-a/);
    assert.doesNotMatch(body, /brain-a/);
    assert.doesNotMatch(body, /profile-a/);
    assert.doesNotMatch(body, new RegExp(leased.leaseId));
  } finally {
    await harness.cleanup();
  }
});

test('viewer escapes html and omits raw failure messages', async () => {
  const harness = await startHarnessTestServer({ viewerAuth: { username: 'viewer', password: 'secret' } });
  try {
    const hypothesis = '<img src=x onerror=alert(1)>';
    const accepted = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a', hypothesis);
    const leased = await requestNext(harness.baseUrl, { count: 1, workerId: 'worker-a', brainAccount: 'brain-a', chromeProfile: 'profile-a' });
    await markRunning(harness.baseUrl, { alphaId: accepted.alphaId, leaseId: leased.leaseId });
    await reportFailure(harness.baseUrl, {
      alphaId: accepted.alphaId,
      leaseId: leased.leaseId,
      workerId: 'worker-a',
      brainAccount: 'brain-a',
      chromeProfile: 'profile-a',
      retryable: false,
      failureClass: 'submission_error',
      failureMessage: '<script>top-secret failure</script>'
    });

    const { response, body } = await fetchText(`${harness.baseUrl}/viewer/alphas/${accepted.alphaId}`, {
      headers: viewerAuthHeaders()
    });
    assert.equal(response.status, 200);
    assert.match(body, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(body, /<img src=x onerror=alert\(1\)>/);
    assert.match(body, /submission_error/);
    assert.doesNotMatch(body, /top-secret failure/);
    assert.doesNotMatch(body, /<script>/);
  } finally {
    await harness.cleanup();
  }
});

test('viewer auth does not change existing private json api behavior', async () => {
  const harness = await startHarnessTestServer({ viewerAuth: { username: 'viewer', password: 'secret' } });
  try {
    const accepted = await submitAlpha(harness.baseUrl, 'rank(ts_delta(close, 5))', 'agent-a', 'Private API still works.');
    const stored = await getAlpha(harness.baseUrl, accepted.alphaId);
    assert.equal(stored.submittedBy, 'agent-a');
    assert.equal(stored.hypothesis, 'Private API still works.');
    assert.equal(stored.status, 'pending');
  } finally {
    await harness.cleanup();
  }
});
