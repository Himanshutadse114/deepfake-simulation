const config = require('../config');
const { toProviderUri } = require('../storage');
const { runOfficialPrediction } = require('./replicate-prediction');

function outputText(output) {
  if (typeof output === 'string') return output.trim();
  return String(output?.transcription || output?.text || output?.translation || '').trim();
}

async function transcribeAudio(audioRef, mime = 'audio/wav', options = {}) {
  if (!config.providers.replicateToken) {
    throw new Error('REPLICATE_API_TOKEN is required for speech verification.');
  }

  let input;
  if (!options.predictionId) {
    input = {
      audio: await toProviderUri(audioRef, mime),
      language: config.providers.whisperLanguage,
      translate: false,
      temperature: 0,
      transcription: 'plain text',
      condition_on_previous_text: false
    };
    await options.onBeforePredictionCreate?.();
  }

  const result = await runOfficialPrediction({
    model: config.providers.whisperModel,
    input,
    predictionId: options.predictionId,
    label: options.label || 'Whisper transcription',
    cancelAfter: '2m',
    onPredictionCreated: options.onPredictionCreated,
    onRateLimit: options.onRateLimit
  });
  await options.onProviderOutput?.({
    predictionId: result.prediction.id,
    output: result.output
  });

  const text = outputText(result.output);
  if (!text) throw new Error(`${options.label || 'Whisper transcription'} did not return spoken text.`);
  return text;
}

function normalizeTranscript(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordDistance(expectedWords, actualWords) {
  const previous = Array.from({ length: actualWords.length + 1 }, (_, index) => index);
  for (let i = 1; i <= expectedWords.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= actualWords.length; j += 1) {
      const cost = expectedWords[i - 1] === actualWords[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j < current.length; j += 1) previous[j] = current[j];
  }
  return previous[actualWords.length];
}

function compareTranscripts(expected, actual, { maxWordErrorRate = config.transcriptMaxWordErrorRate } = {}) {
  const normalizedExpected = normalizeTranscript(expected);
  const normalizedActual = normalizeTranscript(actual);
  const expectedWords = normalizedExpected ? normalizedExpected.split(' ') : [];
  const actualWords = normalizedActual ? normalizedActual.split(' ') : [];
  if (!expectedWords.length || !actualWords.length) {
    return {
      matches: false,
      wordErrorRate: 1,
      expectedWordCount: expectedWords.length,
      actualWordCount: actualWords.length
    };
  }

  const distance = wordDistance(expectedWords, actualWords);
  const wordErrorRate = distance / expectedWords.length;
  const allowedDistance = Math.floor(expectedWords.length * maxWordErrorRate);
  return {
    // Added or missing words are never accepted. One small substitution margin
    // remains for harmless ASR differences such as digits versus number words.
    matches: distance <= allowedDistance && expectedWords.length === actualWords.length,
    wordErrorRate,
    distance,
    allowedDistance,
    expectedWordCount: expectedWords.length,
    actualWordCount: actualWords.length,
    transcript: normalizedActual
  };
}

module.exports = {
  transcribeAudio,
  compareTranscripts,
  normalizeTranscript,
  wordDistance,
  outputText
};
