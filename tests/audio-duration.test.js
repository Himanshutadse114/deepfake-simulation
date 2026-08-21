const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDuration } = require('../server/services/audio-duration');

test('accepts audio inside the configured safety window', () => {
  assert.equal(validateDuration(9.9, { minSeconds: 3, maxSeconds: 10 }), 9.9);
});

test('rejects unexpectedly long generated audio before video generation', () => {
  assert.throws(
    () => validateDuration(120, { label: 'Generated awareness audio', maxSeconds: 10 }),
    /exceeding the 10-second safety limit.*before the video provider was called/
  );
});

test('rejects invalid or too-short audio durations', () => {
  assert.throws(() => validateDuration(Number.NaN), /could not be verified/);
  assert.throws(() => validateDuration(1, { minSeconds: 3 }), /too short/);
});
