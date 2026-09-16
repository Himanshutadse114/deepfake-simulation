const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVideoAudioArgs } = require('../server/services/video-audio');

test('caps and pads only the Pruna input audio to exactly ten seconds', () => {
  const args = buildVideoAudioArgs('full-admin-script.wav', 'pruna-input.wav', 10);
  const filterFlag = args.indexOf('-af');
  const durationFlag = args.indexOf('-t');

  assert.equal(args[filterFlag + 1], 'apad=whole_dur=10');
  assert.equal(args[durationFlag + 1], '10');
  assert.equal(args[0], '-i');
  assert.equal(args[1], 'full-admin-script.wav');
  assert.equal(args.at(-1), 'pruna-input.wav');
});
