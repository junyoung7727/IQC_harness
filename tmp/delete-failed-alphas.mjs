import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');

const before = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status LIKE 'failed%'").get().count;
console.log('before_delete_failed=', before);

const result = db.prepare("DELETE FROM alphas WHERE status LIKE 'failed%'").run();
console.log('deleted=', result.changes);

const after = db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status LIKE 'failed%'").get().count;
console.log('after_delete_failed=', after);
