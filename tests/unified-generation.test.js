const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const { VARIANT_PROMPTS } = require('../server/services/flux');
const { runInitialGeneration } = require('../server/pipeline');

test('starts profile images with the audio and video pipeline', async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const running = runInitialGeneration(
    async () => { started.push('media'); await gate; },
    async () => { started.push('profile'); await gate; }
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started.sort(), ['media', 'profile']);
  release();
  await running;
});

test('profile generation is fixed to exactly four images', () => {
  assert.equal(config.providers.fluxGridImages, 4);
  assert.equal(VARIANT_PROMPTS.length, 4);
});
