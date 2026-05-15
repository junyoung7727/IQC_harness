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
  const info = await page.evaluate(() => ({
    url: location.href,
    buttons: Array.from(document.querySelectorAll('button')).map((b, i) => ({ i, text: b.innerText.trim(), aria: b.getAttribute('aria-label'), disabled: b.disabled, cls: b.className, visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length) })).filter((b) => b.visible),
    links: Array.from(document.querySelectorAll('a')).map((a, i) => ({ i, text: a.innerText.trim(), href: a.href })).filter((a) => a.text),
    body: document.body.innerText.slice(0, 2000)
  }));
  console.log(JSON.stringify(info, null, 2));
} finally { await context.close(); }
