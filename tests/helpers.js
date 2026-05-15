import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/harness/server.js';

export function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export async function startHarnessTestServer(prefix = 'harness-db-') {
  const dir = makeTempDir(prefix);
  const dbPath = join(dir, 'harness.db');
  const started = await startServer({ dbPath, port: 0 });
  return {
    ...started,
    async cleanup() {
      await new Promise((resolve) => started.server.close(resolve));
      started.repo.db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
