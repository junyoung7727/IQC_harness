import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/harness.db');

const rows = db.prepare(
  'SELECT alpha_id, expression, status, submitted_by, max_similarity_at_submit, closest_alpha_id_at_submit, attempt_count, metric_simulation_status FROM alphas WHERE submitted_by = ? AND alpha_id IN (807,809,811,813,815) ORDER BY alpha_id'
).all('generator-agent-8');

for (const row of rows) {
  console.log(JSON.stringify(row));
}
