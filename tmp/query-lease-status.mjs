import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const leasedGroups = db
  .prepare("SELECT lease_id, leased_to, COUNT(*) as cnt FROM alphas WHERE leased_to = ? AND status = 'leased' GROUP BY lease_id, leased_to")
  .all('진짬뽕');
console.log('leased_groups', JSON.stringify(leasedGroups, null, 2));

const leasedDetail = db
  .prepare("SELECT alpha_id, lease_id, leased_to, status, created_at FROM alphas WHERE leased_to = ? AND status = 'leased' ORDER BY lease_id, alpha_id")
  .all('진짬뽕');
console.log('leased_detail', JSON.stringify(leasedDetail, null, 2));
