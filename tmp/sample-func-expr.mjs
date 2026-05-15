import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/harness.db');
const rows = db.prepare('SELECT expression FROM alphas').all();
const firstByFunc = new Map();
for (const { expression } of rows) {
  const m = expression.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (!m) continue;
  if (!firstByFunc.has(m[1])) firstByFunc.set(m[1], expression);
}
for (const [fn, expr] of [...firstByFunc.entries()].sort()) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM alphas WHERE expression LIKE ?').get(`${fn}(%`).c;
  console.log(`${fn} x${count}: ${expr}`);
}
