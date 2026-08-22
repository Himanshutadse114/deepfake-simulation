const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const recovery = fs.readFileSync(path.join(root, 'client/public/refresh-recovery.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8');

test('refresh recovery runtime parses as valid JavaScript and is loaded by the client', () => {
  assert.doesNotThrow(() => new Function(recovery));
  assert.match(index, /refresh-recovery\.js\?v=1/);
});

test('refresh recovery keeps session credentials tab-scoped instead of persistent local storage', () => {
  assert.match(recovery, /sessionStorage\.setItem/);
  assert.match(recovery, /sessionStorage\.getItem/);
  assert.doesNotMatch(recovery, /localStorage/);
});

test('refresh recovery reconnects to existing status and never starts a new paid generation', () => {
  assert.match(recovery, /\/api\/simulation\/\$\{session\.id\}\/status/);
  assert.match(recovery, /refresh recovery never calls \/generate/i);
  assert.doesNotMatch(recovery, /apiRequest\([^\n]*\/generate/);
});

test('completed experiential screens restore without provider calls', () => {
  assert.match(recovery, /startWhatsAppSimulation/);
  assert.match(recovery, /triggerIncomingVideoCall/);
  assert.match(recovery, /profileExperience/);
  assert.match(recovery, /restoreNewspaperPage/);
  assert.match(recovery, /restoreQuiz/);
});

test('collecting session is discarded after refresh because browser File objects are gone', () => {
  assert.match(recovery, /payload\.status === 'collecting'/);
  assert.match(recovery, /method:\s*'DELETE'/);
  assert.match(recovery, /re-upload your photo and voice sample/i);
});
