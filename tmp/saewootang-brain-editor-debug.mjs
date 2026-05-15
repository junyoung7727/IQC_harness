import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('credentials_not_found');

const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
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
      console.log('POST_HEADERS=' + JSON.stringify(await res.allHeaders()));
      console.log('POST_RESPONSE=' + await res.text().catch(() => ''));
    }
  });
  await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    await page.locator('input[name="email"]').fill(credentials.id, { timeout: 15000 });
    await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 15000 });
    await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 15000 });
    await page.waitForTimeout(6000);
  } catch {}
  await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape').catch(() => {});
  const textbox = page.locator('[role="textbox"].inputarea').first();
  console.log('TEXTBOX_COUNT=' + await page.locator('[role="textbox"].inputarea').count());
  console.log('CODE_COUNT=' + await page.locator('[role="code"]').count());
  if (await textbox.count()) {
    await textbox.focus();
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Backspace').catch(() => {});
    await page.keyboard.type('sales/cap');
    await page.waitForTimeout(1500);
  }
  const values = await page.evaluate(() => ({
    url: location.href,
    hasMonaco: typeof window.monaco !== 'undefined',
    modelValues: typeof window.monaco !== 'undefined' ? window.monaco.editor.getModels().map((m) => m.getValue().slice(0, 200)) : [],
    inputareas: Array.from(document.querySelectorAll('[role="textbox"].inputarea')).map((el) => el.value),
    editorText: Array.from(document.querySelectorAll('[role="code"]')).map((el) => (el.textContent || '').slice(0, 200)).slice(0, 3),
    buttons: Array.from(document.querySelectorAll('button')).map((b) => ({ text: b.innerText.trim(), disabled: b.disabled })).filter((b) => b.text).slice(0, 30),
    bodyText: document.body.innerText.slice(0, 1200)
  }));
  console.log(JSON.stringify(values, null, 2));
  const simButton = page.getByRole('button', { name: /^Simulate$/ }).first();
  console.log('SIM_BUTTON_DISABLED=' + await simButton.isDisabled().catch(() => 'unknown'));
  if (await simButton.count()) {
    await simButton.click({ force: true, timeout: 10000 }).catch((e) => console.log('CLICK_ERROR=' + e.message));
    await page.waitForTimeout(12000);
  }
} finally {
  await context.close();
}
