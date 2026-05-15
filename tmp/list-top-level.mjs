import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/harness.db');
const rows = db
  .prepare("SELECT expression,status FROM alphas WHERE status='accepted' OR status='rejected_similarity'")
  .all();
const funcs = new Set();
for (const { expression } of rows) {
  const m = expression.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (m) funcs.add(m[1]);
}
console.log('count=', funcs.size);
console.log(Array.from(funcs).sort().join('\n'));
