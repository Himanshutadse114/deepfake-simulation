const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = require('../server/config');
const render = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
const pipeline = fs.readFileSync(path.join(root, 'server/pipeline.js'), 'utf8');

test('WhatsApp awareness audio allows a natural 20-30 second full script', () => {
  assert.equal(config.maxGeneratedAudioSeconds, 30);
  assert.match(render, /MAX_GENERATED_AUDIO_SECONDS\n\s+value: 30/);
  assert.match(pipeline, /stageKey: 'whatsappAudio'[\s\S]*maxSeconds: config\.maxGeneratedAudioSeconds/);
});

test('video audio remains separately capped for the downstream video provider', () => {
  assert.equal(config.maxVideoSeconds, 20);
  assert.match(pipeline, /stageKey: 'videoAudio'[\s\S]*maxSeconds: config\.maxVideoSeconds/);
});
