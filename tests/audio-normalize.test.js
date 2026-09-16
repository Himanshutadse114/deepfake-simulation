const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNormalizeArgs } = require('../server/services/audio-normalize');

test('normalizes reference audio to capped 24 kHz mono PCM WAV', () => {
  const args = buildNormalizeArgs('input.webm', 'reference.wav', { maxSeconds: 15 });
  assert.deepEqual(args.slice(-9), [
    '-t', '15',
    '-ac', '1',
    '-ar', '24000',
    '-c:a', 'pcm_s16le',
    'reference.wav'
  ]);
  assert.ok(args.includes('loudnorm=I=-20:TP=-2:LRA=7'));
  assert.ok(!args.some((arg) => arg.includes('silenceremove')));
});

test('refuses to normalize over the input file', () => {
  const { normalizeReferenceAudio } = require('../server/services/audio-normalize');
  assert.throws(
    () => normalizeReferenceAudio('reference.wav', 'reference.wav'),
    /distinct input and output files/
  );
});
