import { chromium } from 'playwright';
import { findLoginEntry } from './login-map.js';

const LIVE_SIGN_IN_URL = 'https://platform.worldquantbrain.com/sign-in';
const LIVE_SIMULATE_URL = 'https://platform.worldquantbrain.com/simulate';
const LIVE_SIMULATIONS_URL = 'https://api.worldquantbrain.com/simulations';
const LIVE_AUTH_PROOF_URL = 'https://api.worldquantbrain.com/users/self/messages/summary';

const RETRYABLE_NAVIGATION_ERROR_PATTERNS = [
  /ERR_NETWORK_CHANGED/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /ERR_NAME_RESOLUTION_FAILED/i,
  /ERR_CONNECTION_RESET/i,
  /ERR_CONNECTION_REFUSED/i,
  /ERR_CONNECTION_CLOSED/i,
  /ERR_CONNECTION_TIMED_OUT/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /ERR_NETWORK_ACCESS_DENIED/i,
  /ERR_ADDRESS_UNREACHABLE/i,
  /ERR_CONNECTION_ABORTED/i,
  /navigation timeout/i,
  /Target page, context or browser has been closed/i
];

const gotoRetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 750
};

function looksRetryable(error) {
  const message = `${error?.message ?? ''} ${error?.name ?? ''}`;
  return RETRYABLE_NAVIGATION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function gotoWithRetry(page, url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= gotoRetryOptions.maxAttempts; attempt += 1) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      lastError = error;
      const retryable = looksRetryable(error);
      const isLast = attempt >= gotoRetryOptions.maxAttempts;
      if (isLast || !retryable) {
        const brainError = retryable
          ? createBrainError(`brain_navigation_failed_retry_exhausted:${url}:${error.message}`, 'transient_navigation_error', true)
          : createBrainError(`brain_navigation_failed:${url}:${error.message}`, 'navigation_error', false);
        throw brainError;
      }
      await sleep(gotoRetryOptions.initialDelayMs * attempt);
    }
  }

  const fallbackError = createBrainError(`brain_navigation_failed_exhausted:${url}:${lastError?.message ?? 'unknown'}`, 'transient_navigation_error', true);
  throw fallbackError;
}

