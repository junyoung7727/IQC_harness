import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const statusRows = db.prepare('SELECT status, COUNT(*) AS count FROM alphas GROUP BY status ORDER BY status').all();
console.log('status_counts=', JSON.stringify(statusRows, null, 2));

const failedTerminalCount = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status='failed_terminal'").get().count;
const failedAnyCount = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status LIKE 'failed%'").get().count;
console.log('failed_terminal_count=', failedTerminalCount);
console.log('failed_like_count=', failedAnyCount);

const failedSamples = db.prepare("SELECT alpha_id, status, leased_to, last_error_class, last_error_message FROM alphas WHERE status='failed_terminal' ORDER BY alpha_id LIMIT 5").all();
console.log('sample_failed_terminal=', JSON.stringify(failedSamples, null, 2));
