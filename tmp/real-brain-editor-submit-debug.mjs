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
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/simulations')) {
      console.log('POST_URL=' + req.url());
      console.log('POST_BODY=' + req.postData());
    }
  });
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes('/simulations')) {
      console.log('POST_STATUS=' + res.status());
      console.log('POST_RESPONSE=' + await res.text().catch(() => ''));
    }
  });

  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="currentPassword"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(6000);
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape').catch(() => {});
  const textbox = page.locator('[role="textbox"].inputarea').first();
  await textbox.focus();
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.type('sales/cap');
  await page.waitForTimeout(1500);
  const values = await page.evaluate(() => ({
    inputareas: Array.from(document.querySelectorAll('[role="textbox"].inputarea')).map((el) => el.value),
    editorText: Array.from(document.querySelectorAll('[role="code"]')).map((el) => el.textContent).slice(0, 3),
    active: document.activeElement?.getAttribute('role') || document.activeElement?.tagName,
    bodyText: document.body.innerText.slice(0, 800)
  }));
  console.log(JSON.stringify(values, null, 2));
  const simButton = page.getByRole('button', { name: /^Simulate$/ }).first();
  await simButton.click({ force: true, timeout: 10000 });
  await page.waitForTimeout(12000);
} finally {
  await context.close();
}
