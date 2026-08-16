const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const BASE = 'https://api.d-id.com';

function authorization() {
  const key = String(config.providers.didKey || '').trim();
  if (!key) throw new Error('DID_API_KEY is not configured.');
  // D-ID Studio returns the credential in API_USERNAME:API_PASSWORD format.
  // Their API expects that generated key directly after the Basic scheme.
  return /^Basic\s+/i.test(key) ? key : `Basic ${key}`;
}

async function didFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('authorization', authorization());
  if (!headers.has('accept')) headers.set('accept', 'application/json');

  const response = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(90_000)
  });

  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.description || payload?.message || payload?.kind || payload?.error?.description || `D-ID request failed (${response.status}).`;
    throw new Error(String(message));
  }
  return payload;
}

async function verifyAccount() {
  // This is a non-generation request. It validates the D-ID credential before
  // any image/audio upload or paid talk creation is attempted.
  await didFetch('/credits', {
    method: 'GET',
    signal: AbortSignal.timeout(30_000)
  });
}

async function uploadImage(faceFile) {
  const bytes = await fs.readFile(faceFile.path);
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: faceFile.mime }), path.basename(faceFile.path).slice(0, 50));
  const payload = await didFetch('/images', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(90_000)
  });
  const url = payload.url || payload.source_url || payload.result_url;
  if (!url) throw new Error('D-ID image upload did not return a usable URL.');
  return { id: payload.id, url };
}

async function uploadAudio(speechPath) {
  const bytes = await fs.readFile(speechPath);
  const form = new FormData();
  form.append('audio', new Blob([bytes], { type: 'audio/wav' }), 'awareness.wav');
  const payload = await didFetch('/audios', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(90_000)
  });
  const url = payload.url || payload.source_url || payload.result_url;
  if (!url) throw new Error('D-ID audio upload did not return a usable URL.');
  return { id: payload.id, url };
}

async function createTalk(imageUrl, audioUrl, sessionId) {
  const payload = await didFetch('/talks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source_url: imageUrl,
      script: {
        type: 'audio',
        audio_url: audioUrl
      },
      name: `Innvikta awareness ${sessionId.slice(0, 8)}`,
      user_data: 'consented-fixed-script-security-awareness-simulation'
    })
  });
  if (!payload.id) throw new Error('D-ID did not return a talk id.');
  return payload.id;
}

async function waitForTalk(talkId) {
  let lastStatus = 'created';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const talk = await didFetch(`/talks/${encodeURIComponent(talkId)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(30_000)
    });
    lastStatus = talk.status || lastStatus;
    if (['done', 'completed'].includes(lastStatus) && talk.result_url) return talk.result_url;
    if (['error', 'failed', 'rejected'].includes(lastStatus)) {
      throw new Error(talk.error?.description || talk.error?.message || talk.error || 'D-ID video generation failed.');
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`D-ID video generation timed out while status was "${lastStatus}".`);
}

async function deleteResource(kind, id) {
  if (!id || !config.providers.didKey) return;
  const endpoint = kind === 'image'
    ? `/images/${encodeURIComponent(id)}`
    : kind === 'audio'
      ? `/audios/${encodeURIComponent(id)}`
      : `/talks/${encodeURIComponent(id)}`;
  try {
    await didFetch(endpoint, { method: 'DELETE', signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    if (!/404|NotFound/i.test(error.message)) throw error;
  }
}

async function generateAvatarVideo(faceFile, speechPath, sessionId) {
  if (!config.providers.didEnabled) throw new Error('D-ID adapter is disabled.');
  let image;
  let audio;
  let talkId;

  try {
    await verifyAccount();
    [image, audio] = await Promise.all([
      uploadImage(faceFile),
      uploadAudio(speechPath)
    ]);
    talkId = await createTalk(image.url, audio.url, sessionId);
    const url = await waitForTalk(talkId);
    return { provider: 'did', url };
  } finally {
    await Promise.allSettled([
      deleteResource('image', image?.id),
      deleteResource('audio', audio?.id),
      deleteResource('talk', talkId)
    ]);
  }
}

module.exports = { generateAvatarVideo, uploadImage, uploadAudio, createTalk, waitForTalk, deleteResource, verifyAccount, authorization };