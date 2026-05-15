function base(baseUrl) {
  return baseUrl.replace(/\/$/, '');
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) }
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `http_${response.status}`);
  }
  return payload;
}

export async function submitAlpha(baseUrl, expression, submittedBy = null, hypothesis = null) {
  return requestJson(`${base(baseUrl)}/alphas`, {
    method: 'POST',
    body: JSON.stringify({ expression, submittedBy, hypothesis })
  });
}

export async function requestNext(baseUrl, { count = 3, workerId, brainAccount, chromeProfile }) {
  return requestJson(`${base(baseUrl)}/queue/request`, {
    method: 'POST',
    body: JSON.stringify({ count, workerId, brainAccount, chromeProfile })
  });
}

export async function markRunning(baseUrl, { alphaId, leaseId }) {
  return requestJson(`${base(baseUrl)}/alphas/${alphaId}/start`, {
    method: 'POST',
    body: JSON.stringify({ leaseId })
  });
}

export async function submitResult(baseUrl, payload) {
  return requestJson(`${base(baseUrl)}/alphas/${payload.alphaId}/result`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function reportFailure(baseUrl, payload) {
  return requestJson(`${base(baseUrl)}/alphas/${payload.alphaId}/failure`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function requeue(baseUrl, alphaId) {
  return requestJson(`${base(baseUrl)}/alphas/${alphaId}/requeue`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function getAlpha(baseUrl, alphaId) {
  return requestJson(`${base(baseUrl)}/alphas/${alphaId}`, { method: 'GET', headers: {} });
}
