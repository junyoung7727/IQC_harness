import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLoginEntries, normalizeChromeProfilePath, resolveLoginEntry } from '../../src/harness/login-map.js';

const entries = [
  {
    id: 'alpha@example.com',
    chromeProfileDir: 'C:/profiles/alpha',
    password: 'pw1'
  },
  {
    id: 'beta@example.com',
    chromeProfileDir: 'C:/profiles/beta',
    password: 'pw2'
  }
];

test('resolveLoginEntry requires an exact account/profile pair when both are provided', () => {
  const entry = resolveLoginEntry(entries, {
    brainAccount: 'alpha@example.com',
    chromeProfile: 'C:/profiles/alpha'
  });

  assert.equal(entry?.id, 'alpha@example.com');
  assert.equal(entry?.chromeProfileDir, 'C:/profiles/alpha');
});

test('resolveLoginEntry rejects mismatched account/profile pairs', () => {
  const entry = resolveLoginEntry(entries, {
    brainAccount: 'alpha@example.com',
    chromeProfile: 'C:/profiles/beta'
  });

  assert.equal(entry, null);
});

test('resolveLoginEntry falls back to single-field lookup only when the other field is absent', () => {
  const byAccount = resolveLoginEntry(entries, {
    brainAccount: 'beta@example.com',
    chromeProfile: ''
  });
  const byProfile = resolveLoginEntry(entries, {
    brainAccount: '',
    chromeProfile: 'C:/profiles/alpha'
  });

  assert.equal(byAccount?.chromeProfileDir, 'C:/profiles/beta');
  assert.equal(byProfile?.id, 'alpha@example.com');
});

test('resolveLoginEntry uses exact id+password when both are provided', () => {
  const exact = resolveLoginEntry(entries, {
    brainAccount: 'alpha@example.com',
    password: 'pw1'
  });
  const mismatch = resolveLoginEntry(entries, {
    brainAccount: 'alpha@example.com',
    password: 'wrong'
  });

  assert.equal(exact?.id, 'alpha@example.com');
  assert.equal(mismatch, null);
});

test('normalizeChromeProfilePath normalizes slash direction and casing', () => {
  assert.equal(
    normalizeChromeProfilePath('C:/Profiles/Alpha'),
    normalizeChromeProfilePath('c:\\profiles\\alpha')
  );
});

test('resolveLoginEntry rejects ambiguous profile matches', () => {
  assert.throws(
    () => resolveLoginEntry([
      { id: 'a@example.com', chromeProfileDir: 'C:/profiles/alpha' },
      { id: 'b@example.com', chromeProfileDir: 'c:\\profiles\\alpha' }
    ], {
      brainAccount: '',
      chromeProfile: 'C:/profiles/alpha'
    }),
    /ambiguous_chrome_profile/
  );
});

test('loadLoginEntries returns an empty list when the login map path is missing', () => {
  const entries = loadLoginEntries('C:/__missing__/worldquant-login.md');

  assert.deepEqual(entries, []);
});
