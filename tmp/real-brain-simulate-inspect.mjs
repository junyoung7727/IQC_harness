import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const text = readFileSync('C:/Users/user/worldquant-alpha-lab/worldquant-login.md', 'utf8');
const blocks = text.split('---').map((s) => s.trim()).filter(Boolean);
const target = blocks.find((b) => /agent:\s*육개장/.test(b));
if (!target) throw new Error('agent_not_found');

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
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    buttons: Array.from(document.querySelectorAll('button')).map((b) => b.innerText.trim()).filter(Boolean).slice(0, 50),
    text: document.body.innerText.slice(0, 2000)
  }));
  console.log(JSON.stringify(info, null, 2));
} finally {
  await context.close();
}
