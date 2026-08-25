const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProbeDuration, validateDuration } = require('../server/services/audio-duration');

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
  assert.equal(validateDuration(11.9, { minSeconds: 3, maxSeconds: 12 }), 11.9);
});

test('rejects unexpectedly long generated audio before video generation', () => {
  assert.throws(
    () => validateDuration(120, { label: 'Generated awareness audio', maxSeconds: 12 }),
    /exceeding the 12-second safety limit.*before the video provider was called/
  );
});

test('rejects invalid or too-short audio durations', () => {
  assert.throws(() => validateDuration(Number.NaN), /could not be verified/);
  assert.throws(() => validateDuration(1, { minSeconds: 3 }), /too short/);
});
