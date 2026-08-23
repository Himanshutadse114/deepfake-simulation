const fs = require('node:fs/promises');
const config = require('../config');
const { toProviderUri } = require('../storage');
const { downloadWithRetry } = require('./download');
const { runOfficialPrediction } = require('./replicate-prediction');

const EXACT_SCRIPT_STYLE = [
  'Read the entire provided text verbatim from the first word through the final word.',
  'Do not add, omit, repeat, paraphrase, preface, append, shorten, summarize, or improvise any words.',
  'Do not stop early. Finish only after speaking the final word of the provided text.',
  'Speak naturally, clearly and at a steady pace.'
].join(' ');

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (typeof output?.url === 'string') return output.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

function buildVoiceCloneInput({ text, language, referenceAudio, referenceText = '' }) {
  // Preserve the complete administrator script exactly. No trimming, slicing,
  // summarising or client-supplied replacement is performed here.
  const exactText = String(text ?? '');
  if (!exactText.trim()) throw new Error('Qwen3-TTS text is empty.');
  if (!referenceAudio) throw new Error('Qwen3-TTS reference audio is missing.');

  const input = {
    mode: 'voice_clone',
    text: exactText,
    language: language || 'auto',
    reference_audio: referenceAudio,
    style_instruction: EXACT_SCRIPT_STYLE
  };

  // Replicate/Qwen recommends supplying the transcript when it is known. We
  // only send it for the guided in-app recording where the transcript is exact;
  // arbitrary uploads are still accepted without inspecting/verifying speech.
  const transcript = String(referenceText || '').trim();
  if (transcript) input.reference_text = transcript.slice(0, 1200);
  return input;
}

async function saveOutput(output, targetPath) {
  if (!output) throw new Error('Qwen3-TTS did not return audio output.');
  const url = outputUrl(output);
  if (url) return downloadWithRetry(url, targetPath, { label: 'Qwen3-TTS output', timeoutMs: 90_000 });

  if (typeof output?.arrayBuffer === 'function') {
    await fs.writeFile(targetPath, Buffer.from(await output.arrayBuffer()), { mode: 0o600 });
    return targetPath;
  }
  if (Buffer.isBuffer(output) || output instanceof Uint8Array) {
    await fs.writeFile(targetPath, output, { mode: 0o600 });
    return targetPath;
  }
  throw new Error('Qwen3-TTS returned an unsupported audio output shape.');
}

async function synthesizeScript(voiceFile, outputPath, referenceText = '', text = config.awarenessScript, options = {}) {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  let input;
  if (!options.predictionId) {
    const referenceAudio = await toProviderUri(voiceFile.path, voiceFile.mime || 'audio/webm');
    input = buildVoiceCloneInput({
      text,
      language: config.providers.qwenLanguage,
      referenceAudio,
      referenceText
    });
    await options.onBeforePredictionCreate?.();
  }

  const result = await runOfficialPrediction({
    model: config.providers.qwenModel,
    input,
    predictionId: options.predictionId,
    label: 'Qwen3-TTS voice clone',
    cancelAfter: '2m',
    onPredictionCreated: options.onPredictionCreated,
    onRateLimit: options.onRateLimit
  });

  await options.onProviderOutput?.({
    predictionId: result.prediction.id,
    output: result.output
  });
  await saveOutput(result.output, outputPath);
  return { path: outputPath, predictionId: result.prediction.id, providerOutput: result.output };
}

const synthesizeFixedScript = (voiceFile, outputPath, referenceText = '') =>
  synthesizeScript(voiceFile, outputPath, referenceText, config.awarenessScript);

module.exports = {
  synthesizeScript,
  synthesizeFixedScript,
  buildVoiceCloneInput,
  saveOutput,
  outputUrl,
  EXACT_SCRIPT_STYLE
};
