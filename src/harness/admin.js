function nowIso() {
  return new Date().toISOString();
}

export function isAuth401FailureMessage(message) {
  return typeof message === 'string' && (
    message === 'submit_failed_401' ||
    message.startsWith('simulation_submit_failed:401:')
  );
}

export function clearStaleLeasesOnNonActiveRows(db, timestamp = nowIso()) {
  const result = db.prepare(`
    UPDATE alphas
    SET lease_id = NULL,
        leased_to = NULL,
        updated_at = ?
    WHERE status NOT IN ('leased', 'running')
      AND (lease_id IS NOT NULL OR leased_to IS NOT NULL)
  `).run(timestamp);
  return result.changes;
}

export function requeueAuth401Failures(db, timestamp = nowIso()) {
  const result = db.prepare(`
    UPDATE alphas
    SET status = 'pending',
        lease_id = NULL,
        leased_to = NULL,
        updated_at = ?
    WHERE status IN ('failed_retryable', 'failed_terminal')
      AND last_error_class = 'submission_error'
      AND (
        last_error_message = 'submit_failed_401'
        OR last_error_message LIKE 'simulation_submit_failed:401:%'
      )
  `).run(timestamp);
  return result.changes;
}

export function normalizeCurrentHarnessDb(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const timestamp = nowIso();
    const clearedLeaseRows = clearStaleLeasesOnNonActiveRows(db, timestamp);
    const requeued401Rows = requeueAuth401Failures(db, timestamp);
    db.exec('COMMIT');
    return { clearedLeaseRows, requeued401Rows };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
