import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';
const credentials = findLoginEntry({ brainAccount: 'mask.27-e61ff11f@phuturemail.com', chromeProfile: 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang' });
const context = await chromium.launchPersistentContext('C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang', { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await page.locator('input[name="email"]').fill(credentials.id, { timeout: 15000 }); await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 15000 }); await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 15000 }); await page.waitForTimeout(6000); } catch {}
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.count()) { await skip.click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(2000); }
  const textbox = page.locator('[role="textbox"].inputarea').first();
  await textbox.focus({ timeout: 10000 });
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.type('sales/cap');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({
    body: document.body.innerText.slice(0, 1200),
    buttons: Array.from(document.querySelectorAll('button')).map((b) => ({ text: b.innerText.trim(), disabled: b.disabled, visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length) })).filter((b) => b.visible && b.text),
  }));
  console.log(JSON.stringify(info, null, 2));
} finally { await context.close(); }
