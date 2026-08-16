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
  if (!headers.has('accept')) headers.set('accept', 'application/json');

  const response = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(90_000)
  });

  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HeyGen request failed (${response.status}).`;
    const code = payload?.error?.code ? ` [${payload.error.code}]` : '';
    throw new Error(`${String(message)}${code}`);
  }
  return payload;
}

async function verifyAccount() {
  const payload = await heygenFetch('/v3/users/me', {
    method: 'GET',
    signal: AbortSignal.timeout(30_000)
  });
  return payload.data || payload;
}

async function uploadAsset(filePath, mime, idempotencyKey) {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), path.basename(filePath));

  const headers = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const payload = await heygenFetch('/v3/assets', {
    method: 'POST',
    headers,
    body: form
  });

  const data = payload.data || payload;
  // HeyGen v3 upload response returns data.asset_id. Keep data.id as a
  // compatibility fallback for older/alternate response shapes.
  const assetId = data?.asset_id || data?.id;
  if (!assetId) {
    throw new Error(`HeyGen asset upload succeeded but no asset_id was returned. Response keys: ${Object.keys(data || {}).join(', ') || 'none'}`);
  }
  return assetId;
}

async function createImageVideo(imageAssetId, audioAssetId, sessionId) {
  const payload = await heygenFetch('/v3/videos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': `innvikta-${sessionId}-video`
    },
    body: JSON.stringify({
      type: 'image',
      image: { type: 'asset_id', asset_id: imageAssetId },
      audio_asset_id: audioAssetId,
      title: `Innvikta awareness ${sessionId.slice(0, 8)}`,
      resolution: '720p',
      aspect_ratio: '16:9',
      output_format: 'mp4'
    })
  });

  const data = payload.data || payload;
  const id = data?.video_id || data?.id;
  if (!id) throw new Error('HeyGen did not return a video_id.');
  return id;
}

async function waitForVideo(videoId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const payload = await heygenFetch(`/v3/videos/${encodeURIComponent(videoId)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(30_000)
    });
    const data = payload.data || payload;

    if (data.status === 'completed' && data.video_url) return data.video_url;
    if (data.status === 'failed') {
      const reason = data.failure_message || data.failure_code || 'HeyGen video generation failed.';
      throw new Error(String(reason));
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('HeyGen video generation timed out.');
}

async function deleteAsset(assetId) {
  if (!assetId || (!config.providers.heygenAccessToken && !config.providers.heygenApiKey)) return;
  try {
    await heygenFetch(`/v3/assets/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(20_000)
    });
  } catch (error) {
    // Cleanup failure must not hide a completed or otherwise actionable result.
    if (!/404|not found/i.test(error.message)) console.warn(`HeyGen asset cleanup failed: ${error.message}`);
  }
}

async function generateAvatarVideo(faceFile, speechPath, sessionId) {
  if (!config.providers.heygenEnabled) throw new Error('HeyGen adapter is disabled.');

  let imageAssetId;
  let audioAssetId;
  try {
    // Validate the key/account before uploading media or creating a paid render.
    await verifyAccount();

    [imageAssetId, audioAssetId] = await Promise.all([
      uploadAsset(faceFile.path, faceFile.mime, `innvikta-${sessionId}-image`),
      uploadAsset(speechPath, 'audio/wav', `innvikta-${sessionId}-audio`)
    ]);

    const videoId = await createImageVideo(imageAssetId, audioAssetId, sessionId);
    const url = await waitForVideo(videoId);
    return { provider: 'heygen', url };
  } finally {
    await Promise.allSettled([deleteAsset(imageAssetId), deleteAsset(audioAssetId)]);
  }
}

module.exports = { generateAvatarVideo, uploadAsset, deleteAsset, verifyAccount };
