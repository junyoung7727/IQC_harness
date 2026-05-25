import { readFileSync } from 'node:fs';
import { win32 as path } from 'node:path';

const LOGIN_MAP_PATH = 'C:/Users/user/worldquant-alpha-lab/worldquant-login.md';

function parseBlocks(text) {
  return text.split('---').map((s) => s.trim()).filter(Boolean);
}

function pick(block, key) {
  const match = block.match(new RegExp(`${key}:\\s*(.+)`));
  return match ? match[1].trim() : '';
}

export function loadLoginEntries(loginMapPath = LOGIN_MAP_PATH) {
  let text;
  try {
    text = readFileSync(loginMapPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return parseBlocks(text)
    .filter((block) => /agent:\s*/.test(block))
    .map((block) => ({
      owner: pick(block, 'owner'),
      agent: pick(block, 'agent'),
      chromeProfileDir: pick(block, 'chrome_profile_dir'),
      id: pick(block, 'id'),
      password: pick(block, 'ps')
    }));
}

export function normalizeChromeProfilePath(chromeProfile) {
  return chromeProfile ? path.normalize(chromeProfile).toLowerCase() : '';
}

function expectSingleMatch(matches, errorMessage) {
  if (matches.length > 1) {
    throw new Error(errorMessage);
  }
  return matches[0] ?? null;
}

export function resolveLoginEntry(entries, { brainAccount, chromeProfile, password }) {
  const hasBrainAccount = Boolean(brainAccount);
  const hasChromeProfile = Boolean(chromeProfile);
  const hasPassword = Boolean(password);
  const normalizedChromeProfile = normalizeChromeProfilePath(chromeProfile);

  if (hasBrainAccount && hasChromeProfile) {
    const matches = entries.filter((entry) => entry.id === brainAccount && normalizeChromeProfilePath(entry.chromeProfileDir) === normalizedChromeProfile);
    return expectSingleMatch(matches, 'ambiguous_brain_credentials');
  }

  if (hasBrainAccount && hasPassword) {
    const matches = entries.filter((entry) => entry.id === brainAccount && entry.password === password);
    return expectSingleMatch(matches, 'ambiguous_brain_credentials');
  }

  if (hasBrainAccount) {
    const matches = entries.filter((entry) => entry.id === brainAccount);
    return expectSingleMatch(matches, 'ambiguous_brain_account');
  }

  if (hasChromeProfile) {
    const matches = entries.filter((entry) => normalizeChromeProfilePath(entry.chromeProfileDir) === normalizedChromeProfile);
    return expectSingleMatch(matches, 'ambiguous_chrome_profile');
  }

  return null;
}

export function findLoginEntry({ brainAccount, chromeProfile }) {
  const entries = loadLoginEntries();
  return resolveLoginEntry(entries, { brainAccount, chromeProfile });
}

export function findLoginEntryByIdAndPassword({ brainAccount, password }) {
  const entries = loadLoginEntries();
  return resolveLoginEntry(entries, { brainAccount, password });
}
