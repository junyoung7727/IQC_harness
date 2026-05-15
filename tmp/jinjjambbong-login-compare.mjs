import { chromium } from 'playwright';

const chromeProfile = 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong';

async function inspect(label, options) {
  const context = await chromium.launchPersistentContext(chromeProfile, options);
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const consoleMessages = [];
    page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => consoleMessages.push(`[pageerror] ${err.message}`));

    await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(15000);
    await page.screenshot({ path: `tmp/${label}.png`, fullPage: true });

    const result = {
      label,
      url: page.url(),
      title: await page.title(),
      text: await page.evaluate(() => document.body.innerText.slice(0, 1000)),
      emailCount: await page.locator('input[name="email"]').count(),
      spinnerLike: await page.evaluate(() => /loading|please wait/i.test(document.body.innerText) || document.querySelectorAll('svg, [class*=spinner], [class*=loading]').length > 0),
      consoleMessages: consoleMessages.slice(0, 30)
    };
    return result;
  } finally {
    await context.close();
  }
}

const outputs = [];
for (const config of [
  { label: 'chromium-headless', options: { headless: true } },
  { label: 'chrome-headless', options: { channel: 'chrome', headless: true } },
  { label: 'chrome-headed', options: { channel: 'chrome', headless: false } }
]) {
  try {
    outputs.push(await inspect(config.label, config.options));
  } catch (error) {
    outputs.push({ label: config.label, error: error.message });
  }
}

console.log(JSON.stringify(outputs, null, 2));
