const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseVolumeLevels,
  assertAudibleLevels
} = require('../server/services/audio-signal');

test('parses FFmpeg volume levels without transcribing the recording', () => {
  const levels = parseVolumeLevels('[Parsed_volumedetect] mean_volume: -28.4 dB\n[Parsed_volumedetect] max_volume: -7.2 dB');
  assert.deepEqual(levels, { meanDb: -28.4, peakDb: -7.2 });
  assert.deepEqual(assertAudibleLevels(levels), levels);
});

test('rejects silent or effectively blank microphone recordings', () => {
  assert.throws(
    () => assertAudibleLevels({ meanDb: -91, peakDb: -91 }),
    (error) => error.code === 'NO_AUDIBLE_VOICE' && error.status === 400 && /microphone may not be working/i.test(error.message)
  );
  assert.throws(() => assertAudibleLevels({ meanDb: -Infinity, peakDb: -Infinity }), /No audible voice/);
});
