const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProbeDuration, validateDuration, buildFitArgs, atempoChain } = require('../server/services/audio-duration');

test('reads duration from the container or audio stream metadata', () => {
  assert.equal(parseProbeDuration(JSON.stringify({
    format: { duration: 'N/A' },
    streams: [{ codec_type: 'audio', duration: '8.04' }]
  })), 8.04);

  assert.equal(parseProbeDuration(JSON.stringify({
    streams: [{ codec_type: 'audio', duration_ts: '384000', time_base: '1/48000' }]
  })), 8);
});

test('uses the longest trustworthy duration value', () => {
  assert.equal(parseProbeDuration({
    format: { duration: '8.0' },
    streams: [{ codec_type: 'audio', duration: '8.2' }]
  }), 8.2);
  assert.ok(Number.isNaN(parseProbeDuration('{bad json')));
});

test('accepts audio inside the configured safety window', () => {
  assert.equal(validateDuration(9.9, { minSeconds: 3, maxSeconds: 10 }), 9.9);
});

test('direct duration validation still rejects audio above the ten-second ceiling', () => {
  assert.throws(
    () => validateDuration(12, { label: 'Generated awareness audio', maxSeconds: 10 }),
    /exceeding the 10-second safety limit.*before the video provider was called/
  );
});

test('builds an atempo filter that preserves speech while fitting long audio', () => {
  assert.deepEqual(atempoChain(1.35), ['atempo=1.350000']);
  assert.deepEqual(atempoChain(4), ['atempo=2', 'atempo=2.000000']);

  const args = buildFitArgs('input.wav', 'output.wav', 13.5, 10);
  const filterIndex = args.indexOf('-af');
  assert.ok(filterIndex >= 0);
  assert.match(args[filterIndex + 1], /atempo=1\.350000/);
  assert.match(args[filterIndex + 1], /atrim=duration=10/);
});

test('rejects invalid or too-short audio durations', () => {
  assert.throws(() => validateDuration(Number.NaN), /could not be verified/);
  assert.throws(() => validateDuration(1, { minSeconds: 3 }), /too short/);
});
