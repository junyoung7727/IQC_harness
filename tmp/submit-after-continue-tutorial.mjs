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
    throw new Error(`brain_login_form_not_ready:${state}`);
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
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/kkarebo';
const brainAccount = 'formal.column217@xeramail.com';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('missing_brain_credentials');
const context = await chromium.launchPersistentContext(chromeProfile, { channel: 'chrome', headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await ensureLoggedIn(page, credentials);
  await page.waitForTimeout(3000);
  for (let i = 0; i < 15; i += 1) {
    const continueButton = page.getByRole('link', { name: 'Continue' }).or(page.getByRole('button', { name: 'Continue' }));
    if (await continueButton.count()) {
      await continueButton.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      continue;
    }
    const skipLink = page.getByRole('link', { name: 'Skip' }).or(page.getByRole('button', { name: 'Skip' }));
    if (await skipLink.count()) {
      await skipLink.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      continue;
    }
    break;
  }
  const bodyText = await page.locator('body').innerText();
  const stillTutorial = /Welcome to the Simulate Screen|TUTORIAL|Let\'s help you get started/i.test(bodyText);
  const submit = await fetchJsonInPage(page, LIVE_SIMULATIONS_URL, { method: 'POST', body: JSON.stringify(payload('rank(ts_std_dev(cash, 20))')) });
  const poll = submit.headers.location ? await fetchJsonInPage(page, submit.headers.location, { method: 'GET', headers: {} }) : null;
  console.log(JSON.stringify({ stillTutorial, submit, poll }, null, 2));
} finally {
  await context.close();
}
