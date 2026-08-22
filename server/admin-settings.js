const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const { validateScriptPair } = require('./script-policy');
const { getRedisClient } = require('./redis-client');
const { objectStorageConfigured, getJson, putJson } = require('./storage');

const settingsPath = path.join(config.uploadRoot, 'admin-scripts.json');
const REDIS_KEY = 'deepfake:admin-scripts';
const R2_KEY = 'control/admin-scripts.json';

const defaultScripts = () => validateScriptPair({
  whatsapp: process.env.WHATSAPP_AUDIO_SCRIPT || 'This is an AI voice-clone awareness demo. A familiar voice can be faked, so verify unusual requests through a trusted channel before you act.',
  video: process.env.VIDEO_AUDIO_SCRIPT || 'This is an AI-generated deepfake awareness demo. A familiar face and voice are not proof of identity, so verify sensitive requests independently.'
});

let cached = null;

function normalizePayload(parsed) {
  return {
    scripts: validateScriptPair(parsed.scripts || parsed),
    updatedAt: parsed.updatedAt || null
  };
}

async function readSaved() {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(REDIS_KEY);
      return raw ? normalizePayload(JSON.parse(raw)) : null;
    } catch (error) {
      console.warn(`[admin-settings:redis] ${error.message}`);
    }
  }

  if (!redis && objectStorageConfigured()) {
    try {
      const parsed = await getJson(R2_KEY);
      return parsed ? normalizePayload(parsed) : null;
    } catch (error) {
      console.warn(`[admin-settings:r2] ${error.message}`);
    }
  }

  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return normalizePayload(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    console.warn(`[admin-settings] ${error.message}`);
    return null;
  }
}

async function getActiveScripts() {
  if (!getRedisClient() && cached) {
    return { scripts: { ...cached.scripts }, updatedAt: cached.updatedAt };
  }
  const saved = await readSaved();
  const active = saved || { scripts: defaultScripts(), updatedAt: null };
  if (!getRedisClient()) cached = active;
  return { scripts: { ...active.scripts }, updatedAt: active.updatedAt };
}

async function saveActiveScripts(input) {
  const scripts = validateScriptPair(input || {});
  const payload = { scripts, updatedAt: new Date().toISOString() };
  const redis = getRedisClient();

  if (redis) {
    await redis.set(REDIS_KEY, JSON.stringify(payload));
  } else if (objectStorageConfigured()) {
    await putJson(R2_KEY, payload);
    cached = payload;
  } else {
    await fs.mkdir(config.uploadRoot, { recursive: true });
    const temp = `${settingsPath}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, settingsPath);
    cached = payload;
  }

  return { scripts: { ...scripts }, updatedAt: payload.updatedAt };
}

module.exports = { getActiveScripts, saveActiveScripts };
