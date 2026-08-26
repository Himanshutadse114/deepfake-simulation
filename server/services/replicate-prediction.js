const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');

const API = 'https://api.replicate.com/v1';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function authHeaders(extra = {}) {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return {
    authorization: `Bearer ${config.providers.replicateToken}`,
    accept: 'application/json',
    ...extra
  };
}

function modelParts(model) {
  const [owner, name, extra] = String(model || '').split('/');
  if (!owner || !name || extra) throw new Error(`Expected an official Replicate model in owner/name form, received: ${model}`);
  return { owner, name };
}

async function parseResponse(response, label, { creation = false } = {}) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const message = payload?.detail || payload?.error || payload?.message || `${label} failed (${response.status}).`;
  const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
  error.status = response.status;
  error.request = { url: response.url };
  error.response = { status: response.status, headers: response.headers, url: response.url };

  if (creation && response.status !== 429) {
    error.nonRetryable = true;
    error.code = 'REPLICATE_CREATE_FAILED_NO_BLIND_RETRY';
  }
  throw error;
}

async function createOfficialPrediction(model, input, { cancelAfter = '5m' } = {}) {
  const { owner, name } = modelParts(model);
  const url = `${API}/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders({
        'content-type': 'application/json',
        'Cancel-After': cancelAfter
      }),
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (cause) {
    const error = new Error(`Could not confirm whether ${model} accepted the prediction creation request. Automatic recreation is blocked to prevent duplicate spend: ${cause.message}`);
    error.code = 'REPLICATE_CREATE_AMBIGUOUS';
    error.nonRetryable = true;
    error.cause = cause;
    throw error;
  }
  return parseResponse(response, `${model} prediction creation`, { creation: true });
}

async function getPrediction(predictionId) {
  const response = await fetch(`${API}/predictions/${encodeURIComponent(predictionId)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000)
  });
  return parseResponse(response, 'Replicate prediction lookup');
}

function retryableReadError(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  return !status || status === 408 || status === 425 || status === 429 || status >= 500;
}

async function getPredictionWithRetry(predictionId, { attempts = 5 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await getPrediction(predictionId);
    } catch (error) {
      lastError = error;
      if (!retryableReadError(error) || attempt === attempts - 1) throw error;
      await sleep(Math.min(20_000, 1000 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function cancelPrediction(predictionId, { attempts = 3 } = {}) {
  if (!predictionId || !config.providers.replicateToken) return;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${API}/predictions/${encodeURIComponent(predictionId)}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
        signal: AbortSignal.timeout(30_000)
      });
      if (response.ok || response.status === 409 || response.status === 404) return;
      await parseResponse(response, 'Replicate prediction cancellation');
      return;
    } catch (error) {
      lastError = error;
      if (!retryableReadError(error) || attempt === attempts - 1) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
  if (lastError) throw lastError;
}

function terminalPredictionError(prediction, label) {
  const detail = prediction?.error || `${label} ${prediction?.status || 'failed'}.`;
  const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  if (prediction?.status === 'canceled') error.code = 'REPLICATE_PREDICTION_CANCELED';
  else if (prediction?.status === 'aborted') error.code = 'REPLICATE_PREDICTION_ABORTED';
  else error.code = 'REPLICATE_PREDICTION_FAILED';
  error.nonRetryable = true;
  error.predictionId = prediction?.id;
  error.predictionStatus = prediction?.status;
  return error;
}

async function waitForPrediction(prediction, {
  label = 'Replicate prediction',
  pollMs = 2000,
  timeoutMs = 10 * 60_000
} = {}) {
  const started = Date.now();
  let current = prediction;

  for (;;) {
    if (current.status === 'succeeded') return current;
    if (current.status === 'failed' || current.status === 'canceled' || current.status === 'aborted') {
      throw terminalPredictionError(current, label);
    }
    if (Date.now() - started > timeoutMs) {
      const error = new Error(`${label} is still running after the local wait limit. Its prediction id has been preserved and can be resumed safely.`);
      error.code = 'REPLICATE_POLL_TIMEOUT';
      error.predictionId = current.id;
      throw error;
    }
    await sleep(pollMs);
    current = await getPredictionWithRetry(current.id);
  }
}

async function runOfficialPrediction({
  model,
  input,
  predictionId,
  label = model,
  cancelAfter = '5m',
  onPredictionCreated,
  onRateLimit
}) {
  let prediction;

  if (predictionId) {
    prediction = await getPredictionWithRetry(predictionId);
  } else {
    prediction = await runWithReplicateRetry(
      () => createOfficialPrediction(model, input, { cancelAfter }),
      { label: `${label} creation`, onRateLimit }
    );
    await onPredictionCreated?.(prediction);
  }

  const completed = await waitForPrediction(prediction, { label });
  return { prediction: completed, output: completed.output };
}

function collectPredictionIds(session) {
  const ids = new Set();
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object') return;
    if (value.predictionId) ids.add(value.predictionId);
    for (const [key, nested] of Object.entries(value)) {
      if (key !== 'predictionId') visit(nested);
    }
  };
  visit(session?.stages || {});
  return [...ids];
}

async function cancelSessionPredictions(session) {
  await Promise.allSettled(collectPredictionIds(session).map((id) => cancelPrediction(id)));
}

module.exports = {
  createOfficialPrediction,
  getPrediction,
  getPredictionWithRetry,
  cancelPrediction,
  waitForPrediction,
  runOfficialPrediction,
  cancelSessionPredictions,
  collectPredictionIds,
  retryableReadError
};
