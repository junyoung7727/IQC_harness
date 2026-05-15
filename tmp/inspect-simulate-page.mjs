import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
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
    throw new Error(`brain_login_form_not_ready:${state}`);
  }
  await page.goto(LIVE_SIMULATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/kkarebo';
const brainAccount = 'formal.column217@xeramail.com';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('missing_brain_credentials');

const context = await chromium.launchPersistentContext(chromeProfile, { channel: 'chrome', headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('walkthrough') || url.includes('sample-simulation-id') || url.includes('/simulations')) {
      requests.push({ method: req.method(), url });
    }
  });
  await ensureLoggedIn(page, credentials);
  await page.waitForTimeout(5000);
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  const interesting = bodyText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).filter((s) => /walkthrough|tutorial|simulate|simulation|alpha|sample|brain/i.test(s)).slice(0, 80);
  console.log(JSON.stringify({ title, url: page.url(), interesting, requests }, null, 2));
} finally {
  await context.close();
}
