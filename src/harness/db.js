import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { extractStructuredValues, METRICS_FIELDS, SETTINGS_FIELDS, structuredColumnDefinitions } from './result-schema.js';

function getColumnNames(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
}

function ensureStructuredColumns(db) {
  const columnNames = getColumnNames(db, 'alphas');
  if (!columnNames.has('hypothesis')) {
    db.exec('ALTER TABLE alphas ADD COLUMN hypothesis TEXT');
  }
  for (const field of [...SETTINGS_FIELDS, ...METRICS_FIELDS]) {
    if (!columnNames.has(field.column)) {
      db.exec(`ALTER TABLE alphas ADD COLUMN ${field.column} ${field.type}`);
    }
  }
}

function backfillStructuredColumns(db) {
  const columnNames = getColumnNames(db, 'alphas');
  if (!columnNames.has('settings_json') && !columnNames.has('metrics_json')) return;

  const rows = db.prepare(`
    SELECT alpha_id, settings_json, metrics_json
    FROM alphas
    WHERE settings_json IS NOT NULL OR metrics_json IS NOT NULL
  `).all();

  if (!rows.length) return;

  const update = db.prepare(`
    UPDATE alphas
    SET ${[...SETTINGS_FIELDS, ...METRICS_FIELDS].map((field) => `${field.column} = ?`).join(', ')}
    WHERE alpha_id = ?
  `);

  for (const row of rows) {
    const settings = row.settings_json ? JSON.parse(row.settings_json) : null;
    const metrics = row.metrics_json ? JSON.parse(row.metrics_json) : null;
    update.run(
      ...extractStructuredValues(settings, SETTINGS_FIELDS),
      ...extractStructuredValues(metrics, METRICS_FIELDS),
      row.alpha_id
    );
  }
}

export function openDatabase(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS alphas (
      alpha_id INTEGER PRIMARY KEY AUTOINCREMENT,
      expression TEXT NOT NULL,
      hypothesis TEXT,
      status TEXT NOT NULL,
      submitted_by TEXT,
      lease_id TEXT,
      leased_to TEXT,
      brain_account_id TEXT,
      chrome_profile_id TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error_class TEXT,
      last_error_message TEXT,
      function_counts TEXT NOT NULL,
      datafield_counts TEXT NOT NULL,
      operator_counts TEXT NOT NULL,
      structure_counts TEXT NOT NULL,
      max_similarity_at_submit REAL,
      closest_alpha_id_at_submit INTEGER,
      ${structuredColumnDefinitions(SETTINGS_FIELDS)},
      ${structuredColumnDefinitions(METRICS_FIELDS)},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS failures (
      failure_id INTEGER PRIMARY KEY AUTOINCREMENT,
      alpha_id INTEGER NOT NULL,
      worker_id TEXT NOT NULL,
      brain_account_id TEXT,
      chrome_profile_id TEXT,
      lease_id TEXT,
      attempt_number INTEGER NOT NULL,
      failure_class TEXT NOT NULL,
      failure_message TEXT NOT NULL,
      retryable INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);
  ensureStructuredColumns(db);
  backfillStructuredColumns(db);
  return db;
}
