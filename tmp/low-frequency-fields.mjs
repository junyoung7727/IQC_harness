import { DatabaseSync } from 'node:sqlite';
import { parseExpression } from '../src/harness/similarity.js';

const db = new DatabaseSync('data/harness.db');
const rows = db.prepare('SELECT alpha_id, expression FROM alphas').all();
const fieldCounts = new Map();
for (const { expression, alpha_id } of rows) {
  try {
    const sig = parseExpression(expression);
    for (const [field, cnt] of sig.datafieldCounts) {
      fieldCounts.set(field, (fieldCounts.get(field)||0)+cnt);
    }
  } catch (e) {
    console.error('parse failed', alpha_id, e.message);
  }
}
const sorted = [...fieldCounts.entries()].sort((a,b)=>a[1]-b[1]);
console.log('lowest10', sorted.slice(0,40));
console.log('highest10', sorted.slice(-20));
