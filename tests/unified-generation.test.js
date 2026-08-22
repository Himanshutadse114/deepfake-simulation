const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const { GRID_PROMPT, collectVariantResults } = require('../server/services/flux');
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

test('profile grid still resolves to exactly four learner images', () => {
  assert.equal(config.providers.fluxGridImages, 4);
  assert.match(GRID_PROMPT, /exactly four equal square photographs/i);
  assert.match(GRID_PROMPT, /TOP LEFT:/);
  assert.match(GRID_PROMPT, /TOP RIGHT:/);
  assert.match(GRID_PROMPT, /BOTTOM LEFT:/);
  assert.match(GRID_PROMPT, /BOTTOM RIGHT:/);
  assert.match(GRID_PROMPT, /same single person/i);
  assert.match(GRID_PROMPT, /No gutters, no borders/i);
});

test('legacy result collector remains tolerant of partial helper failures', async () => {
  const failures = [];
  const results = await collectVariantResults(4, async (index) => {
    if (index !== 2) throw new Error(`image ${index + 1} interrupted`);
    return 'variant-3.jpg';
  }, ({ index }) => failures.push(index));

  assert.deepEqual(results, ['variant-3.jpg']);
  assert.deepEqual(failures, [0, 1, 3]);
});
