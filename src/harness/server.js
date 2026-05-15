import http from 'node:http';
import { openDatabase } from './db.js';
import { HarnessRepository } from './repository.js';

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function routeMatch(pathname, regex) {
  const match = pathname.match(regex);
  return match ? match.slice(1) : null;
}

export function createServer({ dbPath }) {
  const db = openDatabase(dbPath);
  const repo = new HarnessRepository(db);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(res, 200, { status: 'ok' });
      }

      if (req.method === 'POST' && url.pathname === '/alphas') {
        const body = await readJson(req);
        const result = repo.submitAlpha({
          expression: body.expression,
          submittedBy: body.submittedBy ?? null,
          hypothesis: body.hypothesis ?? null
        });
        return jsonResponse(res, 200, result);
      }

      if (req.method === 'POST' && url.pathname === '/queue/request') {
        const body = await readJson(req);
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
        const body = await readJson(req);
        const result = repo.markRunning({ alphaId: Number(startMatch[0]), leaseId: body.leaseId });
        return jsonResponse(res, 200, result);
      }

      const resultMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)\/result$/);
      if (req.method === 'POST' && resultMatch) {
        const body = await readJson(req);
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
        const body = await readJson(req);
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

      const alphaMatch = routeMatch(url.pathname, /^\/alphas\/(\d+)$/);
      if (req.method === 'GET' && alphaMatch) {
        const alpha = repo.getAlpha(Number(alphaMatch[0]));
        if (!alpha) return jsonResponse(res, 404, { error: 'not_found' });
        return jsonResponse(res, 200, alpha);
      }

      return jsonResponse(res, 404, { error: 'not_found' });
    } catch (error) {
      return jsonResponse(res, 400, { error: error.message });
    }
  });

  return { server, repo };
}

export function startServer({ dbPath, port = 0 }) {
  const { server, repo } = createServer({ dbPath });
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
