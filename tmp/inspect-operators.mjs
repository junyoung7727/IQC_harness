import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/harness.db');
const q = (pattern) => db.prepare('SELECT alpha_id, expression FROM alphas WHERE expression LIKE ? ORDER BY alpha_id DESC LIMIT 20').all(`%${pattern}%`);

const corr = q('ts_corr(');
console.log('ts_corr examples:');
for (const r of corr) {
  console.log(`${r.alpha_id}: ${r.expression}`);
}

const groupRank = q('group_rank(');
console.log('\ngroup_rank examples:');
for (const r of groupRank) {
  console.log(`${r.alpha_id}: ${r.expression}`);
}

const std = q('ts_std_dev(');
console.log('\nts_std_dev examples:');
for (const r of std) {
  console.log(`${r.alpha_id}: ${r.expression}`);
}
