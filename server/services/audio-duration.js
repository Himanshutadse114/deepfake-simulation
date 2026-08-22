const { execFile } = require('node:child_process');
const { withMediaProcessSlot } = require('./process-limit');

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

  return candidates.length ? Math.max(...candidates) : Number.NaN;
}

function probeAudioDuration(filePath) {
  return withMediaProcessSlot(() => new Promise((resolve, reject) => {
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
  }));
}

async function assertAudioDuration(filePath, options = {}) {
  // Participant reference audio is intentionally not decoded, duration-checked,
  // or rejected locally. The consented input is passed through to the configured
  // voice-cloning provider. Duration validation remains enabled for generated
  // WhatsApp/video audio because those limits protect the downstream experience
  // and prevent paying Pruna for video seconds that will be discarded.
  if (String(options.label || '').trim().toLowerCase() === 'voice sample') return 0;
  return validateDuration(await probeAudioDuration(filePath), options);
}

module.exports = { probeAudioDuration, parseProbeDuration, validateDuration, assertAudioDuration };
