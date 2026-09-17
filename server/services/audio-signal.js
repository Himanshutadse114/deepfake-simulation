const { runMediaProcess } = require('./media-process');

const MIN_AUDIBLE_PEAK_DB = -45;

function parseVolumeLevels(output) {
  const text = String(output || '');
  const read = (name) => {
    const match = text.match(new RegExp(`${name}:\\s*(-?inf|-?\\d+(?:\\.\\d+)?)\\s*dB`, 'i'));
    if (!match) return null;
    return match[1].toLowerCase() === '-inf' ? -Infinity : Number(match[1]);
  };
  return { meanDb: read('mean_volume'), peakDb: read('max_volume') };
}

function microphoneError(detail) {
  const error = new Error('No audible voice was detected. Your microphone may not be working or the recording may be silent. Select the correct microphone and record again.');
  error.code = 'NO_AUDIBLE_VOICE';
  error.status = 400;
  if (detail) error.cause = new Error(detail);
  return error;
}

function assertAudibleLevels(levels, { minPeakDb = MIN_AUDIBLE_PEAK_DB } = {}) {
  if (!Number.isFinite(levels?.peakDb) || levels.peakDb <= minPeakDb) throw microphoneError();
  return levels;
}

async function inspectAudioSignal(filePath) {
  try {
    const { stderr } = await runMediaProcess('ffmpeg', [
      '-hide_banner', '-nostats', '-i', filePath,
      '-vn', '-af', 'volumedetect', '-f', 'null', '-'
    ], { label: 'Audio signal check', timeoutMs: 45_000 });
    return parseVolumeLevels(stderr);
  } catch (error) {
    throw microphoneError(error.message);
  }
}

async function assertAudibleAudio(filePath, options) {
  return assertAudibleLevels(await inspectAudioSignal(filePath), options);
}

module.exports = {
  MIN_AUDIBLE_PEAK_DB,
  parseVolumeLevels,
  assertAudibleLevels,
  inspectAudioSignal,
  assertAudibleAudio
};
