import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { findLoginEntry } from '../src/harness/login-map.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
const LIVE_SIMULATIONS_URL = 'https://api.worldquantbrain.com/simulations';
const LIVE_AUTH_PROOF_URL = 'https://api.worldquantbrain.com/users/self/messages/summary';
const OUTPUT_PATH = new URL('./raw-sales-cap-50plus-results.json', import.meta.url);

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function nowIso() { return new Date().toISOString(); }
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}
function persist(results) {
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
}
async function fetchJsonInPage(page, url, options = {}) {
  return page.evaluate(async ({ url, options }) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    const response = await fetch(url, { credentials: 'include', ...options, headers });
    const text = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text };
  }, { url, options });
}
async function dismissCookieBanner(page) {
  const acceptAll = page.getByRole('button', { name: 'Accept All' });
  if (await acceptAll.count()) {
    await acceptAll.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}
async function waitForLoginReady(page, maxWaitMs = 30000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await dismissCookieBanner(page);
    const hasSignInForm = await page.locator('input[name="email"]').count();
    if (hasSignInForm > 0) return 'form';
    try {
      const proof = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });
      if (proof.status === 200) return 'authenticated';
    } catch {}
    await sleep(1000);
  }
  return 'unknown';
}
async function waitForAuthenticationBootstrap(page, maxWaitMs = 45000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await dismissCookieBanner(page);
    try {
      const proof = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });
      if (proof.status === 200) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error('brain_auth_bootstrap_timeout');
}
async function ensureLoggedIn(page, credentials) {
  await page.goto(LIVE_SIGN_IN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const state = await waitForLoginReady(page);
  if (state === 'form') {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
    await waitForAuthenticationBootstrap(page);
  } else if (state !== 'authenticated') {
    await page.goto(LIVE_SIMULATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const proof = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} }).catch(() => null);
    if (!proof || proof.status !== 200) throw new Error(`brain_login_form_not_ready:${state}`);
  }
  await page.goto(LIVE_SIMULATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}
function payload(expression) {
  return {
    type: 'REGULAR',
    settings: {
      nanHandling: 'ON', instrumentType: 'EQUITY', delay: 1, universe: 'TOP3000', truncation: 0.08,
      unitHandling: 'VERIFY', testPeriod: 'P3Y', pasteurization: 'ON', region: 'USA', language: 'FASTEXPR',
      decay: 4, neutralization: 'MARKET', visualization: false
    },
    regular: expression
  };
}
async function submitOne(page, credentials, expression) {
  while (true) {
    let response;
    try {
      response = await fetchJsonInPage(page, LIVE_SIMULATIONS_URL, { method: 'POST', body: JSON.stringify(payload(expression)) });
    } catch {
      await sleep(10000);
      continue;
    }
    if (response.status === 201) {
      return {
        expression,
        location: response.headers.location,
        retryAfterMs: Math.ceil(Number(response.headers['retry-after'] ?? '5') * 1000),
        settings: payload(expression).settings,
        submittedAt: nowIso()
      };
    }
    if (response.status === 401 || response.status === 403) {
      await ensureLoggedIn(page, credentials);
      continue;
    }
    if (response.status === 429 && response.text.includes('CONCURRENT_SIMULATION_LIMIT_EXCEEDED')) {
      await sleep(10000);
      continue;
    }
    throw new Error(`submit_failed:${expression}:${response.status}:${response.text}`);
  }
}
async function pollOne(page, credentials, location) {
  let last = null;
  for (let i = 0; i < 240; i += 1) {
    let response;
    try {
      response = await fetchJsonInPage(page, location, { method: 'GET', headers: {} });
    } catch {
      await sleep(10000);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      await ensureLoggedIn(page, credentials);
      continue;
    }
    if (response.status >= 400) throw new Error(`poll_failed:${location}:${response.status}:${response.text}`);
    const parsed = response.text ? JSON.parse(response.text) : {};
    last = parsed;
    if (parsed.status === 'COMPLETE' || parsed.status === 'WARNING' || parsed.status === 'ERROR' || parsed.status === 'FAIL') return parsed;
    await sleep(Math.ceil(Number(response.headers['retry-after'] ?? '5') * 1000));
  }
  throw new Error(`poll_timeout:${location}:${JSON.stringify(last)}`);
}
async function fetchAlpha(page, alphaId) {
  const response = await fetchJsonInPage(page, `https://api.worldquantbrain.com/alphas/${alphaId}`, { method: 'GET', headers: {} });
  if (response.status >= 400) return null;
  return response.text ? JSON.parse(response.text) : null;
}

