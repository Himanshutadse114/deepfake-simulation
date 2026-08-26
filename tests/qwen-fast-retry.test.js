const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  QWEN_PROVIDER_DEADLINE,
  QWEN_QUEUE_TIMEOUT_MS,
  QWEN_PROCESSING_TIMEOUTS_MS,
  isRetryableQwenAttemptError,
  normalizeAttempt
} = require('../server/services/qwen');

const root = path.join(__dirname, '..');
const qwen = fs.readFileSync(path.join(root, 'server/services/qwen.js'), 'utf8');
const replicate = fs.readFileSync(path.join(root, 'server/services/replicate-prediction.js'), 'utf8');
const pipeline = fs.readFileSync(path.join(root, 'server/pipeline.js'), 'utf8');

test('Qwen separates provider queue time from actual processing time', () => {
  assert.equal(QWEN_PROVIDER_DEADLINE, '3m');
  assert.equal(QWEN_QUEUE_TIMEOUT_MS, 90_000);
  assert.deepEqual(QWEN_PROCESSING_TIMEOUTS_MS, [30_000, 45_000]);
  assert.match(qwen, /startingTimeoutMs: QWEN_QUEUE_TIMEOUT_MS/);
  assert.match(qwen, /processingTimeoutMs/);
  assert.match(qwen, /cancelOnStateTimeout: true/);
  assert.doesNotMatch(qwen, /FAST_QWEN_DEADLINES/);
});

test('Replicate state-aware waiting uses created_at for queue and started_at for model runtime', () => {
  assert.match(replicate, /current\.created_at/);
  assert.match(replicate, /current\.started_at/);
  assert.match(replicate, /REPLICATE_STARTING_TIMEOUT/);
  assert.match(replicate, /REPLICATE_PROCESSING_TIMEOUT/);
  assert.match(replicate, /cancelOnStateTimeout/);
  assert.match(replicate, /cancelPrediction\(current\.id\)/);
});

test('Qwen retries only controlled timeout or cancellation outcomes and never exceeds two attempts', () => {
  for (const code of [
    'REPLICATE_STARTING_TIMEOUT',
    'REPLICATE_PROCESSING_TIMEOUT',
    'REPLICATE_PREDICTION_CANCELED',
    'REPLICATE_PREDICTION_ABORTED'
  ]) {
    assert.equal(isRetryableQwenAttemptError({ code }), true);
  }
  assert.equal(isRetryableQwenAttemptError({ code: 'REPLICATE_PREDICTION_FAILED' }), false);
  assert.equal(normalizeAttempt(1), 1);
  assert.equal(normalizeAttempt(2), 2);
  assert.equal(normalizeAttempt(99), 2);
  assert.match(qwen, /if \(!isRetryableQwenAttemptError\(error\) \|\| attempt >= 2\) throw error/);
});

test('Qwen attempt number and previous prediction id are durable across Render restarts', () => {
  assert.match(pipeline, /stage\.providerAttempt \|\|= 1/);
  assert.match(pipeline, /stage\.previousPredictionIds \|\|= \[\]/);
  assert.match(pipeline, /attemptNumber: stage\.providerAttempt \|\| 1/);
  assert.match(pipeline, /meta\.priorPredictionId/);
  assert.match(qwen, /predictionId: durablePredictionId/);
  assert.match(qwen, /onPredictionCreated\?\.\(prediction, \{ attempt \}\)/);
});

test('Replicate aborted predictions remain terminal instead of polling indefinitely', () => {
  assert.match(replicate, /REPLICATE_PREDICTION_ABORTED/);
  assert.match(replicate, /current\.status === 'aborted'/);
  assert.match(replicate, /error\.predictionStatus = prediction\?\.status/);
});
