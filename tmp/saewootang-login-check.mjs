import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';
const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[name="email"]').fill(credentials.id);
  await page.locator('input[name="currentPassword"]').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(10000);
  const info = await page.evaluate(() => ({ url: location.href, title: document.title, bodyText: document.body.innerText.slice(0, 1200) }));
  console.log(JSON.stringify(info, null, 2));
} finally { await context.close(); }
