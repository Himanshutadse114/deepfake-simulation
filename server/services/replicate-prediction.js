const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');

const API = 'https://api.replicate.com/v1';

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

async function parseResponse(response, label) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const message = payload?.detail || payload?.error || payload?.message || `${label} failed (${response.status}).`;
  const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
  error.status = response.status;
  error.request = { url: response.url };
  error.response = { status: response.status, headers: response.headers, url: response.url };
  throw error;
}

async function createOfficialPrediction(model, input, { cancelAfter = '5m' } = {}) {
  const { owner, name } = modelParts(model);
  const url = `${API}/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
      Prefer: 'wait=1',
      'Cancel-After': cancelAfter
    }),
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(30_000)
  });
  return parseResponse(response, `${model} prediction creation`);
}

async function getPrediction(predictionId) {
  const response = await fetch(`${API}/predictions/${encodeURIComponent(predictionId)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000)
  });
  return parseResponse(response, 'Replicate prediction lookup');
}

async function cancelPrediction(predictionId) {
  if (!predictionId || !config.providers.replicateToken) return;
  const response = await fetch(`${API}/predictions/${encodeURIComponent(predictionId)}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok && response.status !== 409 && response.status !== 404) {
    await parseResponse(response, 'Replicate prediction cancellation');
  }
}

function terminalPredictionError(prediction, label) {
  const detail = prediction?.error || `${label} ${prediction?.status || 'failed'}.`;
  const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  error.code = prediction?.status === 'canceled' ? 'REPLICATE_PREDICTION_CANCELED' : 'REPLICATE_PREDICTION_FAILED';
  error.nonRetryable = true;
  error.predictionId = prediction?.id;
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
    if (current.status === 'failed' || current.status === 'canceled') throw terminalPredictionError(current, label);
    if (Date.now() - started > timeoutMs) {
      const error = new Error(`${label} is still running after the local wait limit. Its prediction id has been preserved and can be resumed safely.`);
      error.code = 'REPLICATE_POLL_TIMEOUT';
      error.predictionId = current.id;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    current = await getPrediction(current.id);
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
    prediction = await getPrediction(predictionId);
  } else {
    prediction = await runWithReplicateRetry(
      () => createOfficialPrediction(model, input, { cancelAfter }),
      { label: `${label} creation`, onRateLimit }
    );
    await onPredictionCreated?.(prediction);
  }

  const completed = await waitForPrediction(prediction, { label });
  return {
    prediction: completed,
    output: completed.output
  };
}

function collectPredictionIds(session) {
  const ids = new Set();
  for (const stage of Object.values(session?.stages || {})) {
    if (stage?.predictionId) ids.add(stage.predictionId);
  }
  return [...ids];
}

async function cancelSessionPredictions(session) {
  await Promise.allSettled(collectPredictionIds(session).map((id) => cancelPrediction(id)));
}

module.exports = {
  createOfficialPrediction,
  getPrediction,
  cancelPrediction,
  waitForPrediction,
  runOfficialPrediction,
  cancelSessionPredictions,
  collectPredictionIds
};
