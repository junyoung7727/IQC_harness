import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/harness.db');

const batch = db.prepare(
  "SELECT COUNT(*) as c FROM alphas WHERE alpha_id BETWEEN 768 AND 777 AND submitted_by='generator-agent-8'"
).get();
const latest = db.prepare(
  "SELECT MAX(alpha_id) as m FROM alphas WHERE submitted_by='generator-agent-8'"
).get();

console.log(`batch_count_768_777=${batch.c}`);
console.log(`latest_id=${latest.m}`);
