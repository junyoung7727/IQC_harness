import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/harness/server.js';

export function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export async function startHarnessTestServer(optionsOrPrefix = 'harness-db-') {
  const options = typeof optionsOrPrefix === 'string'
    ? { prefix: optionsOrPrefix }
    : { ...(optionsOrPrefix ?? {}) };
  const dir = makeTempDir(options.prefix ?? 'harness-db-');
  const dbPath = join(dir, 'harness.db');
  const started = await startServer({ ...options, dbPath, port: 0 });
  return {
    ...started,
    async cleanup() {
      await new Promise((resolve) => started.server.close(resolve));
      started.repo.db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
