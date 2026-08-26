const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const qwen = fs.readFileSync(path.join(root, 'server/services/qwen.js'), 'utf8');
const replicate = fs.readFileSync(path.join(root, 'server/services/replicate-prediction.js'), 'utf8');

test('Qwen uses a 10 second first deadline and one 20 second retry', () => {
  assert.match(qwen, /FAST_QWEN_DEADLINES = \['10s', '20s'\]/);
  assert.match(qwen, /fast attempt 1/);
  assert.match(qwen, /fast attempt 2/);
  assert.match(qwen, /cancelAfter: FAST_QWEN_DEADLINES\[0\]/);
  assert.match(qwen, /cancelAfter: FAST_QWEN_DEADLINES\[1\]/);
});

test('Qwen only recreates after a deadline cancellation or abort', () => {
  assert.match(qwen, /REPLICATE_PREDICTION_CANCELED/);
  assert.match(qwen, /REPLICATE_PREDICTION_ABORTED/);
  assert.match(qwen, /if \(!isDeadlineTermination\(error\)\) throw error/);
});

test('durable prediction ids are resumed instead of blindly recreated', () => {
  assert.match(qwen, /if \(predictionId\)/);
  assert.match(qwen, /predictionId,/);
  assert.match(qwen, /avoids duplicate paid work after a Render restart/);
});

test('Replicate aborted predictions are terminal instead of polling for ten minutes', () => {
  assert.match(replicate, /REPLICATE_PREDICTION_ABORTED/);
  assert.match(replicate, /current\.status === 'aborted'/);
  assert.match(replicate, /error\.predictionStatus = prediction\?\.status/);
});
