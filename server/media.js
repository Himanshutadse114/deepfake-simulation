const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const config = require('./config');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(config.maxImageBytes, config.maxAudioBytes), files: 1 }
});

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(png)) return { ext: 'png', mime: 'image/png' };
  return null;
}

function detectAudio(buffer) {
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg' };
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return { ext: 'mp3', mime: 'audio/mpeg' };
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return { ext: 'webm', mime: 'audio/webm' };
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
  return null;
}

async function persistParticipantFile(sessionId, kind, file) {
  if (!file?.buffer?.length) throw new Error(`No ${kind} file was received.`);
  const detected = kind === 'face' ? detectImage(file.buffer) : detectAudio(file.buffer);
  if (!detected) throw new Error(kind === 'face' ? 'Only genuine JPEG or PNG images are accepted.' : 'Only supported audio recordings (MP3, WAV, WebM or M4A) are accepted.');
  const max = kind === 'face' ? config.maxImageBytes : config.maxAudioBytes;
  if (file.buffer.length > max) throw new Error(`${kind === 'face' ? 'Image' : 'Audio'} exceeds the configured upload limit.`);
  const directory = path.join(config.uploadRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const output = path.join(directory, `${kind}.${detected.ext}`);
  await fs.writeFile(output, file.buffer, { mode: 0o600 });
  return { path: output, mime: detected.mime, size: file.buffer.length, originalName: path.basename(file.originalname || `${kind}.${detected.ext}`) };
}

module.exports = { upload, persistParticipantFile, detectImage, detectAudio };
