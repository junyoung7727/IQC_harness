import { openDatabase } from '../src/harness/db.js';

const db = openDatabase('C:/Users/user/worldquant-multi-agent-harness/data/harness.db');
try {
  const output = {
    columns: db.prepare('PRAGMA table_info(alphas)').all().map((column) => column.name),
    statuses: db.prepare('SELECT status, COUNT(*) AS count FROM alphas GROUP BY status ORDER BY status').all(),
    legacyRows: db.prepare('SELECT status, COUNT(*) AS count FROM alphas WHERE settings_json IS NOT NULL OR metrics_json IS NOT NULL GROUP BY status ORDER BY status').all(),
    legacyBackfilled: db.prepare("SELECT COUNT(*) AS count FROM alphas WHERE status = 'tested' AND (settings_json IS NOT NULL OR metrics_json IS NOT NULL) AND (settings_delay IS NOT NULL OR settings_universe IS NOT NULL OR metric_sharpe IS NOT NULL OR metric_fitness IS NOT NULL OR metric_grade IS NOT NULL)").get(),
    auth401: db.prepare("SELECT status, last_error_class, last_error_message, COUNT(*) AS count FROM alphas WHERE last_error_class = 'submission_error' AND (last_error_message = 'submit_failed_401' OR last_error_message LIKE 'simulation_submit_failed:401:%') GROUP BY status, last_error_class, last_error_message ORDER BY status, count DESC").all(),
    activeLeases: db.prepare('SELECT status, COUNT(*) AS count FROM alphas WHERE lease_id IS NOT NULL OR leased_to IS NOT NULL GROUP BY status ORDER BY status').all(),
    recent401: db.prepare("SELECT alpha_id, status, last_error_class, last_error_message, lease_id, leased_to, brain_account_id, chrome_profile_id FROM alphas WHERE last_error_class = 'submission_error' AND (last_error_message = 'submit_failed_401' OR last_error_message LIKE 'simulation_submit_failed:401:%') ORDER BY alpha_id LIMIT 10").all()
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  db.close();
}
