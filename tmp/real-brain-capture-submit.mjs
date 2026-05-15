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

const context = await chromium.launchPersistentContext(profile, { headless: false });
try {
  const page = context.pages()[0] ?? await context.newPage();
  page.on('request', async (req) => {
    if (req.url().includes('/simulations') && req.method() === 'POST') {
      console.log('SIM_REQUEST_START');
      console.log(JSON.stringify({ url: req.url(), method: req.method(), postData: req.postData() }, null, 2));
      console.log('SIM_REQUEST_END');
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/simulations')) {
      console.log('SIM_RESPONSE_START');
      console.log(JSON.stringify({ url: res.url(), status: res.status(), headers: await res.allHeaders(), body: await res.text().catch(() => '') }, null, 2));
      console.log('SIM_RESPONSE_END');
    }
  });

  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="currentPassword"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(7000);
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);

  const skip = page.getByText('Skip');
  if (await skip.count()) {
    await skip.first().click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  const editorInput = page.locator('[role="textbox"].inputarea').first();
  await editorInput.click();
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.type('sales/cap');
  await page.waitForTimeout(1500);
  const simulateButton = page.getByRole('button', { name: /^Simulate$/ }).first();
  await simulateButton.click({ timeout: 10000 });
  await page.waitForTimeout(15000);
} finally {
  await context.close();
}
