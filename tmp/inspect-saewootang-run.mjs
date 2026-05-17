import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const ids = [757, 758, 759, 755, 756, 760, 14, 15, 16];
const rows = db.prepare(`SELECT alpha_id,status,lease_id,leased_to,brain_account_id,chrome_profile_id,attempt_count,last_error_class FROM alphas WHERE alpha_id IN (${ids.join(',')}) ORDER BY alpha_id`).all();
console.log('rows', JSON.stringify(rows, null, 2));

const toInt = (row) => Number(row?.count ?? 0);

const saew = db.prepare("SELECT COUNT(*) as count FROM alphas WHERE leased_to='새우탕'").get();
const running = db.prepare("SELECT COUNT(*) as count FROM alphas WHERE status='running' AND leased_to='새우탕'").get();
const leased = db.prepare("SELECT COUNT(*) as count FROM alphas WHERE status='leased' AND leased_to='새우탕'").get();
const pending = db.prepare("SELECT COUNT(*) as count FROM alphas WHERE status='pending'").get();

console.log(
  'summary',
  JSON.stringify(
    {
      saewottang_assigned_total: toInt(saew),
      running_total: toInt(running),
      leased_total: toInt(leased),
      pending_total: toInt(pending)
    },
    null,
    2
  )
);

const byLease = db
  .prepare("SELECT lease_id, leased_to, status, COUNT(*) as count FROM alphas WHERE leased_to='새우탕' GROUP BY lease_id,leased_to,status ORDER BY lease_id")
  .all();
console.log('leaseGroups', JSON.stringify(byLease, null, 2));
