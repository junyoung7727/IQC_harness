import { chromium } from 'playwright';
import { loadLoginEntries } from '../src/harness/login-map.js';
import { buildSimulationPayload } from '../src/harness/brain.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
const LIVE_SIMULATIONS_URL = 'https://api.worldquantbrain.com/simulations';
const LIVE_AUTH_PROOF_URL = 'https://api.worldquantbrain.com/users/self/messages/summary';
const LIVE_ALPHAS_URL = 'https://api.worldquantbrain.com/alphas';

const expression = 'group_rank(ts_zscore(divide(cashflow_op, cap), 63), industry)';
const entry = loadLoginEntries().find((item) => item.agent === '까르보불닭');
if (!entry) throw new Error('buldak_entry_not_found');

async function fetchJsonInPage(page, url, options = {}) {
  return page.evaluate(async ({ url, options }) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    const response = await fetch(url, { credentials: 'include', ...options, headers });
    const text = await response.text();
    return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers.entries()), text };
  }, { url, options });
}

async function dismissCookieBanner(page) {
  const acceptAll = page.getByRole('button', { name: 'Accept All' });
  if (await acceptAll.count()) {
    await acceptAll.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

async function ensureLoggedIn(page, credentials) {
  await page.goto(LIVE_SIGN_IN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await dismissCookieBanner(page);
  const hasSignInForm = await page.locator('input[name="email"]').count();
  if (hasSignInForm > 0) {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
    await page.waitForTimeout(5000);
  }
  await page.goto(LIVE_SIMULATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

const context = await chromium.launchPersistentContext(entry.chromeProfileDir, { channel: 'chrome', headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await ensureLoggedIn(page, entry);
  const auth = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });
  const submit = await fetchJsonInPage(page, LIVE_SIMULATIONS_URL, { method: 'POST', body: JSON.stringify(buildSimulationPayload(expression)) });
  const location = submit.headers.location ?? null;
  const poll = location ? await fetchJsonInPage(page, location, { method: 'GET', headers: {} }) : null;
  const pollJson = poll?.text ? JSON.parse(poll.text) : null;
  const alpha = pollJson?.alpha ? await fetchJsonInPage(page, `${LIVE_ALPHAS_URL}/${pollJson.alpha}`, { method: 'GET', headers: {} }) : null;
  console.log(JSON.stringify({
    agent: entry.agent,
    auth: { status: auth.status, url: auth.url, textPreview: auth.text.slice(0, 400) },
    submit: { status: submit.status, url: submit.url, headers: submit.headers, textPreview: submit.text.slice(0, 1500) },
    poll: poll ? { status: poll.status, url: poll.url, textPreview: poll.text.slice(0, 1500) } : null,
    alpha: alpha ? { status: alpha.status, url: alpha.url, textPreview: alpha.text.slice(0, 1500) } : null
  }, null, 2));
} finally {
  await context.close();
}
