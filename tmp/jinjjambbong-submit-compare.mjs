import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong';
const credentials = findLoginEntry({ brainAccount: 'oceanic.graph782@phuturemail.com', chromeProfile });
if (!credentials) throw new Error('credentials_not_found');

async function inspect(label, options) {
  const context = await chromium.launchPersistentContext(chromeProfile, options);
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const events = [];
    const add = (kind, data) => events.push({ kind, ...data });
    page.on('response', async (response) => {
      const req = response.request();
      if (['xhr', 'fetch', 'document'].includes(req.resourceType()) && /worldquantbrain|authentication|persona|signin|sign-in/i.test(response.url())) {
        let body = '';
        try { if (req.resourceType() !== 'document') body = (await response.text()).slice(0, 300); } catch {}
        add('response', { url: response.url(), status: response.status(), method: req.method(), resourceType: req.resourceType(), body });
      }
    });
    context.on('page', (p) => add('new-page', { url: p.url() }));

    await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(15000);

    const acceptAll = page.getByRole('button', { name: 'Accept All' });
    if (await acceptAll.count()) {
      await acceptAll.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
    await page.screenshot({ path: `tmp/${label}-before-submit.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
    await page.waitForTimeout(20000);
    await page.screenshot({ path: `tmp/${label}-after-submit.png`, fullPage: true });

    const cookies = await context.cookies();
    return {
      label,
      finalUrl: page.url(),
      title: await page.title(),
      text: await page.evaluate(() => document.body.innerText.slice(0, 1200)),
      emailCount: await page.locator('input[name="email"]').count(),
      passwordCount: await page.locator('input[name="currentPassword"]').count(),
      cookies: cookies.map((c) => ({ name: c.name, domain: c.domain })),
      events
    };
  } finally {
    await context.close();
  }
}

const outputs = [];
for (const config of [
  { label: 'chromium-headless-submit', options: { headless: true } },
  { label: 'chrome-headless-submit', options: { channel: 'chrome', headless: true } },
  { label: 'chrome-headed-submit', options: { channel: 'chrome', headless: false } }
]) {
  try {
    outputs.push(await inspect(config.label, config.options));
  } catch (error) {
    outputs.push({ label: config.label, error: error.message });
  }
}

console.log(JSON.stringify(outputs, null, 2));
