import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
const LIVE_SIMULATIONS_URL = 'https://api.worldquantbrain.com/simulations';
const LIVE_AUTH_PROOF_URL = 'https://api.worldquantbrain.com/users/self/messages/summary';
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
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
  if (await acceptAll.count()) { await acceptAll.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1000); }
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
    if (!proof || proof.status !== 200) {
      throw new Error(`brain_login_form_not_ready:${state}`);
    }
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
async function submitOne(page, expression) {
  while (true) {
    const response = await fetchJsonInPage(page, LIVE_SIMULATIONS_URL, { method: 'POST', body: JSON.stringify(payload(expression)) });
    if (response.status === 201) {
      return {
        expression,
        location: response.headers.location,
        retryAfterMs: Math.ceil(Number(response.headers['retry-after'] ?? '5') * 1000),
        settings: payload(expression).settings
      };
    }
    if (response.status === 429 && response.text.includes('CONCURRENT_SIMULATION_LIMIT_EXCEEDED')) {
      await sleep(10000);
      continue;
    }
    throw new Error(`submit_failed:${expression}:${response.status}:${response.text}`);
  }
}
async function pollOne(page, location) {
  let last = null;
  for (let i = 0; i < 180; i += 1) {
    let response;
    try {
      response = await fetchJsonInPage(page, location, { method: 'GET', headers: {} });
    } catch {
      await sleep(10000);
      continue;
    }
    if (response.status >= 400) throw new Error(`poll_failed:${location}:${response.status}:${response.text}`);
    const payload = response.text ? JSON.parse(response.text) : {};
    last = payload;
    if (payload.status === 'COMPLETE' || payload.status === 'WARNING' || payload.status === 'ERROR' || payload.status === 'FAIL') return payload;
    await sleep(Math.ceil(Number(response.headers['retry-after'] ?? '5') * 1000));
  }
  throw new Error(`poll_timeout:${location}:${JSON.stringify(last)}`);
}
async function fetchAlpha(page, alphaId) {
  const response = await fetchJsonInPage(page, `https://api.worldquantbrain.com/alphas/${alphaId}`, { method: 'GET', headers: {} });
  if (response.status >= 400) return null;
  return response.text ? JSON.parse(response.text) : null;
}

const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/kkarebo';
const brainAccount = 'formal.column217@xeramail.com';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('missing_brain_credentials');
const expressions = ['rank(ts_std_dev(cash, 50))','rank(ts_std_dev(cash, 60))','rank(ts_std_dev(cash, 70))'];
const context = await chromium.launchPersistentContext(chromeProfile, { channel: 'chrome', headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await ensureLoggedIn(page, credentials);
  const submissions = await Promise.all(expressions.map((expression) => submitOne(page, expression)));
  const settled = await Promise.all(submissions.map(async (submission) => {
    await sleep(submission.retryAfterMs);
    const simulation = await pollOne(page, submission.location);
    const alphaPayload = simulation.alpha ? await fetchAlpha(page, simulation.alpha) : null;
    return {
      expression: submission.expression,
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
  console.log(JSON.stringify(settled));
} finally {
  await context.close();
}
