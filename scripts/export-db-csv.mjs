import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DB_PATH = 'C:/Users/user/worldquant-multi-agent-harness/data/harness.db';
const DEFAULT_OUTPUT_DIR = 'C:/Users/user/worldquant-multi-agent-harness/exports/harness-db';

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function toCsvValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsvValue(value) {
  const text = toCsvValue(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(columns, rows) {
  const header = columns.map(escapeCsvValue).join(',');
  const lines = [header];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function getUserTables(db) {
  return db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);
}

function getTableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all().map((column) => column.name);
}

function exportTable(db, tableName, outputDir) {
  const columns = getTableColumns(db, tableName);
  const rows = db.prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`).all();
  const csv = buildCsv(columns, rows);
  const filePath = join(outputDir, `${tableName}.csv`);
  writeFileSync(filePath, csv, 'utf8');
  return {
    tableName,
    rowCount: rows.length,
    filePath,
  };
}

function exportDatabase(dbPath, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    const tables = getUserTables(db);
    const tableSummaries = tables.map((tableName) => exportTable(db, tableName, outputDir));
    return {
      dbPath,
      outputDir,
      tables: tableSummaries,
    };
  } finally {
    db.close();
  }
}

const dbPath = process.argv[2] ?? DEFAULT_DB_PATH;
const outputDir = process.argv[3] ?? DEFAULT_OUTPUT_DIR;
const summary = exportDatabase(dbPath, outputDir);
console.log(JSON.stringify(summary, null, 2));
