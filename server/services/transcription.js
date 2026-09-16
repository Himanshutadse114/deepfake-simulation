const fs = require('node:fs/promises');
const Replicate = require('replicate');
const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');
const { runTrackedReplicatePrediction } = require('./replicate-metrics');

function requireReplicate() {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required for speech verification.');
  return new Replicate({ auth: config.providers.replicateToken, fileEncodingStrategy: 'upload' });
}

function outputText(output) {
  if (typeof output === 'string') return output.trim();
  return String(output?.transcription || output?.text || output?.translation || '').trim();
}

async function transcribeAudio(filePath, { label = 'Whisper transcription', onMetric } = {}) {
  const replicate = requireReplicate();
  const audio = await fs.readFile(filePath);
  const output = await runWithReplicateRetry(
    () => runTrackedReplicatePrediction(
      replicate,
      config.providers.whisperModel,
      {
        input: {
          audio,
          language: config.providers.whisperLanguage,
          translate: false,
          temperature: 0,
          transcription: 'plain text',
          condition_on_previous_text: false
        }
      },
      { label, onMetric }
    ),
    { label }
  );
  const text = outputText(output);
  if (!text) throw new Error(`${label} did not return spoken text.`);
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
    return { matches: false, wordErrorRate: 1, expectedWordCount: expectedWords.length, actualWordCount: actualWords.length };
  }
  const distance = wordDistance(expectedWords, actualWords);
  const wordErrorRate = distance / expectedWords.length;
  const allowedDistance = Math.max(1, Math.floor(expectedWords.length * maxWordErrorRate));
  const lengthDelta = Math.abs(expectedWords.length - actualWords.length);
  return {
    // Extra or missing words are never accepted. A small substitution allowance
    // remains for harmless Whisper recognition differences (for example, a
    // number rendered as digits instead of words).
    matches: distance <= allowedDistance && lengthDelta === 0,
    wordErrorRate,
    distance,
    allowedDistance,
    expectedWordCount: expectedWords.length,
    actualWordCount: actualWords.length,
    transcript: normalizedActual
  };
}

module.exports = { transcribeAudio, compareTranscripts, normalizeTranscript, wordDistance, outputText };
