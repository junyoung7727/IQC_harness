import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const statusRows = db.prepare('SELECT status, COUNT(*) AS count FROM alphas GROUP BY status ORDER BY status').all();
console.log('status_counts=', JSON.stringify(statusRows, null, 2));

const pendingCount = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status='pending'").get().count;
console.log('pending_count=', pendingCount);

const pendingSamples = db.prepare("SELECT alpha_id, leased_to, last_error_class, last_error_message FROM alphas WHERE status='pending' ORDER BY alpha_id LIMIT 5").all();
console.log('sample_pending=', JSON.stringify(pendingSamples, null, 2));
