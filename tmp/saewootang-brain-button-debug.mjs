import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';
const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
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
  await page.keyboard.press('Escape').catch(() => {});
  const info = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b, i) => ({
    i,
    text: b.innerText.trim(),
    disabled: b.disabled,
    aria: b.getAttribute('aria-label'),
    cls: b.className,
    rect: (() => { const r = b.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; })(),
    visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length)
  })).filter((b) => /Simulate|Example|Code|Results|Settings|Check Submission|Submit Alpha/.test(b.text || b.aria || '')));
  console.log(JSON.stringify(info, null, 2));
} finally { await context.close(); }
