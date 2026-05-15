import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const brainAccount = 'oceanic.graph782@phuturemail.com';
const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong';
const credentials = findLoginEntry({ brainAccount, chromeProfile });

if (!credentials) {
  throw new Error('credentials_not_found');
}

const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });

  const emailCount = await page.locator('input[name="email"]').count();
  let postLoginUrl = page.url();
  let postLoginText = '';
  if (emailCount > 0) {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
    await page.waitForTimeout(10000);
    postLoginUrl = page.url();
    postLoginText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  }

  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);

  const signInCount = await page.locator('input[name="email"]').count();
  const cookies = await context.cookies();
  const cookieNames = cookies.map((cookie) => cookie.name);

  console.log(JSON.stringify({
    postLoginUrl,
    postLoginText,
    finalUrl: page.url(),
    signInFormVisible: signInCount > 0,
    cookieNames,
    authenticated: !page.url().includes('/sign-in') && signInCount === 0
  }, null, 2));
} finally {
  await context.close();
}
