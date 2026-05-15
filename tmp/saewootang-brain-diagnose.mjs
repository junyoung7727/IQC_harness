import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('credentials_not_found');

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
  const result = await page.evaluate(async () => {
    const payload = {
      type: 'REGULAR',
      settings: {
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
      },
      regular: '-rank(divide(subtract(close, low), subtract(high, low)))'
    };
    const res = await fetch('https://api.worldquantbrain.com/simulations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return {
      status: res.status,
      url: res.url,
      headers: Object.fromEntries(res.headers.entries()),
      text: await res.text(),
      pageUrl: location.href,
      title: document.title,
      body: document.body.innerText.slice(0, 1000)
    };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
}
