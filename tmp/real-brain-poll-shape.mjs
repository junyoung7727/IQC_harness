import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const text = readFileSync('C:/Users/user/worldquant-alpha-lab/worldquant-login.md', 'utf8');
const blocks = text.split('---').map((s) => s.trim()).filter(Boolean);
const target = blocks.find((b) => /agent:\s*육개장/.test(b));
function pick(key) {
  const match = target.match(new RegExp(`${key}:\\s*(.+)`));
  return match ? match[1].trim() : '';
}
const profile = pick('chrome_profile_dir');
const email = pick('id');
const password = pick('ps');

const context = await chromium.launchPersistentContext(profile, { headless: true });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="currentPassword"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(6000);
  const post = await page.evaluate(async () => {
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
      regular: 'sales/cap'
    };
    const res = await fetch('https://api.worldquantbrain.com/simulations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { status: res.status, location: res.headers.get('location'), retryAfter: res.headers.get('retry-after') };
  });
  console.log('POST=' + JSON.stringify(post));
  await page.waitForTimeout(Number(post.retryAfter || '5') * 1000);
  const poll = await page.evaluate(async (location) => {
    const res = await fetch(location, { credentials: 'include' });
    return { status: res.status, body: await res.text() };
  }, post.location);
  console.log('POLL=' + poll.body);
} finally {
  await context.close();
}
