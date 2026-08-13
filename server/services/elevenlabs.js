const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const BASE = 'https://api.elevenlabs.io/v1';

function requireKey() {
  if (!config.providers.elevenLabsKey) throw new Error('ELEVENLABS_API_KEY is not configured.');
}

async function createTemporaryVoice(voiceFile, sessionId) {
  requireKey();
  const bytes = await fs.readFile(voiceFile.path);
  const form = new FormData();
  form.append('name', `awareness-${sessionId.slice(0, 8)}`);
  form.append('description', 'Temporary consented voice clone for a fixed security-awareness simulation.');
  form.append('remove_background_noise', 'false');
  form.append('files', new Blob([bytes], { type: voiceFile.mime }), path.basename(voiceFile.path));
  const response = await fetch(`${BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': config.providers.elevenLabsKey },
    body: form,
    signal: AbortSignal.timeout(60_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.voice_id) throw new Error(payload.detail?.message || payload.detail || `ElevenLabs voice clone failed (${response.status}).`);
  return payload.voice_id;
}

async function synthesizeFixedScript(voiceId, outputPath) {
  requireKey();
  const response = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': config.providers.elevenLabsKey,
      'content-type': 'application/json',
      accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text: config.awarenessScript,
      model_id: config.providers.elevenLabsModel,
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true }
    }),
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail?.message || payload.detail || `ElevenLabs speech generation failed (${response.status}).`);
  }
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
  return outputPath;
}

async function deleteVoice(voiceId) {
  if (!voiceId || !config.providers.elevenLabsKey) return;
  const response = await fetch(`${BASE}/voices/${encodeURIComponent(voiceId)}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': config.providers.elevenLabsKey },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok && response.status !== 404) throw new Error(`Temporary ElevenLabs voice cleanup failed (${response.status}).`);
}

module.exports = { createTemporaryVoice, synthesizeFixedScript, deleteVoice };
