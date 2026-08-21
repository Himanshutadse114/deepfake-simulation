const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFfmpegArgs } = require('../server/services/watermark');

test('hard-caps the delivered video at ten seconds', () => {
  const args = buildFfmpegArgs('raw.mp4', 'simulation.mp4', 10);
  const durationFlag = args.indexOf('-t');
  assert.notEqual(durationFlag, -1);
  assert.equal(args[durationFlag + 1], '10');
  assert.equal(args.at(-1), 'simulation.mp4');
});
