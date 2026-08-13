const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImage, detectAudio } = require('../server/media');

test('detectImage accepts JPEG and PNG signatures', () => {
  assert.deepEqual(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])), { ext: 'jpg', mime: 'image/jpeg' });
  assert.deepEqual(detectImage(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00])), { ext: 'png', mime: 'image/png' });
});

test('detectImage rejects renamed arbitrary bytes', () => {
  assert.equal(detectImage(Buffer.from('not really an image')), null);
});

test('detectAudio accepts WAV, MP3 and WebM signatures', () => {
  assert.deepEqual(detectAudio(Buffer.from('RIFF0000WAVE', 'ascii')), { ext: 'wav', mime: 'audio/wav' });
  assert.deepEqual(detectAudio(Buffer.from('ID3hello', 'ascii')), { ext: 'mp3', mime: 'audio/mpeg' });
  assert.deepEqual(detectAudio(Buffer.from([0x1a,0x45,0xdf,0xa3,0x00])), { ext: 'webm', mime: 'audio/webm' });
});

test('detectAudio rejects arbitrary bytes', () => {
  assert.equal(detectAudio(Buffer.from('not audio')), null);
});
