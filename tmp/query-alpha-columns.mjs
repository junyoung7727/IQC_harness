import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');
const cols = db.prepare("PRAGMA table_info(alphas)").all();
console.log('columns', JSON.stringify(cols, null, 2));
const rows = db.prepare("SELECT * FROM alphas WHERE alpha_id IN (75,77,78) ORDER BY alpha_id").all();
console.log('rows', JSON.stringify(rows, null, 2));
