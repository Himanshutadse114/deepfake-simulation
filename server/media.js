const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const config = require('./config');
const { persistInputFile } = require('./storage');

fsSync.mkdirSync(config.stagingRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, config.stagingRoot),
    filename: (_req, _file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}.upload`)
  }),
  limits: { fileSize: Math.max(config.maxImageBytes, config.maxAudioBytes), files: 1 }
});

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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

function getPngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function getJpegDimensions(buffer) {
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

    if (sofMarkers.has(marker) && segmentLength >= 7) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += segmentLength;
  }

  return null;
}

function getImageDimensions(buffer, detected = detectImage(buffer)) {
  if (!detected) return null;
  return detected.ext === 'png' ? getPngDimensions(buffer) : getJpegDimensions(buffer);
}

function validateLocalImage(buffer, detected) {
  const dimensions = getImageDimensions(buffer, detected);
  if (!dimensions) throw new Error('The image dimensions could not be read. Please upload a standard JPEG or PNG photograph.');
  if (dimensions.width < 256 || dimensions.height < 256) throw new Error('Please upload a clearer photograph that is at least 256 × 256 pixels.');
  if (dimensions.width > 12000 || dimensions.height > 12000) throw new Error('The photograph dimensions are too large. Please upload a smaller image.');
  return dimensions;
}

async function readHeader(filePath, maxBytes = 1024 * 1024) {
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const size = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await handle.read(buffer, 0, size, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function ensureStagedFile(file) {
  if (file?.path) return file.path;
  if (!file?.buffer?.length) throw new Error('No uploaded file data was received.');
  const temporaryPath = path.join(config.stagingRoot, `${Date.now()}-${crypto.randomUUID()}.upload`);
  await fs.writeFile(temporaryPath, file.buffer, { mode: 0o600 });
  return temporaryPath;
}

async function persistParticipantFile(sessionId, kind, file) {
  const stagedPath = await ensureStagedFile(file);
  let moved = false;
  try {
    const size = Number(file?.size || (await fs.stat(stagedPath)).size);
    const max = kind === 'face' ? config.maxImageBytes : config.maxAudioBytes;
    if (size > max) throw new Error(`${kind === 'face' ? 'Image' : 'Audio'} exceeds the configured upload limit.`);

    // Only a bounded header is loaded into Node memory. This keeps a burst of
    // large corporate uploads from allocating hundreds of megabytes of Buffers.
    const header = await readHeader(stagedPath);
    const detected = kind === 'face' ? detectImage(header) : detectAudio(header);
    if (!detected) throw new Error(kind === 'face'
      ? 'Only genuine JPEG or PNG images are accepted.'
      : 'Only supported audio recordings (MP3, WAV, WebM or M4A) are accepted.');

    const dimensions = kind === 'face' ? validateLocalImage(header, detected) : undefined;
    const persistedPath = await persistInputFile(sessionId, kind, stagedPath, detected.ext, detected.mime);
    moved = true;

    return {
      path: persistedPath,
      mime: detected.mime,
      size,
      originalName: path.basename(file?.originalname || `${kind}.${detected.ext}`),
      ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {})
    };
  } finally {
    if (!moved) await fs.rm(stagedPath, { force: true }).catch(() => {});
  }
}

module.exports = {
  upload,
  persistParticipantFile,
  detectImage,
  detectAudio,
  getImageDimensions,
  validateLocalImage,
  readHeader
};
