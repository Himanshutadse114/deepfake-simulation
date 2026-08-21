const test = require('node:test');
const assert = require('node:assert/strict');
const {
  runWithReplicateRetry,
  isPredictionCreationThrottle,
  retryDelayMs
} = require('../server/services/replicate-retry');

function creationThrottle() {
  const error = new Error('Request to https://api.replicate.com/v1/models/qwen/qwen3-tts/predictions failed with status 429 Too Many Requests: {"detail":"Request was throttled. Your rate limit for creating predictions is reduced to 6 requests per minute with a burst of 1 requests. Your rate limit resets in ~10s.","status":429,"retry_after":10}');
  error.status = 429;
  return error;
}

test('recognises prediction-creation throttles and respects retry_after', () => {
  const error = creationThrottle();
  assert.equal(isPredictionCreationThrottle(error), true);
  assert.equal(retryDelayMs(error, 0), 11_000);
});

test('automatically retries a rejected prediction creation without exposing the raw error', async () => {
  let calls = 0;
  const notices = [];
  const result = await runWithReplicateRetry(async () => {
    calls += 1;
    if (calls === 1) throw creationThrottle();
    return 'ready';
  }, {
    maxAttempts: 2,
    waitForStart: async () => {},
    onRateLimit: (notice) => notices.push(notice)
  });

  assert.equal(result, 'ready');
  assert.equal(calls, 2);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].waitSeconds, 11);
});

test('does not replay an ambiguous polling throttle that could duplicate a paid prediction', async () => {
  let calls = 0;
  await assert.rejects(() => runWithReplicateRetry(async () => {
    calls += 1;
    const error = new Error('Polling failed with status 429 Too Many Requests');
    error.status = 429;
    throw error;
  }, {
    waitForStart: async () => {}
  }), /temporarily busy/i);
  assert.equal(calls, 1);
});
