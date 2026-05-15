#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { submitAlpha, requestNext, submitResult, reportFailure } from './client.js';
import { startServer } from './server.js';
import { runWorkerLoop } from './worker.js';

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const value = args[i + 1];
    flags[key.slice(2)] = value;
    i += 1;
  }
  return flags;
}

function requireFlag(flags, name) {
  if (!flags[name]) throw new Error(`missing_flag_${name}`);
  return flags[name];
}

function output(lines) {
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main() {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  if (command === 'server' && subcommand === 'start') {
    const flags = parseFlags(rest);
    const dbPath = resolve(flags['db-path'] ?? './data/harness.db');
    mkdirSync(dirname(dbPath), { recursive: true });
    const port = Number(flags.port ?? '3000');
    const result = await startServer({ dbPath, port });
    output([`status=accepted`, `port=${result.port}`, `db_path=${dbPath}`]);
    return;
  }

  const flags = parseFlags(rest);
  const serverUrl = flags['server-url'] ?? 'http://127.0.0.1:3000';

  if (command === 'submit' && subcommand === 'alpha') {
    const result = await submitAlpha(
      serverUrl,
      requireFlag(flags, 'expr'),
      flags['submitted-by'] ?? null,
      flags.hypothesis ?? null
    );
    if (result.status === 'accepted') {
      output([
        'status=accepted',
        `alpha_id=${result.alphaId}`,
        `state=${result.state}`,
        `max_similarity=${result.maxSimilarity}`
      ]);
      return;
    }
    output([
      'status=rejected_similarity',
      `closest_alpha_id=${result.closestAlphaId}`,
      `max_similarity=${result.maxSimilarity}`,
      `threshold=${result.threshold}`
    ]);
    return;
  }

  if (command === 'request' && subcommand === 'next' && rest[0] === 'alpha' && rest[1] === '3') {
    const result = await requestNext(serverUrl, {
      count: 3,
      workerId: requireFlag(flags, 'worker-id'),
      brainAccount: requireFlag(flags, 'brain-account'),
      chromeProfile: requireFlag(flags, 'chrome-profile')
    });
    output([
      'status=ok',
      `count=${result.count}`,
      `lease_id=${result.leaseId ?? ''}`,
      `items=${JSON.stringify(result.items)}`
    ]);
    return;
  }

  if (command === 'submit' && subcommand === 'result') {
    const result = await submitResult(serverUrl, {
      alphaId: Number(requireFlag(flags, 'alpha-id')),
      leaseId: requireFlag(flags, 'lease-id'),
      workerId: requireFlag(flags, 'worker-id'),
      brainAccount: requireFlag(flags, 'brain-account'),
      chromeProfile: requireFlag(flags, 'chrome-profile'),
      settings: JSON.parse(requireFlag(flags, 'settings')),
      metrics: JSON.parse(requireFlag(flags, 'metrics'))
    });
    output(['status=accepted', `alpha_id=${result.alphaId}`, `state=${result.state}`]);
    return;
  }

  if (command === 'report' && subcommand === 'failure') {
    const result = await reportFailure(serverUrl, {
      alphaId: Number(requireFlag(flags, 'alpha-id')),
      leaseId: requireFlag(flags, 'lease-id'),
      workerId: requireFlag(flags, 'worker-id'),
      brainAccount: requireFlag(flags, 'brain-account'),
      chromeProfile: requireFlag(flags, 'chrome-profile'),
      retryable: requireFlag(flags, 'retryable') === 'true',
      failureClass: flags['failure-class'] ?? 'execution_error',
      failureMessage: requireFlag(flags, 'error')
    });
    output(['status=accepted', `alpha_id=${result.alphaId}`, `state=${result.state}`]);
    return;
  }

  if (command === 'worker' && subcommand === 'run') {
    const result = await runWorkerLoop({
      serverUrl,
      workerId: requireFlag(flags, 'worker-id'),
      brainAccount: requireFlag(flags, 'brain-account'),
      chromeProfile: requireFlag(flags, 'chrome-profile'),
      brainUrl: requireFlag(flags, 'brain-url'),
      headed: flags.headed === 'true',
      requeueRetryable: flags['requeue-retryable'] === 'true'
    });
    output(['status=accepted', `processed=${JSON.stringify(result)}`]);
    return;
  }

  throw new Error('unknown_command');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
