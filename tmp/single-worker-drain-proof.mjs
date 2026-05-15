import { rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startServer } from '../src/harness/server.js';
import { requestNext, getAlpha } from '../src/harness/client.js';

const execFileAsync = promisify(execFile);
async function runCli(args, cwd) {
  const { stdout } = await execFileAsync('node', ['src/harness/cli.js', ...args], { cwd, timeout: 1200000 });
  return stdout.trim();
}

const projectDir = 'C:/Users/user/worldquant-multi-agent-harness';
const dbPath = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
rmSync(dbPath, { force: true });
const started = await startServer({ dbPath, port: 3920 });

try {
  const serverUrl = started.baseUrl;
  const generated = [
    'rank(ts_delta(close,5))',
    '-ts_rank(volume,10)',
    'rank((close-open)/(high-low+0.01))'
  ];

  const submitLogs = [];
  for (const expr of generated) {
    submitLogs.push(await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', expr, '--submitted-by', 'spawned-agent-1'], projectDir));
  }

  const workerLog = await runCli([
    'worker', 'run', '--server-url', serverUrl,
    '--worker-id', 'single-drain-worker',
    '--brain-account', 'junyoung727@uos.ac.kr',
    '--chrome-profile', 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/yukgaejang',
    '--brain-url', 'https://platform.worldquantbrain.com'
  ], projectDir);

  const finalRequest = await requestNext(serverUrl, {
    count: 3,
    workerId: 'post-drain-check',
    brainAccount: 'junyoung727@uos.ac.kr',
    chromeProfile: 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/yukgaejang'
  });

  const states = await Promise.all([1, 2, 3].map((id) => getAlpha(serverUrl, id)));

  console.log('--- GENERATED EXPRESSIONS ---');
  for (const expr of generated) console.log(expr);
  console.log('--- SUBMIT LOGS ---');
  for (const line of submitLogs) console.log(line);
  console.log('--- WORKER LOG ---');
  console.log(workerLog);
  console.log('--- FINAL REQUEST ---');
  console.log(JSON.stringify(finalRequest, null, 2));
  console.log('--- FINAL STATES ---');
  console.log(JSON.stringify(states, null, 2));
} finally {
  await new Promise((resolve) => started.server.close(resolve));
  started.repo.db.close();
}
