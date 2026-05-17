import { markRunning } from '../src/harness/client.js';
import { runBrainSimulation } from '../src/harness/brain.js';
import { spawnSync } from 'node:child_process';

const serverUrl = process.env.SERVER_URL ?? 'http://127.0.0.1:3000';
const workerId = '새우탕';
const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\saewootang';

function parseCliOutput(stdout) {
  const parsed = {};
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    if (key === 'items') {
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        parsed[key] = [];
      }
      continue;
    }
    parsed[key] = value;
  }
  return parsed;
}

function runCli(args) {
  const proc = spawnSync('node', ['src/harness/cli.js', ...args], {
    encoding: 'utf8',
    cwd: 'C:/Users/user/worldquant-multi-agent-harness',
    maxBuffer: 20 * 1024 * 1024
  });
  if (proc.error) {
    throw new Error(`cli_exec_error:${proc.error.message}`);
  }
  if (proc.status !== 0) {
    const stderr = (proc.stderr || '').trim();
    throw new Error(`cli_exit_${proc.status}:${stderr || 'unknown'}`);
  }
  return parseCliOutput((proc.stdout || '').trim());
}

async function requestNext() {
  return runCli([
    'request',
    'next',
    'alpha',
    '3',
    '--server-url',
    serverUrl,
    '--worker-id',
    workerId,
    '--brain-account',
    brainAccount,
    '--chrome-profile',
    chromeProfile
  ]);
}

async function submitResult(alphaId, leaseId, settings, metrics) {
  return runCli([
    'submit',
    'result',
    '--server-url',
    serverUrl,
    '--alpha-id',
    String(alphaId),
    '--lease-id',
    leaseId,
    '--worker-id',
    workerId,
    '--brain-account',
    brainAccount,
    '--chrome-profile',
    chromeProfile,
    '--settings',
    JSON.stringify(settings),
    '--metrics',
    JSON.stringify(metrics)
  ]);
}

async function reportFailure(alphaId, leaseId, retryable, failureClass, errorMessage) {
  return runCli([
    'report',
    'failure',
    '--server-url',
    serverUrl,
    '--alpha-id',
    String(alphaId),
    '--lease-id',
    leaseId,
    '--worker-id',
    workerId,
    '--brain-account',
    brainAccount,
    '--chrome-profile',
    chromeProfile,
    '--retryable',
    String(Boolean(retryable)),
    '--failure-class',
    failureClass,
    '--error',
    errorMessage
  ]);
}

function printLoopReport({ count, leaseId, batchItems, successSubmissions, failureSubmissions }) {
  if (count === 0) {
    console.log('- request_result: status=ok, count=0, lease_id=' + (leaseId || ''));
    console.log('- leased_alpha_ids: []');
    console.log('- success_submissions: []');
    console.log('- failure_submissions: []');
    console.log('- next_action: queue empty, worker stop');
    console.log('queue empty, worker stop');
    return;
  }

  const leasedAlphaIds = batchItems.map((item) => item.alphaId);
  console.log(`- request_result: status=ok, count=${count}, lease_id=${leaseId}`);
  console.log(`- leased_alpha_ids: ${JSON.stringify(leasedAlphaIds)}`);
  console.log(`- success_submissions: ${JSON.stringify(successSubmissions)}`);
  console.log(`- failure_submissions: ${JSON.stringify(failureSubmissions)}`);
  console.log('- next_action: request next alpha 3');
}

async function processBatch(batch) {
  const count = Number(batch.count ?? 0);
  const leaseId = batch.leaseId || '';
  const items = Array.isArray(batch.items) ? batch.items : [];
  const successSubmissions = [];
  const failureSubmissions = [];

  for (const item of items) {
    try {
      await markRunning(serverUrl, { alphaId: item.alphaId, leaseId });
    } catch (error) {
      failureSubmissions.push({ alphaId: item.alphaId, state: 'failed_mark_running', error: error.message });
      continue;
    }

    try {
      const result = await runBrainSimulation({
        brainAccount,
        chromeProfile,
        expression: item.expression,
        headed: false
      });
      const submitted = await submitResult(item.alphaId, leaseId, result.settings, result.metrics);
      successSubmissions.push({
        alphaId: item.alphaId,
        state: submitted.state,
        metrics: result.metrics
      });
    } catch (error) {
      const retryable = Boolean(error.retryable);
      const failureClass = error.failureClass || 'execution_error';
      const message = error.message || 'unknown_error';
      try {
        const reported = await reportFailure(item.alphaId, leaseId, retryable, failureClass, message);
        failureSubmissions.push({
          alphaId: item.alphaId,
          state: reported.state,
          retryable,
          failureClass,
          error: message
        });
      } catch (reportError) {
        failureSubmissions.push({
          alphaId: item.alphaId,
          state: 'report_failed',
          retryable,
          failureClass,
          error: reportError.message
        });
      }
    }
  }

  printLoopReport({
    count,
    leaseId,
    batchItems: items,
    successSubmissions,
    failureSubmissions
  });
}

async function main() {
  while (true) {
    const batch = await requestNext();
    batch.count = Number(batch.count ?? 0);
    batch.leaseId = batch.leaseId || '';
    batch.items = Array.isArray(batch.items) ? batch.items : [];

    if (batch.count === 0) {
      printLoopReport({
        count: 0,
        leaseId: batch.leaseId,
        batchItems: [],
        successSubmissions: [],
        failureSubmissions: []
      });
      return;
    }

    if (batch.count > 0) {
      await processBatch(batch);
    }
  }
}

await main();
