function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let predictionStartGate = Promise.resolve();
let nextPredictionStartAt = 0;
let throttleSpacingMs = 0;
let throttleExpiresAt = 0;

function isThrottleError(error) {
  const status = error?.status || error?.response?.status || error?.cause?.status;
  const message = String(error?.message || error || '');
  return status === 429 || /\b429\b|too many requests|throttl/i.test(message);
}

function retryDelayMs(error, attempt) {
  const headerValue = error?.response?.headers?.get?.('retry-after');
  const directValue = error?.retry_after ?? error?.retryAfter;
  const message = String(error?.message || error || '');
  const messageMatch = message.match(/retry[_ -]?after["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)/i)
    || message.match(/resets?\s+in\s+~?(\d+(?:\.\d+)?)s/i)
    || message.match(/available\s+in\s+(\d+(?:\.\d+)?)\s*seconds?/i);

  const seconds = Number(headerValue ?? directValue ?? messageMatch?.[1]);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, Math.ceil(seconds * 1000) + 1000);

  return Math.min(30_000, 3000 * (attempt + 1));
}

function isPredictionCreationThrottle(error) {
  if (!isThrottleError(error)) return false;
  const message = String(error?.message || error || '');
  const url = String(error?.request?.url || error?.response?.url || error?.url || '');
  return /rate limit for creating predictions/i.test(message)
    || /\/predictions\b[^\n]*failed with status 429/i.test(message)
    || (/\/predictions\b/i.test(url) && (error?.status || error?.response?.status) === 429);
}

function temporaryRateLimitError() {
  const error = new Error('The generation service is temporarily busy. Please wait about one minute and try again.');
  error.code = 'GENERATION_RATE_LIMIT';
  error.status = 429;
  return error;
}

function activateTemporaryPacing(delayMs) {
  const now = Date.now();
  // Replicate's low-credit limit is six prediction starts per minute with a
  // burst of one. Keep starts ten seconds apart for 15 minutes after a 429.
  throttleSpacingMs = Math.max(throttleSpacingMs, 10_000);
  throttleExpiresAt = Math.max(throttleExpiresAt, now + (15 * 60_000));
  nextPredictionStartAt = Math.max(nextPredictionStartAt, now + delayMs);
}

async function waitForPredictionStartSlot() {
  let release;
  const previous = predictionStartGate;
  predictionStartGate = new Promise((resolve) => { release = resolve; });
  await previous;

  try {
    const now = Date.now();
    if (throttleExpiresAt <= now) {
      throttleSpacingMs = 0;
      nextPredictionStartAt = Math.min(nextPredictionStartAt, now);
    }
    const waitMs = Math.max(0, nextPredictionStartAt - now);
    if (waitMs) await sleep(waitMs);
    if (throttleSpacingMs) nextPredictionStartAt = Date.now() + throttleSpacingMs;
  } finally {
    release();
  }
}

// Only a 429 from the prediction-creation request is retried. That response
// means no paid prediction was created. Polling failures are never replayed,
// avoiding duplicate billable work.
async function runWithReplicateRetry(operation, {
  label = 'Replicate prediction',
  maxAttempts = 4,
  onRateLimit,
  waitForStart = waitForPredictionStartSlot
} = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await waitForStart();
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isThrottleError(error)) throw error;
      if (!isPredictionCreationThrottle(error)) throw temporaryRateLimitError();
      const delay = retryDelayMs(error, attempt);
      activateTemporaryPacing(delay);
      if (attempt === maxAttempts - 1) throw temporaryRateLimitError();
      const waitSeconds = Math.max(1, Math.ceil(delay / 1000));
      console.warn(`${label} was rate-limited by Replicate; retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt + 2}/${maxAttempts}).`);
      await onRateLimit?.({ waitSeconds, attempt: attempt + 1, maxAttempts });
    }
  }
  throw lastError || temporaryRateLimitError();
}

module.exports = {
  runWithReplicateRetry,
  isThrottleError,
  isPredictionCreationThrottle,
  retryDelayMs,
  temporaryRateLimitError
};
