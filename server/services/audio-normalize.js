const { execFile } = require('node:child_process');
const path = require('node:path');
const { withMediaProcessSlot } = require('./process-limit');

function buildNormalizeArgs(inputPath, outputPath, { maxSeconds = 15 } = {}) {
  return [
    '-y',
    '-i', inputPath,
    '-vn',
    // Do not use a silence-removal gate here. Browser microphones can produce
    // valid quiet speech below a fixed dB threshold, which previously yielded
    // an empty WAV and made its duration impossible to verify.
    '-af', 'loudnorm=I=-20:TP=-2:LRA=7',
    '-t', String(maxSeconds),
    '-ac', '1',
    '-ar', '24000',
    '-c:a', 'pcm_s16le',
    outputPath
  ];
}

function normalizeReferenceAudio(inputPath, outputPath, options = {}) {
  if (path.resolve(inputPath) === path.resolve(outputPath)) {
    throw new Error('Voice sample normalization requires distinct input and output files.');
  }
  return withMediaProcessSlot(() => new Promise((resolve, reject) => {
    execFile('ffmpeg', buildNormalizeArgs(inputPath, outputPath, options), {
      timeout: 45_000,
      windowsHide: true
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Voice sample normalization failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      resolve(outputPath);
    });
  }));
}

module.exports = { normalizeReferenceAudio, buildNormalizeArgs };
