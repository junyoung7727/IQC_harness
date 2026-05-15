import { DatabaseSync } from 'node:sqlite';
import { parseExpression } from '../src/harness/similarity.js';

const db = new DatabaseSync('data/harness.db');
const rows = db.prepare('SELECT expression FROM alphas').all();
const funcs = new Set();
for (const { expression } of rows) {
  const m = expression.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (m) funcs.add(m[1]);
}
console.log('count=', funcs.size);
console.log([...funcs].sort().join('\n'));

const sample = rows.slice(-20).map(r=>r.expression);
console.log('Recent expressions:');
console.log(sample.join('\n'));
