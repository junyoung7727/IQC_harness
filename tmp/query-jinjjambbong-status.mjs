import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const byWorker = db.prepare("SELECT leased_to, status, COUNT(*) AS count FROM alphas WHERE leased_to = '진짬뽕' GROUP BY leased_to, status ORDER BY status").all();
console.log('by_worker_status=', JSON.stringify(byWorker, null, 2));

const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM alphas GROUP BY status ORDER BY status').all();
console.log('by_status=', JSON.stringify(byStatus, null, 2));

const pendingTotal = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status='pending'").get().count;
console.log('pending_total=', pendingTotal);

const pendingUnleased = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE leased_to IS NULL AND status='pending'").get().count;
console.log('pending_unleased=', pendingUnleased);

const pendingByWorker = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE leased_to='진짬뽕' AND status='pending'").get().count;
console.log('pending_by_worker=', pendingByWorker);

const leasedOrRunningByWorker = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE leased_to='진짬뽕' AND status IN ('leased','running')").get().count;
console.log('leased_or_running_by_worker=', leasedOrRunningByWorker);
