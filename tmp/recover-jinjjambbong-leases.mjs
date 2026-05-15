import { DatabaseSync } from 'node:sqlite';

const dbPath = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
const workerId = '진짬뽕';
const timestamp = new Date().toISOString();

const db = new DatabaseSync(dbPath);

const before = db.prepare("SELECT status, COUNT(*) AS count FROM alphas WHERE leased_to = ? GROUP BY status ORDER BY status").all(workerId);
console.log('before_by_status=', JSON.stringify(before, null, 2));

const rows = db.prepare("SELECT alpha_id, status, lease_id, lease_id IS NOT NULL AS has_lease FROM alphas WHERE leased_to = ? AND status IN ('leased', 'running') ORDER BY status, alpha_id").all(workerId);
console.log('target_count=', rows.length);
console.log('target_rows=', JSON.stringify(rows.slice(0, 200), null, 2));

if (rows.length === 0) {
  console.log('no_recovery_needed');
  process.exit(0);
}

db.exec('BEGIN IMMEDIATE');
try {
  const result = db.prepare(`
    UPDATE alphas
    SET status = 'pending',
        lease_id = NULL,
        leased_to = NULL,
        updated_at = ?
    WHERE leased_to = ?
      AND status IN ('leased', 'running')
  `).run(timestamp, workerId);
  db.exec('COMMIT');
  console.log(`recovered=${result.changes}`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const after = db.prepare("SELECT status, COUNT(*) AS count FROM alphas WHERE leased_to = ? GROUP BY status ORDER BY status").all(workerId);
console.log('after_by_status=', JSON.stringify(after, null, 2));

const pendingCount = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE leased_to IS NULL AND status='pending'").get();
console.log('pending_total=', pendingCount.count);

const samplePending = db.prepare("SELECT alpha_id, status, lease_id, leased_to, attempt_count FROM alphas WHERE status = 'pending' ORDER BY alpha_id LIMIT 30").all();
console.log('sample_pending=', JSON.stringify(samplePending, null, 2));
