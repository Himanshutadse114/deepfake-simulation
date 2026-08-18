const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require('../config');

const BASE = 'https://api.elevenlabs.io';

function apiKey() {
  const key = String(config.providers.elevenLabsApiKey || '').trim();
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured.');
  return key;
}

async function parseError(response) {
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  if (payload?.message) return payload.message;
  return `ElevenLabs request failed (${response.status}).`;
}

async function elevenFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('xi-api-key', apiKey());
  const response = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(90_000)
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg failed (${code}).`)));
  });
}

async function createTemporaryVoice(voiceFile, sessionId) {
  const bytes = await fs.readFile(voiceFile.path);
  const form = new FormData();
  const filename = path.basename(voiceFile.path) || `voice-${sessionId}.webm`;
  form.append('name', `Innvikta awareness ${sessionId.slice(0, 8)}`);
  form.append('description', 'Temporary consented voice clone for an Innvikta security awareness simulation.');
  form.append('remove_background_noise', 'false');
  form.append('files', new Blob([bytes], { type: voiceFile.mime || 'audio/webm' }), filename);

  const response = await elevenFetch('/v1/voices/add', { method: 'POST', body: form });
  const payload = await response.json();
  if (!payload?.voice_id) throw new Error('ElevenLabs did not return a voice_id.');
  if (payload.requires_verification) {
    await deleteVoice(payload.voice_id).catch(() => {});
    throw new Error('ElevenLabs requires additional voice verification for this clone.');
  }
  return payload.voice_id;
}

async function synthesizeWithVoice(voiceId, outputPath) {
  const directory = path.dirname(outputPath);
  const tempMp3 = path.join(directory, 'elevenlabs-speech.mp3');
  const model = config.providers.elevenLabsModel || 'eleven_multilingual_v2';

  const response = await elevenFetch(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: config.awarenessScript,
      model_id: model,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0,
        use_speaker_boost: true
      }
    })
  });

  await fs.writeFile(tempMp3, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
  try {
    await runFfmpeg(['-i', tempMp3, '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', outputPath]);
  } finally {
    await fs.rm(tempMp3, { force: true }).catch(() => {});
  }
  return outputPath;
}

async function deleteVoice(voiceId) {
  if (!voiceId || !config.providers.elevenLabsApiKey) return;
  const response = await elevenFetch(`/v1/voices/${encodeURIComponent(voiceId)}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(30_000)
  });
  await response.arrayBuffer().catch(() => {});
}

async function synthesizeFixedScript(voiceFile, outputPath, sessionId) {
  let voiceId;
  try {
    voiceId = await createTemporaryVoice(voiceFile, sessionId);
    await synthesizeWithVoice(voiceId, outputPath);
    return outputPath;
  } finally {
    if (voiceId) await deleteVoice(voiceId).catch((error) => console.warn(`ElevenLabs temporary voice cleanup failed: ${error.message}`));
  }
}

module.exports = { synthesizeFixedScript, createTemporaryVoice, synthesizeWithVoice, deleteVoice };
