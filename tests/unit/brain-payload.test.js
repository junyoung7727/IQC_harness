import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSimulationPayload, resolveSimulationSubmission } from '../../src/harness/brain.js';

test('buildSimulationPayload creates the expected default live submission payload', () => {
  const payload = buildSimulationPayload('sales/cap');
  assert.equal(payload.type, 'REGULAR');
  assert.equal(payload.regular, 'sales/cap');
  assert.equal(payload.settings.instrumentType, 'EQUITY');
  assert.equal(payload.settings.region, 'USA');
  assert.equal(payload.settings.universe, 'TOP3000');
  assert.equal(payload.settings.delay, 1);
  assert.equal(payload.settings.decay, 4);
  assert.equal(payload.settings.neutralization, 'MARKET');
  assert.equal(payload.settings.language, 'FASTEXPR');
});

test('resolveSimulationSubmission accepts 201 responses with a location header', () => {
  const submission = resolveSimulationSubmission({
    status: 201,
    headers: {
      location: 'https://api.worldquantbrain.com/simulations/abc',
      'retry-after': '7'
    },
    text: ''
  });

  assert.equal(submission.location, 'https://api.worldquantbrain.com/simulations/abc');
  assert.equal(submission.retryAfterMs, 7000);
});

test('resolveSimulationSubmission keeps polling when 200 includes a simulation id', () => {
  const submission = resolveSimulationSubmission({
    status: 200,
    headers: {
      'retry-after': '3'
    },
    text: JSON.stringify({ id: 'sim-123' })
  });

  assert.equal(submission.location, 'https://api.worldquantbrain.com/simulations/sim-123');
  assert.equal(submission.retryAfterMs, 3000);
});

test('resolveSimulationSubmission blocks walkthrough sample responses so they can be retried after tutorial handling', () => {
  assert.throws(
    () => resolveSimulationSubmission({
      status: 200,
      headers: {
        location: 'https://api.worldquantbrain.com/simulations/sample-simulation-id-walkthrough'
      },
      text: ''
    }),
    (error) => error.message === 'simulation_submit_walkthrough:200:' && error.failureClass === 'workflow_state_blocked' && error.retryable === true
  );
});

test('resolveSimulationSubmission treats ambiguous 200 responses as retryable instead of terminal', () => {
  assert.throws(
    () => resolveSimulationSubmission({
      status: 200,
      headers: {},
      text: ''
    }),
    (error) => error.message === 'simulation_submit_inconclusive:200:' && error.failureClass === 'submission_pending_uncertain' && error.retryable === true
  );
});
