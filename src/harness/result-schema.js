export const SETTINGS_FIELDS = [
  { key: 'nanHandling', column: 'settings_nan_handling', type: 'TEXT' },
  { key: 'instrumentType', column: 'settings_instrument_type', type: 'TEXT' },
  { key: 'delay', column: 'settings_delay', type: 'INTEGER' },
  { key: 'universe', column: 'settings_universe', type: 'TEXT' },
  { key: 'truncation', column: 'settings_truncation', type: 'REAL' },
  { key: 'unitHandling', column: 'settings_unit_handling', type: 'TEXT' },
  { key: 'testPeriod', column: 'settings_test_period', type: 'TEXT' },
  { key: 'pasteurization', column: 'settings_pasteurization', type: 'TEXT' },
  { key: 'region', column: 'settings_region', type: 'TEXT' },
  { key: 'language', column: 'settings_language', type: 'TEXT' },
  { key: 'decay', column: 'settings_decay', type: 'INTEGER' },
  { key: 'neutralization', column: 'settings_neutralization', type: 'TEXT' },
  { key: 'visualization', column: 'settings_visualization', type: 'INTEGER' }
];

export const METRICS_FIELDS = [
  { key: 'simulationStatus', column: 'metric_simulation_status', type: 'TEXT' },
  { key: 'simulationProgress', column: 'metric_simulation_progress', type: 'REAL' },
  { key: 'alphaId', column: 'metric_alpha_id', type: 'INTEGER' },
  { key: 'sharpe', column: 'metric_sharpe', type: 'REAL' },
  { key: 'fitness', column: 'metric_fitness', type: 'REAL' },
  { key: 'turnover', column: 'metric_turnover', type: 'REAL' },
  { key: 'grade', column: 'metric_grade', type: 'TEXT' }
];

function coerceValue(field, value) {
  if (value == null) return null;
  if (field.type === 'INTEGER') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  if (field.type === 'REAL') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return String(value);
}

export function structuredAssignments(alias, fields) {
  return fields.map((field) => `${field.column} = ${alias}`).join(', ');
}

export function structuredPlaceholders(fields) {
  return fields.map(() => '?').join(', ');
}

export function structuredColumnDefinitions(fields) {
  return fields.map((field) => `${field.column} ${field.type}`).join(',\n      ');
}

export function extractStructuredValues(payload, fields) {
  return fields.map((field) => coerceValue(field, payload?.[field.key]));
}

export function materializeStructuredObject(row, fields) {
  const object = {};
  let hasValue = false;
  for (const field of fields) {
    const value = row[field.column];
    if (value !== null && value !== undefined) {
      object[field.key] = field.type === 'INTEGER' && typeof value === 'number' && field.key === 'visualization'
        ? Boolean(value)
        : value;
      hasValue = true;
    }
  }
  return hasValue ? object : null;
}
