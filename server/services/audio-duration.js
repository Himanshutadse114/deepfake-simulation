const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

function validateDuration(duration, { label = 'Audio', minSeconds = 0.5, maxSeconds = 12 } = {}) {
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`${label} duration could not be verified.`);
  if (seconds < minSeconds) throw new Error(`${label} is too short. It must be at least ${minSeconds} seconds.`);
  if (seconds > maxSeconds) {
    throw new Error(`${label} is ${seconds.toFixed(1)} seconds, exceeding the ${maxSeconds}-second safety limit. Generation stopped before the video provider was called.`);
  }
  return seconds;
}

function parseTimeBase(value) {
  const match = String(value || '').match(/^(\d+)\/(\d+)$/);
  if (!match) return Number.NaN;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return denominator > 0 ? numerator / denominator : Number.NaN;
}

function parseProbeDuration(output) {
  let metadata;
  try {
    metadata = typeof output === 'string' ? JSON.parse(output) : output;
  } catch {
    return Number.NaN;
  }

  const candidates = [];
  const add = (value) => {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds > 0) candidates.push(seconds);
  };

  add(metadata?.format?.duration);
  for (const stream of metadata?.streams || []) {
    if (stream.codec_type && stream.codec_type !== 'audio') continue;
    add(stream.duration);
    const durationTicks = Number(stream.duration_ts);
    const timeBase = parseTimeBase(stream.time_base);
    if (Number.isFinite(durationTicks) && Number.isFinite(timeBase)) add(durationTicks * timeBase);
  }

  // Use the longest trustworthy value so the provider safety limit remains conservative.
  return candidates.length ? Math.max(...candidates) : Number.NaN;
}

function probeAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,duration,duration_ts,time_base',
      '-of', 'json',
      filePath
    ], { timeout: 15_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Audio duration check failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      resolve(parseProbeDuration(String(stdout)));
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

async function fitAudioToMaxDuration(filePath, originalSeconds, maxSeconds) {
  const ext = path.extname(filePath) || '.wav';
  const tempPath = `${filePath}.normalised${ext}`;
  await runFfmpeg(buildFitArgs(filePath, tempPath, originalSeconds, maxSeconds));
  const finalSeconds = await probeAudioDuration(tempPath);

  if (!Number.isFinite(finalSeconds) || finalSeconds <= 0 || finalSeconds > maxSeconds + 0.05) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw new Error(`Generated audio could not be normalised to ${maxSeconds} seconds.`);
  }

  await fs.rename(tempPath, filePath);
  return finalSeconds;
}

async function assertAudioDuration(filePath, options = {}) {
  const maxSeconds = Number(options.maxSeconds || 12);
  const originalSeconds = await probeAudioDuration(filePath);

  if (Number.isFinite(originalSeconds) && originalSeconds > maxSeconds) {
    const finalSeconds = await fitAudioToMaxDuration(filePath, originalSeconds, maxSeconds);
    console.log(`[audio-duration] ${options.label || 'Generated audio'} normalised ${originalSeconds.toFixed(2)}s -> ${finalSeconds.toFixed(2)}s (limit ${maxSeconds}s).`);
    return validateDuration(finalSeconds, options);
  }

  return validateDuration(originalSeconds, options);
}

module.exports = {
  probeAudioDuration,
  parseProbeDuration,
  validateDuration,
  assertAudioDuration,
  fitAudioToMaxDuration,
  buildFitArgs,
  atempoChain
};
