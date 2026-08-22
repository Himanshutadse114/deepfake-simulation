const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const { withMediaProcessSlot, mediaProcessStats } = require('../server/services/process-limit');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('media-process semaphore never exceeds configured concurrency under burst load', async () => {
  let running = 0;
  let maximum = 0;

  const tasks = Array.from({ length: 40 }, (_, index) => (async () => {
    // Stagger some arrivals so new callers compete with already queued waiters.
    if (index >= 10) await sleep((index % 5) * 2);
    return withMediaProcessSlot(async () => {
      running += 1;
      maximum = Math.max(maximum, running);
      await sleep(5);
      running -= 1;
    });
  })());

  await Promise.all(tasks);
  assert.ok(maximum <= config.ffmpegConcurrency, `observed ${maximum} concurrent media tasks with limit ${config.ffmpegConcurrency}`);
  assert.equal(mediaProcessStats().active, 0);
  assert.equal(mediaProcessStats().waiting, 0);
});
