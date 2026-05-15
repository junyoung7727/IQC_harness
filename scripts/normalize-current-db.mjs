import { openDatabase } from '../src/harness/db.js';
import { normalizeCurrentHarnessDb } from '../src/harness/admin.js';

const dbPath = process.argv[2] ?? 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
const db = openDatabase(dbPath);
try {
  const summary = normalizeCurrentHarnessDb(db);
  console.log(JSON.stringify({ dbPath, ...summary }, null, 2));
} finally {
  db.close();
}
