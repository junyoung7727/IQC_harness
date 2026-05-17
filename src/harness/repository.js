import { randomUUID } from 'node:crypto';
import { computeSimilarity, deserializeCounts, parseExpression, serializeCounts } from './similarity.js';
import { extractStructuredValues, materializeStructuredObject, METRICS_FIELDS, SETTINGS_FIELDS } from './result-schema.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeIdentity(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function rowToAlpha(row) {
  if (!row) return null;
  const settings = materializeStructuredObject(row, SETTINGS_FIELDS) ?? (row.settings_json ? JSON.parse(row.settings_json) : null);
  const metrics = materializeStructuredObject(row, METRICS_FIELDS) ?? (row.metrics_json ? JSON.parse(row.metrics_json) : null);
  return {
    alphaId: row.alpha_id,
    expression: row.expression,
    hypothesis: row.hypothesis,
    status: row.status,
    submittedBy: row.submitted_by,
    leaseId: row.lease_id,
    leasedTo: row.leased_to,
    brainAccountId: row.brain_account_id,
    chromeProfileId: row.chrome_profile_id,
    attemptCount: row.attempt_count,
    lastErrorClass: row.last_error_class,
    lastErrorMessage: row.last_error_message,
    functions: JSON.parse(row.function_counts),
    datafields: JSON.parse(row.datafield_counts),
    operators: JSON.parse(row.operator_counts),
    structure: JSON.parse(row.structure_counts),
    maxSimilarityAtSubmit: row.max_similarity_at_submit,
    closestAlphaIdAtSubmit: row.closest_alpha_id_at_submit,
    settings,
    metrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class HarnessRepository {
  constructor(db) {
    this.db = db;
  }

  submitAlpha({ expression, submittedBy = null, hypothesis = null }) {
    const signature = parseExpression(expression);
    const rows = this.db.prepare(
      'SELECT alpha_id, function_counts, datafield_counts, operator_counts, structure_counts FROM alphas'
    ).all();
    let maxSimilarity = 0;
    let closestAlphaId = null;
    for (const row of rows) {
      const similarity = computeSimilarity(signature, {
        functionCounts: deserializeCounts(row.function_counts),
        datafieldCounts: deserializeCounts(row.datafield_counts),
        operatorCounts: deserializeCounts(row.operator_counts),
        structureCounts: deserializeCounts(row.structure_counts)
      });
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        closestAlphaId = row.alpha_id;
      }
    }

    if (maxSimilarity > 0.7) {
      return {
        status: 'rejected_similarity',
        maxSimilarity,
        closestAlphaId,
        threshold: 0.7
      };
    }

    const timestamp = nowIso();
    const result = this.db.prepare(`
      INSERT INTO alphas (
        expression, hypothesis, status, submitted_by, function_counts, datafield_counts, operator_counts, structure_counts,
        max_similarity_at_submit, closest_alpha_id_at_submit, created_at, updated_at
      ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expression,
      hypothesis,
      submittedBy,
      serializeCounts(signature.functionCounts),
      serializeCounts(signature.datafieldCounts),
      serializeCounts(signature.operatorCounts),
      serializeCounts(signature.structureCounts),
      maxSimilarity,
      closestAlphaId,
      timestamp,
      timestamp
    );

    return {
      status: 'accepted',
      alphaId: Number(result.lastInsertRowid),
      state: 'pending',
      maxSimilarity
    };
  }

  requestNext({ count = 3, workerId, brainAccountId, chromeProfileId }) {
    const leaseId = randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const rows = this.db.prepare(
        `SELECT alpha_id, expression, attempt_count FROM alphas WHERE status = 'pending' ORDER BY alpha_id LIMIT ?`
      ).all(count);
      const ids = rows.map((row) => row.alpha_id);
      const timestamp = nowIso();
      for (const id of ids) {
        this.db.prepare(`
          UPDATE alphas
          SET status = 'leased', lease_id = ?, leased_to = ?, brain_account_id = ?, chrome_profile_id = ?, updated_at = ?
          WHERE alpha_id = ? AND status = 'pending'
        `).run(
          leaseId,
          normalizeIdentity(workerId),
          normalizeIdentity(brainAccountId),
          normalizeIdentity(chromeProfileId),
          timestamp,
          id
        );
      }
      this.db.exec('COMMIT');
      return {
        status: 'ok',
        count: ids.length,
        leaseId: ids.length ? leaseId : null,
        items: rows.map((row) => ({ alphaId: row.alpha_id, expression: row.expression, attemptCount: row.attempt_count }))
      };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  markRunning({ alphaId, leaseId }) {
    const timestamp = nowIso();
    const normalizedLeaseId = normalizeIdentity(leaseId);
    const result = this.db.prepare(`
      UPDATE alphas
      SET status = 'running', attempt_count = attempt_count + 1, updated_at = ?
      WHERE alpha_id = ? AND lease_id = ? AND status = 'leased'
    `).run(timestamp, alphaId, normalizedLeaseId);
    if (result.changes === 0) {
      throw new Error('invalid_lease_or_state');
    }
    return { status: 'accepted', alphaId, state: 'running' };
  }

  submitResult({ alphaId, leaseId, workerId, brainAccountId, chromeProfileId, settings, metrics }) {
    const row = this.db.prepare('SELECT status, lease_id, leased_to, brain_account_id, chrome_profile_id FROM alphas WHERE alpha_id = ?').get(alphaId);
    const normalizedLeaseId = normalizeIdentity(leaseId);
    const normalizedWorkerId = normalizeIdentity(workerId);
    const normalizedBrainAccountId = normalizeIdentity(brainAccountId);
    const normalizedChromeProfileId = normalizeIdentity(chromeProfileId);
    if (
      !row ||
      normalizeIdentity(row.lease_id) !== normalizedLeaseId ||
      normalizeIdentity(row.leased_to) !== normalizedWorkerId ||
      row.status !== 'running'
    ) {
      throw new Error('invalid_lease_or_state');
    }
    if (
      normalizeIdentity(row.brain_account_id) !== normalizedBrainAccountId ||
      normalizeIdentity(row.chrome_profile_id) !== normalizedChromeProfileId
    ) {
      throw new Error('lease_identity_mismatch');
    }
    const timestamp = nowIso();
    this.db.prepare(`
      UPDATE alphas
      SET status = 'tested',
          lease_id = NULL,
          leased_to = NULL,
          ${SETTINGS_FIELDS.map((field) => `${field.column} = ?`).join(', ')},
          ${METRICS_FIELDS.map((field) => `${field.column} = ?`).join(', ')},
          brain_account_id = ?,
          chrome_profile_id = ?,
          updated_at = ?
      WHERE alpha_id = ?
    `).run(
      ...extractStructuredValues(settings, SETTINGS_FIELDS),
      ...extractStructuredValues(metrics, METRICS_FIELDS),
      normalizedBrainAccountId,
      normalizedChromeProfileId,
      timestamp,
      alphaId
    );
    return { status: 'accepted', alphaId, state: 'tested' };
  }

  reportFailure({ alphaId, leaseId, workerId, brainAccountId, chromeProfileId, retryable, failureClass, failureMessage }) {
    const row = this.db.prepare('SELECT status, lease_id, leased_to, attempt_count, brain_account_id, chrome_profile_id FROM alphas WHERE alpha_id = ?').get(alphaId);
    const normalizedLeaseId = normalizeIdentity(leaseId);
    const normalizedWorkerId = normalizeIdentity(workerId);
    const normalizedBrainAccountId = normalizeIdentity(brainAccountId);
    const normalizedChromeProfileId = normalizeIdentity(chromeProfileId);
    if (
      !row ||
      normalizeIdentity(row.lease_id) !== normalizedLeaseId ||
      normalizeIdentity(row.leased_to) !== normalizedWorkerId ||
      row.status !== 'running'
    ) {
      throw new Error('invalid_lease_or_state');
    }
    if (
      normalizeIdentity(row.brain_account_id) !== normalizedBrainAccountId ||
      normalizeIdentity(row.chrome_profile_id) !== normalizedChromeProfileId
    ) {
      throw new Error('lease_identity_mismatch');
    }
    const state = retryable ? 'failed_retryable' : 'failed_terminal';
    const timestamp = nowIso();
    this.db.prepare(`
      UPDATE alphas
      SET status = ?,
          lease_id = NULL,
          leased_to = NULL,
          last_error_class = ?,
          last_error_message = ?,
          updated_at = ?
      WHERE alpha_id = ?
    `).run(state, failureClass, failureMessage, timestamp, alphaId);
    this.db.prepare(`
      INSERT INTO failures (
        alpha_id, worker_id, brain_account_id, chrome_profile_id, lease_id,
        attempt_number, failure_class, failure_message, retryable, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alphaId,
      normalizedWorkerId,
      normalizedBrainAccountId,
      normalizedChromeProfileId,
      normalizedLeaseId,
      row.attempt_count,
      failureClass,
      failureMessage,
      retryable ? 1 : 0,
      timestamp
    );
    return { status: 'accepted', alphaId, state };
  }

  requeueRetryable(alphaId) {
    const timestamp = nowIso();
    const result = this.db.prepare(`
      UPDATE alphas
      SET status = 'pending', lease_id = NULL, leased_to = NULL, updated_at = ?
      WHERE alpha_id = ? AND status = 'failed_retryable'
    `).run(timestamp, alphaId);
    if (result.changes === 0) {
      throw new Error('invalid_requeue_state');
    }
    return { status: 'accepted', alphaId, state: 'pending' };
  }

  getAlpha(alphaId) {
    const row = this.db.prepare('SELECT * FROM alphas WHERE alpha_id = ?').get(alphaId);
    return rowToAlpha(row);
  }

  listAlphaIdsByStatus(status) {
    return this.db.prepare('SELECT alpha_id FROM alphas WHERE status = ? ORDER BY alpha_id').all(status).map((row) => row.alpha_id);
  }

  countStored() {
    return this.db.prepare('SELECT COUNT(*) AS count FROM alphas').get().count;
  }
}
