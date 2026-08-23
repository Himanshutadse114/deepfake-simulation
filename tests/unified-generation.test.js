const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const {
  PROFILE_VARIANT_COUNT,
  FLUX_PROFILE_RESOLUTION,
  PROFILE_VARIANT_PROMPTS,
  collectVariantResults
} = require('../server/services/flux');
const { runInitialGeneration } = require('../server/pipeline');

test('starts paid video and profile work together after audio validation', async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const running = runInitialGeneration(
    async () => { started.push('video'); await gate; },
    async () => { started.push('profile'); await gate; }
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started.sort(), ['profile', 'video']);
  release();
  await running;
});

test('profile generation is exactly four 1 MP social photos using the original prompt set', () => {
  assert.equal(PROFILE_VARIANT_COUNT, 4);
  assert.equal(config.providers.fluxProfileImages, 4);
  assert.equal(config.providers.fluxGridImages, 4);
  assert.equal(FLUX_PROFILE_RESOLUTION, '1 MP');
  assert.equal(PROFILE_VARIANT_PROMPTS.length, 4);
  assert.match(PROFILE_VARIANT_PROMPTS[0], /office|coworking/i);
  assert.match(PROFILE_VARIANT_PROMPTS[1], /cafe/i);
  assert.match(PROFILE_VARIANT_PROMPTS[2], /city promenade|public plaza/i);
  assert.match(PROFILE_VARIANT_PROMPTS[3], /green park|outdoor setting/i);
});

test('legacy result collector remains tolerant of partial helper failures', async () => {
  const failures = [];
  const results = await collectVariantResults(4, async (index) => {
    if (index !== 1) throw new Error(`image ${index + 1} interrupted`);
    return 'variant-2.jpg';
  }, ({ index }) => failures.push(index));

  assert.deepEqual(results, ['variant-2.jpg']);
  assert.deepEqual(failures, [0, 2, 3]);
});
