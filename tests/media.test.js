const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImage, detectAudio, getImageDimensions, validateLocalImage } = require('../server/media');

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('detectImage accepts JPEG and PNG signatures', () => {
  assert.deepEqual(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])), { ext: 'jpg', mime: 'image/jpeg' });
  assert.deepEqual(detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])), { ext: 'png', mime: 'image/png' });
});

test('detectImage rejects renamed arbitrary bytes', () => {
  assert.equal(detectImage(Buffer.from('not really an image')), null);
});

test('local PNG validation reads dimensions and enforces minimum size', () => {
  const valid = pngHeader(512, 768);
  const detected = detectImage(valid);
  assert.deepEqual(getImageDimensions(valid, detected), { width: 512, height: 768 });
  assert.deepEqual(validateLocalImage(valid, detected), { width: 512, height: 768 });

  const tooSmall = pngHeader(128, 128);
  assert.throws(() => validateLocalImage(tooSmall, detectImage(tooSmall)), /at least 256/);
});

test('detectAudio accepts WAV, MP3 and WebM signatures', () => {
  assert.deepEqual(detectAudio(Buffer.from('RIFF0000WAVE', 'ascii')), { ext: 'wav', mime: 'audio/wav' });
  assert.deepEqual(detectAudio(Buffer.from('ID3hello', 'ascii')), { ext: 'mp3', mime: 'audio/mpeg' });
  assert.deepEqual(detectAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])), { ext: 'webm', mime: 'audio/webm' });
});

test('detectAudio rejects arbitrary bytes', () => {
  assert.equal(detectAudio(Buffer.from('not audio')), null);
});
