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
  console.log('STEP1=' + page.url());
  const count = await page.locator('input[name="email"]').count();
  console.log('EMAIL_INPUT_COUNT=' + count);
  if (count) {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="currentPassword"]').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(6000);
  }
  console.log('STEP2=' + page.url());
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  console.log('STEP3=' + page.url());
  const state = await page.evaluate(() => ({ localKeys: Object.keys(localStorage), body: document.body.innerText.slice(0,300) }));
  console.log(JSON.stringify(state, null, 2));
  const cookies = await context.cookies();
  console.log('COOKIE_NAMES=' + cookies.map(c => c.name).join(','));
  const response = await page.evaluate(async () => {
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
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.text() };
  });
  console.log(JSON.stringify(response, null, 2));
} finally {
  await context.close();
}
