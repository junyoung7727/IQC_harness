import { openDatabase } from './src/harness/db.js';

const db = openDatabase('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');
const ids = [767, 768, 769];
const placeholders = ids.map(() => '?').join(',');
const rows = db.prepare(`SELECT alpha_id,status,lease_id,leased_to,brain_account_id,chrome_profile_id,attempt_count FROM alphas WHERE alpha_id IN (${placeholders})`).all(...ids);
console.log(JSON.stringify(rows, null, 2));

const pending = db.prepare("SELECT alpha_id,status,lease_id,leased_to FROM alphas WHERE status='pending' ORDER BY alpha_id LIMIT 20").all();
console.log('PENDING=' + JSON.stringify(pending));
const leased = db.prepare("SELECT alpha_id,status,lease_id,leased_to,attempt_count FROM alphas WHERE status='leased' ORDER BY alpha_id LIMIT 20").all();
console.log('LEASED=' + JSON.stringify(leased));
const running = db.prepare("SELECT alpha_id,status,lease_id,leased_to,attempt_count FROM alphas WHERE status='running' ORDER BY alpha_id LIMIT 20").all();
console.log('RUNNING=' + JSON.stringify(running));
const tested = db.prepare("SELECT alpha_id,status,lease_id,leased_to FROM alphas WHERE status='tested' ORDER BY alpha_id DESC LIMIT 20").all();
console.log('TESTED=' + JSON.stringify(tested));
