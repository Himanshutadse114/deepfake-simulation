function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Paid predictions are never retried automatically by default. A failure while
// Replicate is polling an already-created prediction must not create a second
// billable prediction behind the learner's back.
async function runWithReplicateRetry(operation, { label = 'Replicate prediction', maxAttempts = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isThrottleError(error) || attempt === maxAttempts - 1) throw error;
      const delay = retryDelayMs(error, attempt);
      console.warn(`${label} was rate-limited by Replicate; retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt + 2}/${maxAttempts}).`);
      await sleep(delay);
    }
  }
  throw lastError;
}

module.exports = { runWithReplicateRetry, isThrottleError, retryDelayMs };
