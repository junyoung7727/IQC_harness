import { rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startServer } from '../src/harness/server.js';
import { getAlpha, requestNext } from '../src/harness/client.js';

const execFileAsync = promisify(execFile);

async function runCli(args, cwd) {
  const { stdout, stderr } = await execFileAsync('node', ['src/harness/cli.js', ...args], { cwd, timeout: 1200000 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

const projectDir = 'C:/Users/user/worldquant-multi-agent-harness';
const dbPath = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
rmSync(dbPath, { force: true });
const started = await startServer({ dbPath, port: 3910 });

try {
  const serverUrl = started.baseUrl;
  const submits = [];
  submits.push(await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', 'sales/cap', '--submitted-by', 'gen-a'], projectDir));
  submits.push(await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', 'sales', '--submitted-by', 'gen-a'], projectDir));
  submits.push(await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', 'cap', '--submitted-by', 'gen-a'], projectDir));
  submits.push(await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', 'close', '--submitted-by', 'gen-a'], projectDir));
  const duplicate = await runCli(['submit', 'alpha', '--server-url', serverUrl, '--expr', 'sales/cap', '--submitted-by', 'gen-b'], projectDir);

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
  const alphas = await Promise.all([1, 2, 3, 4].map((id) => getAlpha(serverUrl, id)));
  const finalRequest = await requestNext(serverUrl, {
    count: 3,
    workerId: 'worker-check',
    brainAccount: 'junyoung727@uos.ac.kr',
    chromeProfile: 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/yukgaejang'
  });

  console.log('--- SUBMITS ---');
  for (const s of submits) console.log(s.stdout);
  console.log('--- DUPLICATE ---');
  console.log(duplicate.stdout);
  console.log('--- WORKER 1 ---');
  console.log(w1.stdout);
  console.log('--- WORKER 2 ---');
  console.log(w2.stdout);
  console.log('--- FINAL ALPHAS ---');
  console.log(JSON.stringify(alphas, null, 2));
  console.log('--- FINAL REQUEST ---');
  console.log(JSON.stringify(finalRequest, null, 2));
} finally {
  await new Promise((resolve) => started.server.close(resolve));
  started.repo.db.close();
}
