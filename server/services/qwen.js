const fs = require('node:fs/promises');
const Replicate = require('replicate');
const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');
const { runTrackedReplicatePrediction } = require('./replicate-metrics');

function requireReplicate() {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return new Replicate({ auth: config.providers.replicateToken, fileEncodingStrategy: 'upload' });
}

function buildVoiceCloneInput({ referenceAudio, referenceText, text, language }) {
  const exactText = String(text ?? '');
  const transcript = String(referenceText || '').trim();
  if (!exactText.trim()) throw new Error('The administrator script is empty.');
  if (!referenceAudio) throw new Error('The reference audio is missing.');
  const input = {
    mode: 'voice_clone',
    text: exactText,
    language: language || 'English',
    reference_audio: referenceAudio,
    style_instruction: 'Read the entire provided text verbatim from the first word through the final word. Do not add, omit, repeat, paraphrase, preface, append, shorten, summarize, or improvise any words. Do not stop early. Finish only after speaking the final word. Speak naturally and clearly.'
  };
  if (transcript) input.reference_text = transcript.slice(0, 1200);
  return input;
}

async function saveOutput(output, targetPath) {
  if (!output) throw new Error('Qwen3-TTS did not return audio output.');

  let url;
  if (typeof output === 'string') url = output;
  else if (typeof output?.url === 'function') url = output.url();
  else if (typeof output?.url === 'string') url = output.url;

  if (url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`Could not download Qwen3-TTS output (${response.status}).`);
    await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    return targetPath;
  }

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

async function synthesizeScript(
  voiceFile,
  outputPath,
  referenceText = '',
  text = config.awarenessScript,
  { label = 'Qwen3-TTS voice clone', onMetric } = {}
) {
  const replicate = requireReplicate();
  const referenceAudio = await fs.readFile(voiceFile.path);
  const input = buildVoiceCloneInput({
    referenceAudio,
    referenceText,
    text,
    language: config.providers.qwenLanguage
  });

  const output = await runWithReplicateRetry(
    () => runTrackedReplicatePrediction(
      replicate,
      config.providers.qwenModel,
      { input },
      { label, onMetric }
    ),
    { label }
  );

  return saveOutput(output, outputPath);
}

const synthesizeFixedScript = (voiceFile, outputPath, referenceText = '', options = {}) =>
  synthesizeScript(voiceFile, outputPath, referenceText, config.awarenessScript, options);

module.exports = { synthesizeScript, synthesizeFixedScript, buildVoiceCloneInput };
