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
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text
    };
  }, { url, options });
}

const SETTINGS = {
  nanHandling: 'ON',
  instrumentType: 'EQUITY',
  delay: 1,
  universe: 'TOP3000',
  truncation: 0.08,
  unitHandling: 'VERIFY',
  testPeriod: 'P3Y',
  pasteurization: 'ON',
  region: 'USA',
  language: 'FASTEXPR',
  decay: 4,
  neutralization: 'MARKET',
  visualization: false
};

const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 15000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 15000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 15000 });
    await page.waitForTimeout(6000);
  } catch {}
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.count()) {
    await skip.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  const textbox = page.locator('[role="textbox"].inputarea').first();
  await textbox.focus({ timeout: 10000 });
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.type(expression);
  await page.waitForTimeout(1500);

  const button = page.getByRole('button', { name: /^Simulate$/ }).first();
  if (await button.isDisabled()) throw new Error('simulate_button_disabled');

  const postPromise = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().includes('/simulations'), { timeout: 30000 });
  await button.click({ force: true, timeout: 10000 });
  const postResponse = await postPromise;
  const postHeaders = await postResponse.allHeaders();
  const location = postHeaders.location;
  const retryAfterMs = Math.ceil(Number(postHeaders['retry-after'] ?? '5') * 1000);
  const postBody = await postResponse.text().catch(() => '');

  if (!location) {
    console.log(JSON.stringify({ postStatus: postResponse.status(), postHeaders, postBody, currentUrl: page.url() }, null, 2));
    throw new Error('missing_location_header');
  }

  await sleep(retryAfterMs);
  let simulation = null;
  for (let i = 0; i < 120; i += 1) {
    const poll = await fetchJsonInPage(page, location, { method: 'GET', headers: {} });
    if (poll.status >= 400) {
      console.log(JSON.stringify({ postStatus: postResponse.status(), location, postHeaders, postBody, poll, currentUrl: page.url() }, null, 2));
      throw new Error(`poll_failed_${poll.status}`);
    }
    simulation = poll.text ? JSON.parse(poll.text) : {};
    if (['COMPLETE', 'WARNING', 'ERROR', 'FAIL'].includes(simulation.status)) break;
    await sleep(5000);
  }
  if (!simulation || !['COMPLETE', 'WARNING', 'ERROR', 'FAIL'].includes(simulation.status)) {
    console.log(JSON.stringify({ postStatus: postResponse.status(), location, postHeaders, postBody, simulation, currentUrl: page.url() }, null, 2));
    throw new Error('poll_timeout');
  }

  let alphaPayload = null;
  let alphaFetchError = null;
  if (simulation.alpha) {
    for (let i = 0; i < 5; i += 1) {
      try {
        const alphaResp = await fetchJsonInPage(page, `https://api.worldquantbrain.com/alphas/${simulation.alpha}`, { method: 'GET', headers: {} });
        if (alphaResp.status < 400) {
          alphaPayload = alphaResp.text ? JSON.parse(alphaResp.text) : null;
          alphaFetchError = null;
          break;
        }
        alphaFetchError = `alpha_fetch_status_${alphaResp.status}`;
      } catch (error) {
        alphaFetchError = error.message;
      }
      await sleep(5000);
    }
  }

  console.log(JSON.stringify({
    settings: SETTINGS,
    metrics: {
      simulationStatus: simulation.status ?? null,
      simulationProgress: simulation.progress ?? null,
      alphaId: simulation.alpha ?? null,
      sharpe: alphaPayload?.is?.sharpe ?? null,
      fitness: alphaPayload?.is?.fitness ?? null,
      turnover: alphaPayload?.is?.turnover ?? null,
      grade: alphaPayload?.grade ?? null,
      message: simulation.message ?? null,
      alphaFetchError,
      location
    },
    postStatus: postResponse.status(),
    postBody
  }));
} finally {
  await context.close();
}
