import { chromium } from 'playwright';
import { loadLoginEntries } from '../src/harness/login-map.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
const LIVE_AUTH_PROOF_URL = 'https://api.worldquantbrain.com/users/self/messages/summary';
const targetAgents = ['왕뚜껑', '김치면'];

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

async function countLoginInputs(page) {
  return {
    email: await page.locator('input[name="email"]').count(),
    password: await page.locator('input[name="currentPassword"]').count()
  };
}

async function diagnoseEntry(entry) {
  const context = await chromium.launchPersistentContext(entry.chromeProfileDir, { channel: 'chrome', headless: true });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const trace = { agent: entry.agent, owner: entry.owner, profile: entry.chromeProfileDir };

    await page.goto(LIVE_SIGN_IN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await dismissCookieBanner(page);
    trace.signInUrlAfterGoto = page.url();
    trace.signInFormBefore = await countLoginInputs(page);
    trace.authBefore = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });

    if (trace.signInFormBefore.email > 0) {
      await page.locator('input[name="email"]').fill(entry.id, { timeout: 30000 });
      await page.locator('input[name="currentPassword"]').fill(entry.password, { timeout: 30000 });
      await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
      await page.waitForTimeout(5000);
    }

    await dismissCookieBanner(page);
    trace.urlAfterLoginAttempt = page.url();
    trace.signInFormAfter = await countLoginInputs(page);
    trace.authAfter = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });

    await page.goto(LIVE_SIMULATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((error) => {
      trace.simulateGotoError = error.message;
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await dismissCookieBanner(page);
    trace.simulateUrl = page.url();
    trace.signInFormOnSimulate = await countLoginInputs(page);
    trace.authOnSimulate = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });

    return {
      agent: entry.agent,
      signInUrlAfterGoto: trace.signInUrlAfterGoto,
      signInFormBefore: trace.signInFormBefore,
      authBefore: { status: trace.authBefore.status, textPreview: trace.authBefore.text.slice(0, 300) },
      urlAfterLoginAttempt: trace.urlAfterLoginAttempt,
      signInFormAfter: trace.signInFormAfter,
      authAfter: { status: trace.authAfter.status, textPreview: trace.authAfter.text.slice(0, 300) },
      simulateUrl: trace.simulateUrl,
      signInFormOnSimulate: trace.signInFormOnSimulate,
      authOnSimulate: { status: trace.authOnSimulate.status, textPreview: trace.authOnSimulate.text.slice(0, 300) },
      simulateGotoError: trace.simulateGotoError ?? null
    };
  } catch (error) {
    return {
      agent: entry.agent,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  } finally {
    await context.close();
  }
}

const entries = loadLoginEntries().filter((entry) => targetAgents.includes(entry.agent));
const results = [];
for (const entry of entries) {
  results.push(await diagnoseEntry(entry));
}
console.log(JSON.stringify({ results }, null, 2));
