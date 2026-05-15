import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const status = db.prepare("SELECT status, COUNT(*) AS count FROM alphas GROUP BY status ORDER BY status").all();
const leased = db.prepare("SELECT leased_to, status, COUNT(*) AS count FROM alphas WHERE leased_to IS NOT NULL GROUP BY leased_to, status ORDER BY leased_to, status").all();
const jinjj = db.prepare(
  "SELECT alpha_id, status, lease_id, leased_to, brain_account_id, chrome_profile_id, attempt_count, last_error_class FROM alphas WHERE leased_to = ? ORDER BY alpha_id"
).all('진짬뽕');

console.log('status_counts=', JSON.stringify(status, null, 2));
console.log('leased_groups=', JSON.stringify(leased, null, 2));
console.log('jinjjambbong_count=', jinjj.length);
console.log('jinjjambbong_rows=', JSON.stringify(jinjj, null, 2));
