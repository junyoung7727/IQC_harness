import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { openDatabase } from './db.js';
import { HarnessRepository } from './repository.js';

const DEFAULT_BODY_LIMIT_BYTES = 64 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_VIEWER_RATE_LIMIT = Object.freeze({
  maxUnauthorizedAttempts: 5,
  windowMs: 60_000,
  blockDurationMs: 60_000
});
const VIEWER_REALM = 'viewer';
const VIEWER_STATUSES = new Set([
  'pending',
  'leased',
  'running',
  'tested',
  'failed_retryable',
  'failed_terminal'
]);

class HttpError extends Error {
  constructor(statusCode, message, headers = null) {
    super(message);
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

function jsonResponse(res, statusCode, payload, headers = null) {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    ...(headers ?? {})
  });
  res.end(JSON.stringify(payload));
}

function htmlResponse(res, statusCode, html) {
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  });
  res.end(html);
}

async function readJson(req, { maxBytes = DEFAULT_BODY_LIMIT_BYTES } = {}) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new HttpError(413, 'request_too_large');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

function routeMatch(pathname, regex) {
  const match = pathname.match(regex);
  return match ? match.slice(1) : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderObjectTable(title, object) {
  const entries = Object.entries(object ?? {});
  if (!entries.length) {
    return `<section><h2>${escapeHtml(title)}</h2><p>None recorded.</p></section>`;
  }
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>
        <tbody>
          ${entries.map(([key, value]) => `
            <tr>
              <th scope="row">${escapeHtml(key)}</th>
              <td>${escapeHtml(value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderViewerLayout(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 2rem auto;
        max-width: 72rem;
        padding: 0 1rem 3rem;
        line-height: 1.45;
      }
      a { color: inherit; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        word-break: break-word;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin-top: 1rem;
      }
      th, td {
        border-bottom: 1px solid #8884;
        padding: 0.55rem;
        text-align: left;
        vertical-align: top;
      }
      th { font-weight: 600; }
      .meta {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        margin: 1rem 0 1.5rem;
      }
      .card {
        border: 1px solid #8884;
        border-radius: 0.5rem;
        padding: 0.75rem;
      }
      .muted { color: #666; }
      .expression {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .stack {
        display: grid;
        gap: 1.25rem;
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function renderViewerIndex(alphas, { status, limit }) {
  const rows = alphas.length
    ? alphas.map((alpha) => `
        <tr>
          <td><a href="/viewer/alphas/${alpha.alphaId}">${alpha.alphaId}</a></td>
          <td>${escapeHtml(alpha.status)}</td>
          <td>${escapeHtml(alpha.attemptCount)}</td>
          <td>${escapeHtml(alpha.metrics?.sharpe ?? '')}</td>
          <td>${escapeHtml(alpha.metrics?.fitness ?? '')}</td>
          <td><code>${escapeHtml(alpha.expression)}</code></td>
          <td>${escapeHtml(alpha.updatedAt)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="7">No matching alphas.</td></tr>';

  return renderViewerLayout(
    'Harness viewer',
    `
      <main class="stack">
        <header>
          <h1>Harness viewer</h1>
          <p class="muted">Read-only public surface. Private automation routes remain outside this UI.</p>
          <p class="muted">Showing up to ${escapeHtml(limit)} rows${status ? ` filtered by <code>${escapeHtml(status)}</code>` : ''}.</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Alpha</th>
              <th scope="col">Status</th>
              <th scope="col">Attempts</th>
              <th scope="col">Sharpe</th>
              <th scope="col">Fitness</th>
              <th scope="col">Expression</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </main>
    `
  );
}

function renderViewerDetail(alpha) {
  return renderViewerLayout(
    `Harness viewer alpha ${alpha.alphaId}`,
    `
      <main class="stack">
        <header>
          <p><a href="/viewer">← Back to viewer</a></p>
          <h1>Alpha ${escapeHtml(alpha.alphaId)}</h1>
        </header>
        <section>
          <h2>Expression</h2>
          <pre class="expression"><code>${escapeHtml(alpha.expression)}</code></pre>
        </section>
        <section>
          <h2>Hypothesis</h2>
          <p>${alpha.hypothesis ? escapeHtml(alpha.hypothesis) : 'None recorded.'}</p>
        </section>
        <section>
          <h2>Summary</h2>
          <div class="meta">
            <div class="card"><strong>Status</strong><div>${escapeHtml(alpha.status)}</div></div>
            <div class="card"><strong>Attempts</strong><div>${escapeHtml(alpha.attemptCount)}</div></div>
            <div class="card"><strong>Last error class</strong><div>${alpha.lastErrorClass ? escapeHtml(alpha.lastErrorClass) : 'None'}</div></div>
            <div class="card"><strong>Max similarity at submit</strong><div>${alpha.maxSimilarityAtSubmit == null ? '' : escapeHtml(alpha.maxSimilarityAtSubmit)}</div></div>
            <div class="card"><strong>Closest alpha at submit</strong><div>${alpha.closestAlphaIdAtSubmit == null ? '' : escapeHtml(alpha.closestAlphaIdAtSubmit)}</div></div>
            <div class="card"><strong>Updated</strong><div>${escapeHtml(alpha.updatedAt)}</div></div>
          </div>
          <p class="muted">Created ${escapeHtml(alpha.createdAt)}</p>
        </section>
        ${renderObjectTable('Observed settings', alpha.settings)}
        ${renderObjectTable('Observed metrics', alpha.metrics)}
      </main>
    `
  );
}

function resolveViewerAuth(viewerAuth) {
  const username = viewerAuth?.username ?? process.env.HARNESS_VIEWER_USERNAME ?? null;
  const password = viewerAuth?.password ?? process.env.HARNESS_VIEWER_PASSWORD ?? null;
  if (!username || !password) {
    return null;
  }
  return Buffer.from(`Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`, 'utf8');
}

function normalizeViewerRateLimit(viewerRateLimit) {
  if (viewerRateLimit === false) {
    return null;
  }

  const maxUnauthorizedAttempts = Number.isFinite(viewerRateLimit?.maxUnauthorizedAttempts)
    ? Math.max(1, Math.trunc(viewerRateLimit.maxUnauthorizedAttempts))
    : DEFAULT_VIEWER_RATE_LIMIT.maxUnauthorizedAttempts;
  const windowMs = Number.isFinite(viewerRateLimit?.windowMs)
    ? Math.max(1, Math.trunc(viewerRateLimit.windowMs))
    : DEFAULT_VIEWER_RATE_LIMIT.windowMs;
  const blockDurationMs = Number.isFinite(viewerRateLimit?.blockDurationMs)
    ? Math.max(1, Math.trunc(viewerRateLimit.blockDurationMs))
    : DEFAULT_VIEWER_RATE_LIMIT.blockDurationMs;

  return { maxUnauthorizedAttempts, windowMs, blockDurationMs };
}

function buildViewerRateLimitHeaders(retryAfterMs) {
  return {
    'retry-after': String(Math.max(1, Math.ceil(retryAfterMs / 1_000)))
  };
}

function getViewerRateLimitKey(req) {
  return req.socket?.remoteAddress ?? 'unknown';
}

function ensureViewerAuthorized(req, viewerAuthHeader, viewerRateLimitState = null) {
  if (!viewerAuthHeader) {
    throw new HttpError(503, 'viewer_auth_not_configured');
  }

  const now = Date.now();
  const rateLimit = viewerRateLimitState?.config ?? null;
  const key = viewerRateLimitState ? getViewerRateLimitKey(req) : null;
  const entry = key ? viewerRateLimitState.attempts.get(key) : null;

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    throw new HttpError(429, 'viewer_rate_limited', buildViewerRateLimitHeaders(entry.blockedUntil - now));
  }

  const authorization = Buffer.from(req.headers.authorization ?? '', 'utf8');
  const authorized = authorization.length === viewerAuthHeader.length && timingSafeEqual(authorization, viewerAuthHeader);
  if (authorized) {
    if (key) {
      viewerRateLimitState.attempts.delete(key);
    }
    return;
  }

  if (key && rateLimit) {
    const nextWindowStartedAt = entry?.windowStartedAt && now - entry.windowStartedAt < rateLimit.windowMs
      ? entry.windowStartedAt
      : now;
    const nextCount = nextWindowStartedAt === entry?.windowStartedAt
      ? (entry?.count ?? 0) + 1
      : 1;
    const nextEntry = {
      count: nextCount,
      windowStartedAt: nextWindowStartedAt,
      blockedUntil: 0
    };

    if (nextCount > rateLimit.maxUnauthorizedAttempts) {
      nextEntry.blockedUntil = now + rateLimit.blockDurationMs;
      viewerRateLimitState.attempts.set(key, nextEntry);
      throw new HttpError(429, 'viewer_rate_limited', buildViewerRateLimitHeaders(rateLimit.blockDurationMs));
    }

    viewerRateLimitState.attempts.set(key, nextEntry);
  }

  throw new HttpError(401, 'viewer_auth_required', {
    'www-authenticate': `Basic realm="${VIEWER_REALM}", charset="UTF-8"`
  });
}

function parseViewerListParams(url) {
  const rawStatus = url.searchParams.get('status');
  const status = rawStatus ? String(rawStatus).trim() : null;
  if (status && !VIEWER_STATUSES.has(status)) {
    throw new HttpError(400, 'invalid_viewer_status');
  }
  const rawLimit = url.searchParams.get('limit');
  const numericLimit = rawLimit === null ? 50 : Number(rawLimit);
  const limit = Number.isFinite(numericLimit) ? Math.min(Math.max(Math.trunc(numericLimit), 1), 100) : 50;
  return { status, limit };
}

export function createServer({
  dbPath,
  viewerAuth = null,
  viewerRateLimit = DEFAULT_VIEWER_RATE_LIMIT,
  bodyLimitBytes = DEFAULT_BODY_LIMIT_BYTES,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  const db = openDatabase(dbPath);
  const repo = new HarnessRepository(db);
  const viewerAuthHeader = resolveViewerAuth(viewerAuth);
  const viewerRateLimitConfig = normalizeViewerRateLimit(viewerRateLimit);
  const viewerRateLimitState = viewerRateLimitConfig
    ? { config: viewerRateLimitConfig, attempts: new Map() }
    : null;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(res, 200, { status: 'ok' });
      }

      if (req.method === 'GET' && (url.pathname === '/viewer' || url.pathname === '/viewer/')) {
        ensureViewerAuthorized(req, viewerAuthHeader, viewerRateLimitState);
        const params = parseViewerListParams(url);
        const alphas = repo.listViewerAlphas(params);
        return htmlResponse(res, 200, renderViewerIndex(alphas, params));
      }

      const viewerAlphaMatch = routeMatch(url.pathname, /^\/viewer\/alphas\/(\d+)$/);
      if (req.method === 'GET' && viewerAlphaMatch) {
        ensureViewerAuthorized(req, viewerAuthHeader, viewerRateLimitState);
        const alpha = repo.getViewerAlpha(Number(viewerAlphaMatch[0]));
        if (!alpha) return htmlResponse(res, 404, renderViewerLayout('Not found', '<main><h1>Not found</h1></main>'));
        return htmlResponse(res, 200, renderViewerDetail(alpha));
      }

      if (req.method === 'POST' && url.pathname === '/alphas') {
        const body = await readJson(req, { maxBytes: bodyLimitBytes });
        const result = repo.submitAlpha({
          expression: body.expression,
          submittedBy: body.submittedBy ?? null,
          hypothesis: body.hypothesis ?? null
        });
        return jsonResponse(res, 200, result);
      }

      if (req.method === 'POST' && url.pathname === '/queue/request') {
        const body = await readJson(req, { maxBytes: bodyLimitBytes });
        const result = repo.requestNext({
          count: body.count ?? 3,
          workerId: body.workerId,
          brainAccountId: body.brainAccount,
          chromeProfileId: body.chromeProfile
        });
        return jsonResponse(res, 200, result);
      }

      const startMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)\/start$/);
      if (req.method === 'POST' && startMatch) {
        const body = await readJson(req, { maxBytes: bodyLimitBytes });
        const result = repo.markRunning({ alphaId: Number(startMatch[0]), leaseId: body.leaseId });
        return jsonResponse(res, 200, result);
      }

      const resultMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)\/result$/);
      if (req.method === 'POST' && resultMatch) {
        const body = await readJson(req, { maxBytes: bodyLimitBytes });
        const result = repo.submitResult({
          alphaId: Number(resultMatch[0]),
          leaseId: body.leaseId,
          workerId: body.workerId,
          brainAccountId: body.brainAccount,
          chromeProfileId: body.chromeProfile,
          settings: body.settings,
          metrics: body.metrics
        });
        return jsonResponse(res, 200, result);
      }

      const failureMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)\/failure$/);
      if (req.method === 'POST' && failureMatch) {
        const body = await readJson(req, { maxBytes: bodyLimitBytes });
        const result = repo.reportFailure({
          alphaId: Number(failureMatch[0]),
          leaseId: body.leaseId,
          workerId: body.workerId,
          brainAccountId: body.brainAccount,
          chromeProfileId: body.chromeProfile,
          retryable: Boolean(body.retryable),
          failureClass: body.failureClass ?? 'execution_error',
          failureMessage: body.failureMessage ?? 'unknown failure'
        });
        return jsonResponse(res, 200, result);
      }

      const requeueMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)\/requeue$/);
      if (req.method === 'POST' && requeueMatch) {
        const result = repo.requeueRetryable(Number(requeueMatch[0]));
        return jsonResponse(res, 200, result);
      }

      if (req.method === 'POST' && url.pathname === '/admin/reset-pending') {
        const result = repo.resetLeasedAndRetryableToPending();
        return jsonResponse(res, 200, result);
      }

      const alphaMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)$/);
      if (req.method === 'GET' && alphaMatch) {
        const alpha = repo.getAlpha(Number(alphaMatch[0]));
        if (!alpha) return jsonResponse(res, 404, { error: 'not_found' });
        return jsonResponse(res, 200, alpha);
      }

      return jsonResponse(res, 404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(res, error.statusCode, { error: error.message }, error.headers);
      }
      return jsonResponse(res, 400, { error: error.message });
    }
  });

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs + 1_000;
  server.timeout = requestTimeoutMs;

  return { server, repo };
}

export function startServer(options) {
  const { port = 0 } = options;
  const { server, repo } = createServer(options);
  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      resolve({ server, repo, port: address.port, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const dbPath = process.env.HARNESS_DB_PATH ?? new URL('../../tmp/harness.db', import.meta.url).pathname;
  const port = Number(process.env.PORT ?? '3000');
  const { port: boundPort } = await startServer({ dbPath, port });
  console.log(`server listening on ${boundPort}`);
}
