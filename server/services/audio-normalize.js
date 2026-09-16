const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { probeAudioDuration } = require('./audio-duration');

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout: 30_000, windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Audio normalisation failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      resolve();
    });
  });
}

function atempoChain(speed) {
  const filters = [];
  let remaining = speed;
  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }
  filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters;
}

function buildFitArgs(inputPath, outputPath, originalSeconds, maxSeconds) {
  const speed = originalSeconds / maxSeconds;
  const filters = [
    ...atempoChain(speed),
    `atrim=duration=${maxSeconds}`,
    'asetpts=N/SR/TB'
  ];
  return [
    '-i', inputPath,
    '-af', filters.join(','),
    '-acodec', 'pcm_s16le',
    '-ar', '24000',
    '-ac', '1',
    outputPath
  ];
}

async function capAudioDuration(filePath, maxSeconds = 10) {
  const originalSeconds = await probeAudioDuration(filePath);
  if (!Number.isFinite(originalSeconds) || originalSeconds <= 0) {
    throw new Error('Generated audio duration could not be verified.');
  }

  if (originalSeconds <= maxSeconds) {
    return {
      path: filePath,
      originalSeconds,
      finalSeconds: originalSeconds,
      adjusted: false
    };
  }

  const ext = path.extname(filePath) || '.wav';
  const tempPath = `${filePath}.normalised${ext}`;
  await runFfmpeg(buildFitArgs(filePath, tempPath, originalSeconds, maxSeconds));
  const finalSeconds = await probeAudioDuration(tempPath);
  if (!Number.isFinite(finalSeconds) || finalSeconds <= 0 || finalSeconds > maxSeconds + 0.05) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw new Error(`Generated audio could not be normalised to ${maxSeconds} seconds.`);
  }

  await fs.rename(tempPath, filePath);
  return {
    path: filePath,
    originalSeconds,
    finalSeconds,
    adjusted: true
  };
}

module.exports = { capAudioDuration, buildFitArgs, atempoChain };
