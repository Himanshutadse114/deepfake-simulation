const { execFile } = require('node:child_process');

function validateDuration(duration, { label = 'Audio', minSeconds = 0.5, maxSeconds = 12 } = {}) {
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`${label} duration could not be verified.`);
  if (seconds < minSeconds) throw new Error(`${label} is too short. It must be at least ${minSeconds} seconds.`);
  if (seconds > maxSeconds) {
    throw new Error(`${label} is ${seconds.toFixed(1)} seconds, exceeding the ${maxSeconds}-second safety limit. Generation stopped before the video provider was called.`);
  }
  return seconds;
}

function probeAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { timeout: 15_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Audio duration check failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      resolve(Number(String(stdout).trim()));
    });
  });
}

async function assertAudioDuration(filePath, options) {
  return validateDuration(await probeAudioDuration(filePath), options);
}

module.exports = { probeAudioDuration, validateDuration, assertAudioDuration };