const expressions = [
  'sales/cap',
  'ts_mean(sales/cap, 3)',
  'ts_mean(sales/cap, 5)',
  'ts_mean(sales/cap, 7)',
  'ts_mean(sales/cap, 10)',
  'ts_mean(sales/cap, 15)',
  'ts_mean(sales/cap, 20)',
  'ts_mean(sales/cap, 30)',
  'ts_mean(sales/cap, 40)',
  'ts_mean(sales/cap, 60)',
  'ts_mean(sales/cap, 90)',
  'ts_mean(sales/cap, 120)',
  'ts_delay(sales/cap, 1)',
  'ts_delay(sales/cap, 2)',
  'ts_delay(sales/cap, 3)',
  'ts_delay(sales/cap, 5)',
  'ts_delay(sales/cap, 10)',
  'ts_delay(sales/cap, 20)',
  'sales/cap - ts_delay(sales/cap, 1)',
  'sales/cap - ts_delay(sales/cap, 2)',
  'sales/cap - ts_delay(sales/cap, 3)',
  'sales/cap - ts_delay(sales/cap, 5)',
  'sales/cap - ts_delay(sales/cap, 10)',
  'sales/cap - ts_delay(sales/cap, 20)',
  'ts_delta(sales/cap, 1)',
  'ts_delta(sales/cap, 2)',
  'ts_delta(sales/cap, 3)',
  'ts_delta(sales/cap, 5)',
  'ts_delta(sales/cap, 10)',
  'ts_delta(sales/cap, 20)',
  'ts_std_dev(sales/cap, 3)',
  'ts_std_dev(sales/cap, 5)',
  'ts_std_dev(sales/cap, 10)',
  'ts_std_dev(sales/cap, 20)',
  'ts_std_dev(sales/cap, 40)',
  'ts_std_dev(sales/cap, 60)',
  'ts_sum(sales/cap, 3)',
  'ts_sum(sales/cap, 5)',
  'ts_sum(sales/cap, 10)',
  'ts_sum(sales/cap, 20)',
  'ts_sum(sales/cap, 40)',
  'ts_min(sales/cap, 3)',
  'ts_min(sales/cap, 5)',
  'ts_min(sales/cap, 10)',
  'ts_min(sales/cap, 20)',
  'ts_max(sales/cap, 3)',
  'ts_max(sales/cap, 5)',
  'ts_max(sales/cap, 10)',
  'ts_max(sales/cap, 20)',
  'ts_mean(sales/cap, 5) - sales/cap',
  'ts_mean(sales/cap, 10) - sales/cap',
  'ts_mean(sales/cap, 20) - sales/cap',
  'sales/cap - ts_mean(sales/cap, 5)',
  'sales/cap - ts_mean(sales/cap, 10)',
  'sales/cap - ts_mean(sales/cap, 20)',
  'ts_mean(sales/cap, 5) - ts_mean(sales/cap, 20)',
  'ts_mean(sales/cap, 10) - ts_mean(sales/cap, 40)',
  'ts_mean(sales/cap, 20) - ts_mean(sales/cap, 60)',
  'ts_delay(sales/cap, 1) - ts_delay(sales/cap, 5)',
  'ts_delay(sales/cap, 2) - ts_delay(sales/cap, 10)'
];

const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/kkarebo';
const brainAccount = 'formal.column217@xeramail.com';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('missing_brain_credentials');

const results = [];
persist(results);
const context = await chromium.launchPersistentContext(chromeProfile, { channel: 'chrome', headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await ensureLoggedIn(page, credentials);
  const batches = chunk(expressions, 3);
  for (const batch of batches) {
    const submissions = await Promise.all(batch.map((expression) => submitOne(page, credentials, expression)));
    const batchResults = await Promise.all(submissions.map(async (submission) => {
      await sleep(submission.retryAfterMs);
      const simulation = await pollOne(page, credentials, submission.location);
      const alphaPayload = simulation.alpha ? await fetchAlpha(page, simulation.alpha) : null;
      return {
        expression: submission.expression,
        submittedAt: submission.submittedAt,
        finishedAt: nowIso(),
        settings: submission.settings,
        metrics: {
          simulationStatus: simulation.status ?? null,
          simulationProgress: simulation.progress ?? null,
          alphaId: simulation.alpha ?? null,
          sharpe: alphaPayload?.is?.sharpe ?? null,
          fitness: alphaPayload?.is?.fitness ?? null,
          turnover: alphaPayload?.is?.turnover ?? null,
          grade: alphaPayload?.grade ?? null
        }
      };
    }));
    results.push(...batchResults);
    persist(results);
  }
  console.log(JSON.stringify(results));
} finally {
  await context.close();
}
