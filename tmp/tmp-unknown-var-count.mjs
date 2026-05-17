import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');
const rows = db
  .prepare(
    "SELECT alpha_id,last_error_message FROM alphas WHERE status='failed_terminal' AND last_error_message LIKE 'Attempted to use unknown variable %'"
  )
  .all();

function normalize(variable) {
  const m = variable.match(/^(.*?)(_\d+)?$/);
  return m ? m[1] : variable;
}

const byField = new Map();
for (const row of rows) {
  const msg = String(row.last_error_message || '');
  const match = msg.match(/Attempted to use unknown variable \"([^\"]+)\"/);
  const variable = match ? match[1] : '<<parse-fail>>';
  const normalized = normalize(variable);
  byField.set(normalized, (byField.get(normalized) || 0) + 1);
}

const sorted = [...byField.entries()].sort((a, b) => b[1] - a[1]);
console.log('entries', rows.length);
for (const [field, count] of sorted) {
  console.log(`${count}\t${field}`);
}
