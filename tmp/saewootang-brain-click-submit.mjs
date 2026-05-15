import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('credentials_not_found');

const expression = process.argv[2] ?? 'sales/cap';
const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes('/simulations')) {
      console.log('POST_RESPONSE=' + JSON.stringify({ status: res.status(), url: res.url(), headers: await res.allHeaders(), body: await res.text().catch(() => '') }));
    }
  });
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 15000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 15000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 15000 });
    await page.waitForTimeout(6000);
  } catch {}
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1000);
  const code = page.locator('[role="code"]').first();
  await code.click({ force: true, timeout: 10000 });
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.type(expression);
  await page.waitForTimeout(1500);
  const simButton = page.getByRole('button', { name: /^Simulate$/ }).first();
  console.log('SIM_BUTTON_DISABLED=' + await simButton.isDisabled().catch(() => 'unknown'));
  await simButton.click({ force: true, timeout: 10000 });
  await page.waitForTimeout(15000);
  console.log('FINAL_URL=' + page.url());
} finally {
  await context.close();
}
