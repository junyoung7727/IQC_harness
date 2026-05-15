import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAuthenticatedNavigationState } from '../../src/harness/brain.js';

test('assertAuthenticatedNavigationState rejects sign-in redirects', () => {
  assert.throws(
    () => assertAuthenticatedNavigationState({
      currentUrl: 'https://platform.worldquantbrain.com/sign-in',
      hasSignInForm: true,
      protectedStatus: 200
    }),
    (error) => error.message === 'brain_session_not_authenticated' && error.failureClass === 'auth_state_proof_failed'
  );
});

test('assertAuthenticatedNavigationState rejects protected-surface auth failures', () => {
  assert.throws(
    () => assertAuthenticatedNavigationState({
      currentUrl: 'https://platform.worldquantbrain.com/simulate',
      hasSignInForm: false,
      protectedStatus: 401
    }),
    (error) => error.message === 'brain_session_proof_failed:401' && error.failureClass === 'auth_state_proof_failed'
  );
});

test('assertAuthenticatedNavigationState accepts the live simulate page when sign-in form is absent', () => {
  assert.doesNotThrow(() => {
    assertAuthenticatedNavigationState({
      currentUrl: 'https://platform.worldquantbrain.com/simulate',
      hasSignInForm: false,
      protectedStatus: 200
    });
  });
});