async function launchBrainContext(chromeProfile, headed) {
  try {
    return await chromium.launchPersistentContext(chromeProfile, { channel: 'chrome', headless: !headed });
  } catch (error) {
    if (looksRetryable(error)) {
      const wrapped = createBrainError(`brain_context_launch_failed:${error.message}`, 'transient_browser_start', true);
      wrapped.cause = error;
      throw wrapped;
    }
    const wrapped = createBrainError(`brain_context_launch_failed:${error.message}`, 'browser_start_error', false);
    wrapped.cause = error;
    throw wrapped;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createBrainError(message, failureClass, retryable) {
  const error = new Error(message);
  error.failureClass = failureClass;
  error.retryable = retryable;
  return error;
}

function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeSimulationLocation(location) {
  if (typeof location !== 'string' || !location) return null;
  if (/^https?:\/\//.test(location)) return location;
  return new URL(location, `${LIVE_SIMULATIONS_URL}/`).toString();
}

function extractSimulationLocation(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.location === 'string' && payload.location) return normalizeSimulationLocation(payload.location);
  if (typeof payload.url === 'string' && payload.url) return normalizeSimulationLocation(payload.url);
  if (typeof payload.id === 'string' && payload.id) return `${LIVE_SIMULATIONS_URL}/${payload.id}`;
  if (typeof payload.id === 'number') return `${LIVE_SIMULATIONS_URL}/${payload.id}`;
  if (payload.task && typeof payload.task === 'object') {
    return extractSimulationLocation(payload.task);
  }
  if (payload.simulation && typeof payload.simulation === 'object') {
    return extractSimulationLocation(payload.simulation);
  }
  return null;
}

function isWalkthroughSimulationLocation(location) {
  return typeof location === 'string' && location.includes('sample-simulation-id-walkthrough');
}

export function resolveSimulationSubmission(response) {
  const location = normalizeSimulationLocation(response.headers.location) ?? extractSimulationLocation(tryParseJson(response.text));
  if (response.status === 201 || response.status === 200) {
    if (location) {
      if (isWalkthroughSimulationLocation(location)) {
        const error = createBrainError(`simulation_submit_walkthrough:${response.status}:${response.text}`, 'workflow_state_blocked', true);
        error.responseStatus = response.status;
        throw error;
      }
      return {
        location,
        retryAfterMs: Math.ceil(Number(response.headers['retry-after'] ?? '5') * 1000)
      };
    }
  }

  if (response.status === 200) {
    const error = createBrainError(`simulation_submit_inconclusive:${response.status}:${response.text}`, 'submission_pending_uncertain', true);
    error.responseStatus = response.status;
    throw error;
  }

  const error = createBrainError(`simulation_submit_failed:${response.status}:${response.text}`, 'submission_error', response.status >= 500 || response.status === 429);
  error.responseStatus = response.status;
  throw error;
}

export function assertAuthenticatedNavigationState({ currentUrl, hasSignInForm, protectedStatus }) {
  if (currentUrl.includes('/sign-in') || hasSignInForm) {
    throw createBrainError('brain_session_not_authenticated', 'auth_state_proof_failed', true);
  }
  if (protectedStatus === 401 || protectedStatus === 403) {
    throw createBrainError(`brain_session_proof_failed:${protectedStatus}`, 'auth_state_proof_failed', true);
  }
}

async function fetchProtectedStatus(page) {
  const response = await fetchJsonInPage(page, LIVE_AUTH_PROOF_URL, { method: 'GET', headers: {} });
  return response.status;
}

export async function verifyBrainSession(page) {
  const currentUrl = page.url();
  const hasSignInForm = await page.locator('input[name="email"]').count();
  const protectedStatus = await fetchProtectedStatus(page);
  assertAuthenticatedNavigationState({ currentUrl, hasSignInForm: hasSignInForm > 0, protectedStatus });
  return { currentUrl, protectedStatus };
}

function getActivePage(page) {
  return [...page.context().pages()].reverse().find((candidate) => !candidate.isClosed()) ?? page;
}

async function dismissCookieBanner(page) {
  const activePage = getActivePage(page);
  const acceptAll = activePage.getByRole('button', { name: 'Accept All' });
  if (await acceptAll.count()) {
    await acceptAll.click({ timeout: 5000 }).catch(() => {});
    await activePage.waitForTimeout(1000);
  }
  return activePage;
}

async function waitForLoginReady(page, maxWaitMs = 30000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const activePage = await dismissCookieBanner(page);
    const hasSignInForm = await activePage.locator('input[name="email"]').count();
    if (hasSignInForm > 0) {
      return { state: 'form', page: activePage };
    }
    try {
      const protectedStatus = await fetchProtectedStatus(activePage);
      if (protectedStatus === 200) {
        return { state: 'authenticated', page: activePage };
      }
    } catch {}
    await activePage.waitForTimeout(1000);
  }
  return { state: 'unknown', page: getActivePage(page) };
}

async function waitForAuthenticationBootstrap(page, maxWaitMs = 45000) {
  const deadline = Date.now() + maxWaitMs;
  let lastStatus = null;
  while (Date.now() < deadline) {
    const activePage = await dismissCookieBanner(page);
    try {
      lastStatus = await fetchProtectedStatus(activePage);
      if (lastStatus === 200) {
        return activePage;
      }
    } catch {}
    await activePage.waitForTimeout(1000);
  }
  throw createBrainError(`brain_auth_bootstrap_timeout:${lastStatus ?? 'unknown'}`, 'auth_interactive_required', false);
}

async function clearSimulationTutorial(page, maxSteps = 15) {
  let activePage = getActivePage(page);
  for (let i = 0; i < maxSteps; i += 1) {
    activePage = await dismissCookieBanner(activePage);
    const continueButton = activePage.getByRole('link', { name: 'Continue' }).or(activePage.getByRole('button', { name: 'Continue' }));
    if (await continueButton.count()) {
      await continueButton.first().click({ timeout: 5000 }).catch(() => {});
      await activePage.waitForTimeout(1500);
      continue;
    }
    const skipButton = activePage.getByRole('link', { name: 'Skip' }).or(activePage.getByRole('button', { name: 'Skip' }));
    if (await skipButton.count()) {
      await skipButton.first().click({ timeout: 5000 }).catch(() => {});
      await activePage.waitForTimeout(1500);
      continue;
    }
    break;
  }
  return activePage;
}

async function ensureLoggedIn(page, credentials) {
  let activePage = getActivePage(page);
  await gotoWithRetry(activePage, LIVE_SIGN_IN_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await activePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const loginReady = await waitForLoginReady(activePage);
  activePage = loginReady.page;
  if (loginReady.state === 'form') {
    try {
      await activePage.locator('input[name="email"]').fill(credentials.id, { timeout: 30000 });
      await activePage.locator('input[name="currentPassword"]').fill(credentials.password, { timeout: 30000 });
      await activePage.getByRole('button', { name: 'Sign In' }).click({ timeout: 30000 });
      activePage = await waitForAuthenticationBootstrap(activePage);
    } catch (error) {
      throw createBrainError(`brain_login_failed:${error.message}`, 'auth_interactive_required', false);
    }
  } else if (loginReady.state !== 'authenticated') {
    throw createBrainError('brain_login_form_not_ready', 'auth_interactive_required', false);
  }

  activePage = getActivePage(activePage);
  await gotoWithRetry(activePage, LIVE_SIMULATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await activePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  activePage = await clearSimulationTutorial(activePage);
  const proof = await verifyBrainSession(activePage);
  return { page: activePage, proof };
}

async function fetchJsonInPage(page, url, options = {}) {
  return page.evaluate(async ({ url, options }) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.body && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text
    };
  }, { url, options });
}

export function buildSimulationPayload(expression) {
  return {
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
    regular: expression
  };
}

async function submitSimulation(page, expression) {
  const payload = buildSimulationPayload(expression);

  const response = await fetchJsonInPage(page, LIVE_SIMULATIONS_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  const submission = resolveSimulationSubmission(response);
  return {
    ...submission,
    settings: payload.settings
  };
}

async function submitSimulationWithRelogin(page, credentials, expression) {
  try {
    return await submitSimulation(page, expression);
  } catch (error) {
    if (error.responseStatus === 401) {
      await ensureLoggedIn(page, credentials);
      await verifyBrainSession(page);
      return submitSimulation(page, expression);
    }
    if (error.failureClass === 'workflow_state_blocked') {
      await clearSimulationTutorial(page);
      return submitSimulation(page, expression);
    }
    throw error;
  }
}

async function pollSimulation(page, location, maxPolls = 120) {
  let lastPayload = null;
  for (let i = 0; i < maxPolls; i += 1) {
    const response = await fetchJsonInPage(page, location, { method: 'GET', headers: {} });
    if (response.status >= 400) {
      const failureClass = response.status === 401 || response.status === 403 ? 'auth_session_expired' : 'poll_error';
      const error = createBrainError(`simulation_poll_failed:${response.status}:${response.text}`, failureClass, response.status >= 500 || response.status === 429 || response.status === 404);
      error.responseStatus = response.status;
      throw error;
    }
    const payload = response.text ? JSON.parse(response.text) : {};
    lastPayload = payload;
    if (payload.status === 'COMPLETE' || payload.status === 'WARNING' || payload.status === 'ERROR' || payload.status === 'FAIL') {
      return payload;
    }
    if (typeof payload.progress === 'number') {
      await sleep(5000);
      continue;
    }
    await sleep(5000);
  }

  const error = new Error(`simulation_poll_timeout:${JSON.stringify(lastPayload ?? {})}`);
  error.failureClass = 'poll_timeout';
  error.retryable = true;
  throw error;
}

async function fetchAlphaResult(page, alphaId) {
  const response = await fetchJsonInPage(page, `${LIVE_SIMULATIONS_URL.replace('/simulations', '')}/alphas/${alphaId}`, { method: 'GET', headers: {} });
  if (response.status === 401 || response.status === 403) {
    throw createBrainError(`alpha_result_unauthorized:${response.status}`, 'auth_session_expired', false);
  }
  if (response.status >= 400) {
    return null;
  }
  return response.text ? JSON.parse(response.text) : null;
}

export async function preflightBrainAccess({ brainAccount, chromeProfile, headed = false }) {
  const credentials = findLoginEntry({ brainAccount, chromeProfile });
  if (!credentials) {
    throw createBrainError('missing_brain_credentials', 'credential_binding_error', false);
  }

  const context = await launchBrainContext(chromeProfile, headed);
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const { proof } = await ensureLoggedIn(page, credentials);
    return proof;
  } finally {
    await context.close();
  }
}

export async function runBrainSimulation({ brainAccount, chromeProfile, expression, headed = false }) {
  const credentials = findLoginEntry({ brainAccount, chromeProfile });
  if (!credentials) {
    const error = createBrainError('missing_brain_credentials', 'credential_binding_error', false);
    throw error;
  }

  const context = await launchBrainContext(chromeProfile, headed);
  try {
    const page = context.pages()[0] ?? await context.newPage();
    let { page: activePage } = await ensureLoggedIn(page, credentials);
    const submission = await submitSimulationWithRelogin(activePage, credentials, expression);
    await sleep(submission.retryAfterMs);
    const simulation = await pollSimulation(activePage, submission.location);
    const alphaPayload = simulation.alpha ? await fetchAlphaResult(activePage, simulation.alpha) : null;

    if (simulation.status === 'ERROR' || simulation.status === 'FAIL') {
      const error = new Error(simulation.message ?? simulation.status);
      error.failureClass = 'simulation_error';
      error.retryable = false;
      throw error;
    }

    return {
      settings: submission.settings,
      metrics: {
        simulationStatus: simulation.status ?? null,
        simulationProgress: simulation.progress ?? null,
        alphaId: simulation.alpha ?? null,
        sharpe: alphaPayload?.is?.sharpe ?? null,
        fitness: alphaPayload?.is?.fitness ?? null,
        turnover: alphaPayload?.is?.turnover ?? null,
        grade: alphaPayload?.grade ?? null
      }
    };
  } finally {
    await context.close();
  }
}
