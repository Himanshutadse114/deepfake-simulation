const fs = require('node:fs/promises');
const config = require('../config');
const { toProviderUri } = require('../storage');
const { downloadWithRetry } = require('./download');
const { runOfficialPrediction } = require('./replicate-prediction');

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (typeof output?.url === 'string') return output.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
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
    input = {
      mode: 'voice_clone',
      text: String(text || config.awarenessScript),
      language: config.providers.qwenLanguage,
      reference_audio: await toProviderUri(voiceFile.path, voiceFile.mime || 'audio/webm'),
      style_instruction: 'Speak naturally, calmly and clearly. Keep the delivery suitable for an authorised cybersecurity awareness demonstration.'
    };
    const transcript = String(referenceText || '').trim();
    if (transcript) input.reference_text = transcript.slice(0, 1200);
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

module.exports = { synthesizeScript, synthesizeFixedScript, saveOutput, outputUrl };
