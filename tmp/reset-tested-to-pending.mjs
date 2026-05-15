import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const dbPath = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

const before = db.prepare("SELECT status, COUNT(*) AS count FROM alphas GROUP BY status").all();
console.log('before', JSON.stringify(before));

const timestamp = new Date().toISOString();
db.exec("BEGIN IMMEDIATE");
try {
  const result = db.prepare("UPDATE alphas SET status = 'pending', lease_id = NULL, leased_to = NULL, updated_at = ? WHERE status = 'tested'")
    .run(timestamp);
  db.exec("COMMIT");
  console.log(`updated_count=${result.changes}`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const after = db.prepare("SELECT status, COUNT(*) AS count FROM alphas GROUP BY status").all();
console.log('after', JSON.stringify(after));
const remainingTested = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status = 'tested'").get();
console.log(`remaining_tested=${remainingTested.count}`);
