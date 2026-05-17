import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const before = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status='pending'").get().count;
console.log('before_delete_pending=', before);

const result = db.prepare("DELETE FROM alphas WHERE status='pending'").run();
console.log('deleted_pending=', result.changes);

const after = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status='pending'").get().count;
console.log('after_delete_pending=', after);
