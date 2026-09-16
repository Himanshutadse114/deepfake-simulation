const { execFile } = require('node:child_process');

function buildNormalizeArgs(inputPath, outputPath, { maxSeconds = 15 } = {}) {
  return [
    '-y',
    '-i', inputPath,
    '-vn',
    '-af', 'silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB,loudnorm=I=-20:TP=-2:LRA=7',
    '-t', String(maxSeconds),
    '-ac', '1',
    '-ar', '24000',
    '-c:a', 'pcm_s16le',
    outputPath
  ];
}

function normalizeReferenceAudio(inputPath, outputPath, { maxSeconds = 15 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', buildNormalizeArgs(inputPath, outputPath, { maxSeconds }), { timeout: 45_000, windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Voice sample normalization failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = { normalizeReferenceAudio, buildNormalizeArgs };
