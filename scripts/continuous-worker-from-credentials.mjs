#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { runWorkerLoop } from '../src/harness/worker.js';
import { findLoginEntryByIdAndPassword } from '../src/harness/login-map.js';

const DEFAULT_SERVER_URL = 'http://127.0.0.1:3000';
const DEFAULT_BRAIN_URL = 'https://platform.worldquantbrain.com';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_ERROR_RETRY_MS = 30000;

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) {
      throw new Error(`unknown_argument:${token}`);
    }
    const key = token.slice(2);
    if (key === 'help' || key === 'h') {
      flags.help = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing_value_for_${key}`);
    }
    flags[key] = value;
    i += 1;
  }
  return flags;
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === false) return value;
  return String(value).toLowerCase() === 'true';
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function safeWorkerId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function logLine(prefix, message) {
  return `[${new Date().toISOString()}] [${prefix}] ${message}`;
}

function defaultChromeProfile(brainAccount) {
  return path.join(os.tmpdir(), 'worldquant-multi-agent-harness', 'chrome-profiles', safeWorkerId(brainAccount));
}

function usage() {
  return [
    'Usage:',
    '  npm run worker:continuous -- --brain-id <account-id> --brain-password <password> [options]',
    '',
    'Required:',
    '  --brain-id            WorldQuant account id',
    '  --brain-password      WorldQuant password',
    '',
    'Optional:',
    '  --server-url          Harness server URL (default: http://127.0.0.1:3000)',
    '  --brain-url           WorldQuant brain URL (default: https://platform.worldquantbrain.com)',
    '  --worker-id           Worker id (default: worker-<safe brain-id>)',
    '  --chrome-profile      Chrome profile dir override (default: login map or temp profile)',
    '  --concurrency         Batch size for each requestNext call (default: 3)',
    '  --poll-interval-ms    Delay when queue is empty (default: 5000)',
    '  --error-retry-ms      Delay after unexpected loop errors (default: 30000)',
    '  --headed              true|false (default: false)',
    '  --requeue-retryable   true|false (default: false)'
  ].join('\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const brainAccount = flags['brain-id'];
  const password = flags['brain-password'];

  if (!brainAccount || !password) {
    throw new Error('missing_required_arg: --brain-id and --brain-password are required');
  }

  const loginEntry = findLoginEntryByIdAndPassword({ brainAccount, password });

  const serverUrl = flags['server-url'] ?? DEFAULT_SERVER_URL;
  const brainUrl = flags['brain-url'] ?? DEFAULT_BRAIN_URL;
  const workerId = flags['worker-id'] ?? `worker-${safeWorkerId(brainAccount)}`;
  const chromeProfile = flags['chrome-profile'] ?? loginEntry?.chromeProfileDir ?? defaultChromeProfile(brainAccount);
  const brainCredentials = {
    id: loginEntry?.id ?? brainAccount,
    password: loginEntry?.password ?? password
  };
  const concurrency = toNumber(flags.concurrency, 3);
  const pollIntervalMs = toNumber(flags['poll-interval-ms'], DEFAULT_POLL_INTERVAL_MS);
  const errorRetryMs = toNumber(flags['error-retry-ms'], DEFAULT_ERROR_RETRY_MS);
  const headed = parseBoolean(flags.headed, false);
  const requeueRetryable = parseBoolean(flags['requeue-retryable'], false);

  const credentialSource = loginEntry ? 'login-map' : 'cli';
  process.stdout.write(`${logLine('INFO', `resolved worker ${workerId} for brain ${brainAccount} (profile=${chromeProfile}, credentials=${credentialSource}, concurrency=${concurrency})`)}\n`);

  let shouldStop = false;
  process.on('SIGINT', () => {
    shouldStop = true;
    process.stdout.write(`${logLine('INFO', 'received SIGINT, shutting down after current cycle')}\n`);
  });

  while (!shouldStop) {
    try {
      const processed = await runWorkerLoop({
        serverUrl,
        workerId,
        brainAccount,
        chromeProfile,
        brainCredentials,
        brainUrl,
        headed,
        requeueRetryable,
        concurrency,
        logger: (line) => {
          process.stdout.write(`${logLine('WORKER', line)}\n`);
        },
        shouldStop: () => shouldStop
      });

      if (processed.length === 0) {
        if (!shouldStop) {
          process.stdout.write(`${logLine('WAIT', `no work, sleep ${pollIntervalMs}ms`)}\n`);
          await sleep(pollIntervalMs);
        }
      } else {
        process.stdout.write(`${logLine('BATCH', `processed=${processed.length} items`)}\n`);
      }
    } catch (error) {
      process.stderr.write(`${logLine('ERROR', `worker_error: ${error.message}`)}\n`);
      if (!shouldStop) {
        await sleep(errorRetryMs);
      }
    }
  }

  process.stdout.write(`${logLine('INFO', 'worker loop stopped')}\n`);
}

main().catch((error) => {
  process.stderr.write(`${logLine('FATAL', `failed: ${error.message}`)}\n`);
  process.exit(1);
});
