const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const prompt = fs.readFileSync(path.join(root, 'client/public/voice-recording-prompt.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8');
const demo = fs.readFileSync(path.join(root, 'server/demo.js'), 'utf8');

test('voice recorder is a true full-screen teleprompter', () => {
  assert.match(prompt, /position:fixed!important/);
  assert.match(prompt, /height:100dvh!important/);
  assert.match(prompt, /voice-teleprompter-script/);
  assert.match(prompt, /Read this aloud naturally/);
  assert.match(prompt, /Use recording/);
  assert.match(prompt, /Cancel/);
  assert.doesNotMatch(prompt, /#recordContainer\{[\s\S]*?overflow-y:auto!important/);
});

test('teleprompter keeps script and controls visible across mobile and laptop layouts', () => {
  assert.match(prompt, /grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(prompt, /voice-teleprompter-actions/);
  assert.match(prompt, /@media\(max-width:700px\)/);
  assert.match(prompt, /@media\(max-height:620px\)/);
  assert.match(prompt, /safe-area-inset-top/);
  assert.match(prompt, /safe-area-inset-bottom/);
});

test('normal and demo entrypoints use the teleprompter asset version', () => {
  assert.match(index, /voice-recording-prompt\.js\?v=teleprompter-20260822-1/);
  assert.match(demo, /voice-recording-prompt\.js\?v=teleprompter-20260822-1/);
});
