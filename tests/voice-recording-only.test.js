const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'client/public/ui-html-1.txt'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'client/public/voice-sample-controls.js'), 'utf8');

test('voice setup is microphone-only and offers a recording preview', () => {
  assert.match(html, /id="audioInput" type="file" accept="audio\/\*" hidden tabindex="-1" aria-hidden="true"/);
  assert.match(html, /Start recording/);
  assert.match(html, /Play my recording/);
  assert.match(html, /Listen before continuing/);
  assert.doesNotMatch(html, /Drop or choose your voice sample|upload an existing recording|Upload MP3|Choose audio/i);
  assert.match(controls, /voice-preview-action/);
  assert.match(controls, /Record your voice again when ready/);
});
