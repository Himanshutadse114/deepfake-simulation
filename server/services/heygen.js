const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const BASE = 'https://api.heygen.com';

function authHeaders() {
  if (config.providers.heygenAccessToken) {
    return { authorization: `Bearer ${config.providers.heygenAccessToken}` };
  }
  if (config.providers.heygenApiKey) {
    return { 'x-api-key': config.providers.heygenApiKey };
  }
  throw new Error('HeyGen authentication is not configured.');
}

async function heygenFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);
  const response = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(90_000)
  });
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HeyGen request failed (${response.status}).`;
    throw new Error(String(message));
  }
  return payload;
}

async function uploadAsset(filePath, mime) {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), path.basename(filePath));
  const payload = await heygenFetch('/v3/assets', { method: 'POST', body: form });
  const data = payload.data || payload;
  if (!data?.id) throw new Error('HeyGen asset upload did not return an asset id.');
  return data.id;
}

async function createImageVideo(imageAssetId, audioAssetId, sessionId) {
  const payload = await heygenFetch('/v3/videos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'image',
      image: { type: 'asset_id', asset_id: imageAssetId },
      audio_asset_id: audioAssetId,
      title: `Innvikta awareness ${sessionId.slice(0, 8)}`,
      resolution: '720p',
      aspect_ratio: 'auto',
      output_format: 'mp4'
    })
  });
  const data = payload.data || payload;
  const id = data?.id || data?.video_id;
  if (!id) throw new Error('HeyGen did not return a video id.');
  return id;
}

async function waitForVideo(videoId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const payload = await heygenFetch(`/v3/videos/${encodeURIComponent(videoId)}`, { method: 'GET', signal: AbortSignal.timeout(30_000) });
    const data = payload.data || payload;
    if (data.status === 'completed' && data.video_url) return data.video_url;
    if (data.status === 'failed') throw new Error(data.failure_message || 'HeyGen video generation failed.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('HeyGen video generation timed out.');
}

async function deleteAsset(assetId) {
  if (!assetId || (!config.providers.heygenAccessToken && !config.providers.heygenApiKey)) return;
  try {
    await heygenFetch(`/v3/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE', signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    if (!/404/.test(error.message)) throw error;
  }
}

async function generateAvatarVideo(faceFile, speechPath, sessionId) {
  if (!config.providers.heygenEnabled) throw new Error('HeyGen adapter is disabled.');
  let imageAssetId;
  let audioAssetId;
  try {
    [imageAssetId, audioAssetId] = await Promise.all([
      uploadAsset(faceFile.path, faceFile.mime),
      uploadAsset(speechPath, 'audio/wav')
    ]);
    const videoId = await createImageVideo(imageAssetId, audioAssetId, sessionId);
    const url = await waitForVideo(videoId);
    return { provider: 'heygen', url };
  } finally {
    await Promise.allSettled([deleteAsset(imageAssetId), deleteAsset(audioAssetId)]);
  }
}

module.exports = { generateAvatarVideo, uploadAsset, deleteAsset };
