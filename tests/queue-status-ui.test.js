const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const queueUi = read('client/public/queue-status-ui.js');
const index = read('client/index.html');

test('learner sees a clear automatic queue message when queued', () => {
  assert.match(queueUi, /Your simulation is in the queue/);
  assert.match(queueUi, /All generation slots are currently in use/);
  assert.match(queueUi, /start automatically when a slot becomes available/);
});

test('queue notice disappears automatically when generation status advances', () => {
  assert.match(queueUi, /status === 'queued'/);
  assert.match(queueUi, /else hideQueueNotice\(\)/);
  assert.match(queueUi, /currentGenerationStatus !== 'queued'/);
});

test('fixed two-minute countdown has been removed', () => {
  assert.doesNotMatch(queueUi, /ESTIMATE_SECONDS|02:00|Finishing up|usually takes about 2 minutes/i);
  assert.match(queueUi, /removeLegacyEstimate/);
});

test('normal learner page loads queue-only enhancement', () => {
  assert.match(index, /queue-status-ui\.js\?v=queue-only-20260823-1/);
});
