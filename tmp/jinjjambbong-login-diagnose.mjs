import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const brainAccount = 'oceanic.graph782@phuturemail.com';
const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong';
const credentials = findLoginEntry({ brainAccount, chromeProfile });

if (!credentials) throw new Error('credentials_not_found');

const network = [];
const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  page.on('response', async (response) => {
    const url = response.url();
    if (/worldquantbrain|persona|auth|login|sign-in/i.test(url)) {
      let body = '';
      try {
        if (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
          body = (await response.text()).slice(0, 500);
        }
      } catch {}
      network.push({
        url,
        status: response.status(),
        method: response.request().method(),
        resourceType: response.request().resourceType(),
        body
      });
    }
  });

  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.screenshot({ path: 'tmp/jinjjambbong-before-login.png', fullPage: true });
  const before = {
    url: page.url(),
    title: await page.title(),
    text: await page.evaluate(() => document.body.innerText.slice(0, 1000)),
    emailCount: await page.locator('input[name="email"]').count(),
    passwordCount: await page.locator('input[name="currentPassword"]').count(),
    buttonTexts: await page.locator('button').evaluateAll((els) => els.map((el) => el.textContent?.trim()).filter(Boolean))
  };

  if (before.emailCount > 0) {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
    await page.waitForTimeout(15000);
  }

  await page.screenshot({ path: 'tmp/jinjjambbong-after-login.png', fullPage: true });
  const afterLogin = {
    url: page.url(),
    title: await page.title(),
    text: await page.evaluate(() => document.body.innerText.slice(0, 1500)),
    htmlSnippet: (await page.content()).slice(0, 2000),
    emailCount: await page.locator('input[name="email"]').count(),
    passwordCount: await page.locator('input[name="currentPassword"]').count(),
    iframeSrcs: await page.locator('iframe').evaluateAll((els) => els.map((el) => el.getAttribute('src')).filter(Boolean))
  };

  const cookies = await context.cookies();

  console.log(JSON.stringify({
    before,
    afterLogin,
    cookies: cookies.map((cookie) => ({ name: cookie.name, domain: cookie.domain, expires: cookie.expires })),
    network
  }, null, 2));
} finally {
  await context.close();
}
