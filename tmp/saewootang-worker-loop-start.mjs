import { markRunning, reportFailure, requestNext, submitResult } from '../src/harness/client.js';
import { chromium } from 'playwright';
import { findLoginEntry } from '../src/harness/login-map.js';

const serverUrl = 'http://127.0.0.1:3000';
const workerId = '새우탕';
const brainAccount = 'mask.27-e61ff11f@phuturemail.com';
const chromeProfile = 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang';
const credentials = findLoginEntry({ brainAccount, chromeProfile });
if (!credentials) throw new Error('credentials_not_found');
const initialBatch = { count: 3, leaseId: '05be5ad4-17f0-4514-acff-833371cc42d8', items: [
  { alphaId: 14, expression: 'rank(subtract(sqrt(multiply(high, low)), vwap))', attemptCount: 1 },
  { alphaId: 15, expression: 'rank(correlation(vwap, adv180, 18))', attemptCount: 1 },
  { alphaId: 16, expression: '-ts_zscore(debt, 252)', attemptCount: 1 }
] };
const SETTINGS = { nanHandling:'ON', instrumentType:'EQUITY', delay:1, universe:'TOP3000', truncation:0.08, unitHandling:'VERIFY', testPeriod:'P3Y', pasteurization:'ON', region:'USA', language:'FASTEXPR', decay:4, neutralization:'MARKET', visualization:false };
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function fetchJsonInPage(page, url, options = {}) { return page.evaluate(async ({ url, options }) => { const response = await fetch(url, { credentials: 'include', ...options, headers: { 'content-type': 'application/json', ...(options.headers ?? {}) } }); const text = await response.text(); return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text }; }, { url, options }); }
async function login(page) { await page.goto('https://platform.worldquantbrain.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 }); await page.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 }); await page.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 }); await page.waitForTimeout(10000); }
async function runExpression(expression) {
  const context = await chromium.launchPersistentContext(chromeProfile, { headless: true });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await login(page);
    await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);
    if (page.url().includes('/sign-in')) { await login(page); await page.goto('https://platform.worldquantbrain.com/simulate', { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForTimeout(8000); }
    const skip = page.getByText('Skip', { exact: true });
    if (await skip.count()) { await skip.click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(2000); }
    const post = await fetchJsonInPage(page, 'https://api.worldquantbrain.com/simulations', { method: 'POST', body: JSON.stringify({ type: 'REGULAR', settings: SETTINGS, regular: expression }) });
    if (post.status !== 201 || !post.headers.location) { const error = new Error(`submit_failed_${post.status}`); error.failureClass = 'submission_error'; error.retryable = post.status >= 500 || post.status === 429 || post.status === 401; throw error; }
    await sleep(Math.ceil(Number(post.headers['retry-after'] ?? '5') * 1000));
    let simulation = null;
    for (let i = 0; i < 120; i += 1) { const poll = await fetchJsonInPage(page, post.headers.location, { method: 'GET', headers: {} }); if (poll.status >= 400) { const error = new Error(`poll_failed_${poll.status}`); error.failureClass = 'poll_error'; error.retryable = poll.status >= 500 || poll.status === 429 || poll.status === 404; throw error; } simulation = poll.text ? JSON.parse(poll.text) : {}; if (['COMPLETE', 'WARNING', 'ERROR', 'FAIL'].includes(simulation.status)) break; await sleep(5000); }
    if (!simulation || !['COMPLETE', 'WARNING', 'ERROR', 'FAIL'].includes(simulation.status)) { const error = new Error('poll_timeout'); error.failureClass = 'poll_timeout'; error.retryable = true; throw error; }
    let alphaPayload = null; let alphaFetchError = null;
    if (simulation?.alpha) { for (let i = 0; i < 5; i += 1) { try { const alphaResp = await fetchJsonInPage(page, `https://api.worldquantbrain.com/alphas/${simulation.alpha}`, { method: 'GET', headers: {} }); if (alphaResp.status < 400) { alphaPayload = alphaResp.text ? JSON.parse(alphaResp.text) : null; break; } alphaFetchError = `alpha_fetch_status_${alphaResp.status}`; } catch (error) { alphaFetchError = error.message; } await sleep(5000); } }
    if (simulation.status === 'ERROR' || simulation.status === 'FAIL') { const error = new Error(simulation.message ?? simulation.status); error.failureClass = 'simulation_error'; error.retryable = false; throw error; }
    return { settings: SETTINGS, metrics: { simulationStatus: simulation?.status ?? null, simulationProgress: simulation?.progress ?? null, alphaId: simulation?.alpha ?? null, sharpe: alphaPayload?.is?.sharpe ?? null, fitness: alphaPayload?.is?.fitness ?? null, turnover: alphaPayload?.is?.turnover ?? null, grade: alphaPayload?.grade ?? null, message: simulation?.message ?? null, alphaFetchError, location: post.headers.location } };
  } finally { await context.close(); }
}
async function processBatch(batch) {
  const success_submissions = []; const failure_submissions = [];
  for (const item of batch.items) {
    await markRunning(serverUrl, { alphaId: item.alphaId, leaseId: batch.leaseId });
    try {
      const result = await runExpression(item.expression);
      const submission = await submitResult(serverUrl, { alphaId: item.alphaId, leaseId: batch.leaseId, workerId, brainAccount, chromeProfile, settings: result.settings, metrics: result.metrics });
      success_submissions.push({ alphaId: item.alphaId, state: submission.state, metrics: result.metrics });
    } catch (error) {
      const retryable = Boolean(error.retryable);
      const failure = await reportFailure(serverUrl, { alphaId: item.alphaId, leaseId: batch.leaseId, workerId, brainAccount, chromeProfile, retryable, failureClass: error.failureClass ?? 'execution_error', failureMessage: error.message });
      failure_submissions.push({ alphaId: item.alphaId, state: failure.state, retryable, failureClass: error.failureClass ?? 'execution_error', error: error.message });
    }
  }
  return { success_submissions, failure_submissions };
}
let first = true;
while (true) {
  const batch = first ? initialBatch : await requestNext(serverUrl, { count: 3, workerId, brainAccount, chromeProfile });
  first = false;
  if (batch.count === 0) {
    console.log('- request_result: status=ok, count=0, lease_id=' + (batch.leaseId ?? ''));
    console.log('- leased_alpha_ids: []');
    console.log('- success_submissions: []');
    console.log('- failure_submissions: []');
    console.log('- next_action: queue empty, worker stop');
    console.log('queue empty, worker stop');
    break;
  }
  const leasedIds = batch.items.map((item) => item.alphaId);
  const { success_submissions, failure_submissions } = await processBatch(batch);
  console.log('- request_result: status=ok, count=' + batch.count + ', lease_id=' + batch.leaseId);
  console.log('- leased_alpha_ids: ' + JSON.stringify(leasedIds));
  console.log('- success_submissions: ' + JSON.stringify(success_submissions));
  console.log('- failure_submissions: ' + JSON.stringify(failure_submissions));
  console.log('- next_action: request next alpha 3');
}
