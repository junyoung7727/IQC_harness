import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const dbPath = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

const before = db.prepare('SELECT status, COUNT(*) AS count FROM alphas GROUP BY status').all();
console.log('before', JSON.stringify(before));

const timestamp = new Date().toISOString();

db.exec('BEGIN IMMEDIATE');
try {
  const pendingToTested = db.prepare("UPDATE alphas SET status = 'tested', lease_id = NULL, leased_to = NULL, updated_at = ? WHERE status = 'pending'")
    .run(timestamp);
  const failedToPending = db.prepare("UPDATE alphas SET status = 'pending', lease_id = NULL, leased_to = NULL, updated_at = ? WHERE status IN ('failed_retryable', 'failed_terminal')")
    .run(timestamp);
  db.exec('COMMIT');

  console.log(`pending_to_tested=${pendingToTested.changes}`);
  console.log(`failed_to_pending=${failedToPending.changes}`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const after = db.prepare('SELECT status, COUNT(*) AS count FROM alphas GROUP BY status').all();
console.log('after', JSON.stringify(after));
const remainingPending = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status = 'pending'").get();
const remainingTested = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status = 'tested'").get();
console.log(`remaining_pending=${remainingPending.count}`);
console.log(`remaining_tested=${remainingTested.count}`);
