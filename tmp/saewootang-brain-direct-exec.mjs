import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const expression = process.argv[2];
if (!expression) throw new Error('missing_expression');
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('credentials_not_found');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function fetchJsonInPage(page, url, options = {}) {
  return page.evaluate(async ({ url, options }) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }
    });
    const text = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text };
  }, { url, options });
}
async function login(page) {
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
  await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
  await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
  await page.waitForTimeout(10000);
}
const SETTINGS = { nanHandling:'ON', instrumentType:'EQUITY', delay:1, universe:'TOP3000', truncation:0.08, unitHandling:'VERIFY', testPeriod:'P3Y', pasteurization:'ON', region:'USA', language:'FASTEXPR', decay:4, neutralization:'MARKET', visualization:false };

const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await login(page);
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  if (page.url().includes('/sign-in')) {
    await login(page);
    await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);
  }
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.count()) {
    await skip.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  const post = await fetchJsonInPage(page, 'https://api.worldquantbrain.com/simulations', { method: 'POST', body: JSON.stringify({ type: 'REGULAR', settings: SETTINGS, regular: expression }) });
  if (post.status !== 201 || !post.headers.location) {
    console.log(JSON.stringify({ post, pageUrl: page.url(), body: await page.evaluate(() => document.body.innerText.slice(0, 1000)) }, null, 2));
    throw new Error(`submit_failed_${post.status}`);
  }
  await sleep(Math.ceil(Number(post.headers['retry-after'] ?? '5') * 1000));
  let simulation = null;
  for (let i = 0; i < 120; i += 1) {
    const poll = await fetchJsonInPage(page, post.headers.location, { method: 'GET', headers: {} });
    if (poll.status >= 400) throw new Error(`poll_failed_${poll.status}`);
    simulation = poll.text ? JSON.parse(poll.text) : {};
    if (['COMPLETE', 'WARNING', 'ERROR', 'FAIL'].includes(simulation.status)) break;
    await sleep(5000);
  }
  let alphaPayload = null;
  let alphaFetchError = null;
  if (simulation?.alpha) {
    for (let i = 0; i < 5; i += 1) {
      try {
        const alphaResp = await fetchJsonInPage(page, `https://api.worldquantbrain.com/alphas/${simulation.alpha}`, { method: 'GET', headers: {} });
        if (alphaResp.status < 400) { alphaPayload = alphaResp.text ? JSON.parse(alphaResp.text) : null; break; }
        alphaFetchError = `alpha_fetch_status_${alphaResp.status}`;
      } catch (error) { alphaFetchError = error.message; }
      await sleep(5000);
    }
  }
  console.log(JSON.stringify({ settings: SETTINGS, metrics: { simulationStatus: simulation?.status ?? null, simulationProgress: simulation?.progress ?? null, alphaId: simulation?.alpha ?? null, sharpe: alphaPayload?.is?.sharpe ?? null, fitness: alphaPayload?.is?.fitness ?? null, turnover: alphaPayload?.is?.turnover ?? null, grade: alphaPayload?.grade ?? null, message: simulation?.message ?? null, alphaFetchError, location: post.headers.location }, postStatus: post.status, postBody: post.text }));
} finally { await context.close(); }
