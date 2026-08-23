const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const privacy = read('client/public/loading-copy-privacy.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('generation loading UI uses generic copy and hides implementation stages', () => {
  assert.match(privacy, /Preparing your simulation securely/);
  assert.match(privacy, /Preparing your <em>simulation\.<\/em>/);
  assert.match(privacy, /#genStatus\{display:none!important\}/);
  assert.match(privacy, /status\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(privacy, /window\.generationMessage = \(\) => GENERIC_STATUS/);
  assert.doesNotMatch(privacy, /profile|voice clon|facial landmark|deepfake video|FLUX|Pruna|Qwen/i);
  assert.doesNotThrow(() => new Function(privacy));
});

test('privacy loading mask is installed before the UI runtime on learner and demo pages', () => {
  const indexPrivacy = index.indexOf('loading-copy-privacy.js?v=private-loading-20260823-1');
  const indexBoot = index.indexOf('ui-bootstrap.js');
  const demoPrivacy = demo.indexOf('loading-copy-privacy.js?v=private-loading-20260823-1');
  const demoBoot = demo.indexOf('ui-bootstrap.js');
  assert.ok(indexPrivacy >= 0 && indexPrivacy < indexBoot);
  assert.ok(demoPrivacy >= 0 && demoPrivacy < demoBoot);
});
