const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const config = require('../server/config');
const configSource = read('server/config.js');
const qwen = read('server/services/qwen.js');
const routes = read('server/routes.js');
const pipeline = read('server/pipeline.js');

test('Pruna is the only production video provider', () => {
  assert.deepEqual(config.providers.videoProviderPreference, ['pruna']);
  assert.equal(config.providers.allowPaidVideoFallback, false);
  assert.match(configSource, /videoProviderPreference:\s*\['pruna'\]/);
  assert.match(configSource, /prunaai\/p-video-avatar/);
});

test('Qwen forwards the requested script as exact text and adds strict no-extra-words guidance', () => {
  assert.match(qwen, /const exactText = String\(text \?\? ''\)/);
  assert.match(qwen, /text: exactText/);
  assert.match(qwen, /Do not add, omit, repeat, paraphrase, preface, append, or improvise any words/);
});

test('admin scripts are snapshotted server-side and audited before TTS creation', () => {
  assert.match(routes, /getActiveScripts\(\)/);
  assert.match(routes, /adminSnapshot/);
  assert.match(pipeline, /script-audit/);
  assert.match(pipeline, /matchesAdminSnapshot/);
});
