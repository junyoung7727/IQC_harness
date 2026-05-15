import { chromium } from 'playwright';
import { loadLoginEntries } from '../src/harness/login-map.js';
import { buildSimulationPayload } from '../src/harness/brain.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
const LIVE_SIMULATIONS_URL = 'https://api.worldquantbrain.com/simulations';
const LIVE_AUTH_PROOF_URL = 'https://api.worldquantbrain.com/users/self/messages/summary';
const LIVE_ALPHAS_URL = 'https://api.worldquantbrain.com/alphas';
const expression = 'group_rank(ts_zscore(divide(cashflow_op, cap), 63), industry)';

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

async function diagnoseEntry(entry) {
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
    const alphaJson = alpha?.text ? JSON.parse(alpha.text) : null;
    return {
      agent: entry.agent,
      owner: entry.owner,
      authStatus: auth.status,
      submitStatus: submit.status,
      location,
      pollStatus: poll?.status ?? null,
      pollRegular: pollJson?.regular ?? null,
      pollSimulationStatus: pollJson?.status ?? null,
      pollSettings: pollJson?.settings ?? null,
      alphaStatus: alpha?.status ?? null,
      alphaRegularCode: alphaJson?.regular?.code ?? null,
      alphaSharpe: alphaJson?.is?.sharpe ?? null,
      alphaFitness: alphaJson?.is?.fitness ?? null,
      alphaTurnover: alphaJson?.is?.turnover ?? null,
      alphaGrade: alphaJson?.grade ?? null,
      alphaStage: alphaJson?.stage ?? null,
      alphaId: alphaJson?.id ?? pollJson?.alpha ?? null
    };
  } catch (error) {
    return {
      agent: entry.agent,
      owner: entry.owner,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  } finally {
    await context.close();
  }
}

const entries = loadLoginEntries().filter((entry) => entry.agent !== '까르보불닭');
const results = [];
for (const entry of entries) {
  results.push(await diagnoseEntry(entry));
}
console.log(JSON.stringify({ expression, results }, null, 2));
