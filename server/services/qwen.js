const fs = require('node:fs/promises');
const Replicate = require('replicate');
const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');

function requireReplicate() {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return new Replicate({ auth: config.providers.replicateToken, fileEncodingStrategy: 'upload' });
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

async function synthesizeFixedScript(voiceFile, outputPath, referenceText = '') {
  const replicate = requireReplicate();
  const referenceAudio = await fs.readFile(voiceFile.path);
  const input = {
    mode: 'voice_clone',
    text: config.awarenessScript,
    language: config.providers.qwenLanguage,
    reference_audio: referenceAudio,
    style_instruction: 'Speak naturally, calmly and clearly. Keep the delivery suitable for a cybersecurity awareness demonstration.'
  };

  const transcript = String(referenceText || '').trim();
  if (transcript) input.reference_text = transcript.slice(0, 1200);

  const output = await runWithReplicateRetry(
    () => replicate.run(config.providers.qwenModel, { input }),
    { label: 'Qwen3-TTS voice clone' }
  );

  return saveOutput(output, outputPath);
}

module.exports = { synthesizeFixedScript };
