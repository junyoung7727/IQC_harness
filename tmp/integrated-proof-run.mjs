import { rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startServer } from '../src/harness/server.js';
import { getAlpha, requestNext } from '../src/harness/client.js';

const execFileAsync = promisify(execFile);
async function runCli(args, cwd) {
  const { stdout, stderr } = await execFileAsync('node', ['src/harness/cli.js', ...args], { cwd, timeout: 1800000 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

const projectDir = 'C:/Users/user/worldquant-multi-agent-harness';
const dbPath = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
const generated = [
  'rank(close / ts_mean(close, 5) - 1)',
  '-ts_rank(volume, 10)',
  'rank((high - low) / close)',
  'ts_delta(vwap, 3) / vwap'
];

rmSync(dbPath, { force: true });
const started = await startServer({ dbPath, port: 3930 });

try {
  const serverUrl = started.baseUrl;
  const submits = [];
  for (const expr of generated) {
    submits.push(await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', expr, '--submitted-by', 'spawned-agent-1'], projectDir));
  }

  const worker1 = runCli([
    'worker', 'run', '--server-url', serverUrl,
    '--worker-id', 'worker-yukgaejang',
    '--brain-account', 'junyoung727@uos.ac.kr',
    '--chrome-profile', 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/yukgaejang',
    '--brain-url', 'https://platform.worldquantbrain.com'
  ], projectDir);

  const worker2 = runCli([
    'worker', 'run', '--server-url', serverUrl,
    '--worker-id', 'worker-saewootang',
    '--brain-account', 'mask.27-e61ff11f@phuturemail.com',
    '--chrome-profile', 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang',
    '--brain-url', 'https://platform.worldquantbrain.com'
  ], projectDir);

  const [w1, w2] = await Promise.all([worker1, worker2]);
  const finalRequest = await requestNext(serverUrl, {
    count: 3,
    workerId: 'post-proof-check',
    brainAccount: 'junyoung727@uos.ac.kr',
    chromeProfile: 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/yukgaejang'
  });
  const states = await Promise.all([1, 2, 3, 4].map((id) => getAlpha(serverUrl, id)));

  console.log('--- GENERATED EXPRESSIONS ---');
  for (const expr of generated) console.log(expr);
  console.log('--- SUBMIT RESULTS ---');
  for (const entry of submits) console.log(entry.stdout);
  console.log('--- WORKER 1 OUTPUT ---');
  console.log(w1.stdout);
  console.log('--- WORKER 2 OUTPUT ---');
  console.log(w2.stdout);
  console.log('--- FINAL REQUEST ---');
  console.log(JSON.stringify(finalRequest, null, 2));
  console.log('--- FINAL STATES ---');
  console.log(JSON.stringify(states.map((s) => ({
    alphaId: s.alphaId,
    expression: s.expression,
    status: s.status,
    leasedTo: s.leasedTo,
    brainAccountId: s.brainAccountId,
    chromeProfileId: s.chromeProfileId,
    metrics: s.metrics,
    lastErrorClass: s.lastErrorClass,
    lastErrorMessage: s.lastErrorMessage
  })), null, 2));
} finally {
  await new Promise((resolve) => started.server.close(resolve));
  started.repo.db.close();
}
