const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ringtone = fs.readFileSync(path.join(root, 'client/public/wa-call-ringtone.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'client/public/ui-bootstrap.js'), 'utf8');

test('incoming WhatsApp video call loads the ringtone runtime', () => {
  assert.match(bootstrap, /wa-call-ringtone\.js\?v=1/);
});

test('ringtone starts on incoming call and stops on answer or navigation away', () => {
  assert.match(ringtone, /triggerIncomingVideoCallWithRingtone/);
  assert.match(ringtone, /acceptVideoCallWithRingtoneStop/);
  assert.match(ringtone, /if \(name !== 'waVideoCall'\) stopRingtone\(\)/);
});

test('declining stops the current ring and allows the existing repeat-call experience', () => {
  assert.match(ringtone, /declineVideoCallWithRingtoneRepeat/);
  assert.match(ringtone, /scheduleRepeatCall/);
  assert.match(ringtone, /1200/);
});

test('ringtone is generated locally with Web Audio and does not depend on an external audio asset', () => {
  assert.match(ringtone, /AudioContext/);
  assert.match(ringtone, /createOscillator/);
  assert.doesNotMatch(ringtone, /new Audio\(/);
  assert.doesNotMatch(ringtone, /https?:\/\//);
});
