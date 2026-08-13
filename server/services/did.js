const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const BASE = 'https://api.d-id.com';

function authorization() {
  const key = config.providers.didKey.trim();
  if (!key) throw new Error('DID_API_KEY is not configured.');
  if (/^Basic\s+/i.test(key)) return key;
  if (key.includes(':')) return `Basic ${Buffer.from(key).toString('base64')}`;
  return `Basic ${key}`;
}

async function didFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('authorization', authorization());
  headers.set('accept', 'application/json');
  const response = await fetch(`${BASE}${endpoint}`, { ...options, headers, signal: options.signal || AbortSignal.timeout(60_000) });
  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.description || payload?.message || payload?.kind || `D-ID request failed (${response.status}).`;
    throw new Error(String(message));
  }
  return payload;
}

async function uploadResource(kind, filePath, mime) {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  const field = kind === 'image' ? 'image' : 'audio';
  form.append(field, new Blob([bytes], { type: mime }), path.basename(filePath));
  const payload = await didFetch(kind === 'image' ? '/images' : '/audios', { method: 'POST', body: form, signal: AbortSignal.timeout(90_000) });
  const url = payload.url || payload.source_url || payload.result_url;
  if (!url) throw new Error(`D-ID ${kind} upload did not return a usable URL.`);
  return { id: payload.id, url };
}

async function createTalk(imageUrl, audioUrl, sessionId) {
  const payload = await didFetch('/talks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source_url: imageUrl,
      script: { type: 'audio', audio_url: audioUrl },
      name: `awareness-${sessionId.slice(0, 8)}`,
      user_data: 'consented-fixed-script-security-awareness-simulation'
    })
  });
  if (!payload.id) throw new Error('D-ID did not return a talk identifier.');
  return payload.id;
}

async function waitForTalk(talkId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const talk = await didFetch(`/talks/${encodeURIComponent(talkId)}`, { method: 'GET', signal: AbortSignal.timeout(30_000) });
    if (['done', 'completed'].includes(talk.status) && talk.result_url) return talk.result_url;
    if (['error', 'failed', 'rejected'].includes(talk.status)) throw new Error(talk.error?.description || talk.error?.message || 'D-ID video generation failed.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('D-ID video generation timed out.');
}

async function deleteResource(kind, id) {
  if (!id || !config.providers.didKey) return;
  const endpoint = kind === 'image' ? `/images/${encodeURIComponent(id)}` : `/audios/${encodeURIComponent(id)}`;
  try { await didFetch(endpoint, { method: 'DELETE', signal: AbortSignal.timeout(20_000) }); } catch (error) {
    if (!/404/.test(error.message)) throw error;
  }
}

module.exports = { uploadResource, createTalk, waitForTalk, deleteResource };
