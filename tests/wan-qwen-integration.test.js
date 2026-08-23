const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const config = read('server/config.js');
const pipeline = read('server/pipeline.js');
const wan = read('server/services/wan.js');
const qwen = read('server/services/qwen.js');
const routes = read('server/routes.js');
const queue = read('server/queue.js');
const prediction = read('server/services/replicate-prediction.js');

test('Wan 2.2 S2V is the primary video provider with Pruna kept as controlled secondary', () => {
  assert.match(config, /WAN_MODEL/);
  assert.match(config, /wan-video\/wan-2\.2-s2v/);
  assert.match(config, /VIDEO_PROVIDER_PREFERENCE[^\n]*\|\| 'wan,pruna'/);
  assert.match(pipeline, /generateWanVideo/);
  assert.match(pipeline, /provider === 'wan'/);
  assert.match(wan, /audio/);
  assert.match(wan, /image/);
  assert.match(wan, /prompt/);
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

test('restart and cleanup safety sees nested paid predictions including three FLUX items', () => {
  assert.match(queue, /stage\.items/);
  assert.match(prediction, /function collectPredictionIds/);
  assert.match(prediction, /visit\(session\?\.stages/);
});
