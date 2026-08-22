const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const { getRedisClient } = require('./redis-client');
const {
  objectStorageConfigured,
  putJson,
  getJson,
  listKeys,
  deleteSessionPrefix,
  isObjectRef
} = require('./storage');

const sessions = new Map();
const saveChains = new Map();
const KEY_PREFIX = 'deepfake:session:';

function sessionKey(id) {
  return `${KEY_PREFIX}${id}`;
}

function sessionStateObjectKey(id) {
  return `sessions/${id}/state/session.json`;
}

function buildStages() {
  return {
    whatsappAudio: { status: 'pending', predictionId: null },
    videoAudio: { status: 'pending', predictionId: null },
    pruna: { status: 'pending', predictionId: null, providerUrl: null },
    flux: { status: 'pending', predictionId: null, providerUrl: null }
  };
}

async function writeSessionState(session) {
  session.updatedAt = Date.now();
  const redis = getRedisClient();
  if (redis) {
    const key = sessionKey(session.id);
    await redis.set(key, JSON.stringify(session));
    if (session.expiresAt === null || session.expiresAt === undefined) {
      await redis.persist(key);
    } else {
      const ttl = Math.max(1000, Number(session.expiresAt) - Date.now());
      await redis.pexpire(key, ttl);
    }
    return session;
  }

  sessions.set(session.id, session);
  if (objectStorageConfigured()) {
    await putJson(sessionStateObjectKey(session.id), session);
  }
  return session;
}

async function saveSession(session) {
  if (!session?.id) throw new Error('Session id is required.');

  // FLUX and Pruna intentionally run in parallel. Serialize persistence for the
  // same session so an older R2 PUT can never finish after a newer checkpoint
  // and overwrite a prediction id/status with stale state.
  const previous = saveChains.get(session.id) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => writeSessionState(session));
  saveChains.set(session.id, current);

  try {
    return await current;
  } finally {
    if (saveChains.get(session.id) === current) saveChains.delete(session.id);
  }
}

async function createSession(consents, {
  mode = 'ai',
  participant = {},
  scripts = {},
  identity = null
} = {}) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const session = {
    id,
    token: crypto.randomBytes(32).toString('hex'),
    consents,
    mode: config.demoMode ? 'demo' : mode,
    participant,
    identity,
    scripts,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + config.retentionMs,
    status: 'collecting',
    detail: 'Waiting for participant media.',
    face: null,
    voice: null,
    whatsappAudioOutput: null,
    videoAudioOutput: null,
    output: null,
    variants: [],
    provider: {},
    stages: buildStages(),
    queueAttempt: 0,
    budgetReservationUsd: 0,
    profileStatus: 'idle',
    profileDetail: 'Profile preparation is waiting.',
    profileError: null
  };
  await saveSession(session);
  return session;
}

async function getSession(id) {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(sessionKey(id));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`[session:${id}] invalid Redis state: ${error.message}`);
      return undefined;
    }
  }

  const cached = sessions.get(id);
  if (cached) return cached;
  if (!objectStorageConfigured()) return undefined;

  try {
    const session = await getJson(sessionStateObjectKey(id));
    if (!session || session.id !== id) return undefined;
    sessions.set(id, session);
    return session;
  } catch (error) {
    console.warn(`[session:${id}] could not restore R2 state: ${error.message}`);
    throw error;
  }
}

async function recoverSessionsFromObjectStorage() {
  if (getRedisClient() || !objectStorageConfigured()) return [];

  const stateKeys = (await listKeys('sessions/'))
    .filter((key) => /^sessions\/[^/]+\/state\/session\.json$/.test(key));
  const recovered = [];

  for (let offset = 0; offset < stateKeys.length; offset += 10) {
    const batch = stateKeys.slice(offset, offset + 10);
    const results = await Promise.all(batch.map(async (key) => {
      try {
        const session = await getJson(key);
        const match = key.match(/^sessions\/([^/]+)\/state\/session\.json$/);
        if (!session?.id || !match || session.id !== match[1]) return null;
        sessions.set(session.id, session);
        return session;
      } catch (error) {
        console.warn(`[session-recovery:${key}] ${error.message}`);
        return null;
      }
    }));
    recovered.push(...results.filter(Boolean));
  }

  recovered.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return recovered;
}

function publicSession(session) {
  return {
    id: session.id,
    token: session.token,
    expiresAt: session.expiresAt,
    mode: session.mode
  };
}

function updateStatus(session, status, detail = '') {
  session.status = status;
  session.detail = detail;

  if (status === 'completed' || status === 'failed') {
    session.expiresAt = Date.now() + config.retentionMs;
  } else if (status === 'collecting') {
    if (!session.expiresAt) session.expiresAt = Date.now() + config.retentionMs;
  } else {
    session.expiresAt = null;
  }
}

function updateProfileStatus(session, status, detail = '') {
  session.profileStatus = status;
  session.profileDetail = detail;
}

async function removeLocalSessionFiles(session, {
  keepOutput = false,
  keepFace = false,
  keepVoice = false,
  keepVariants = false,
  keepAudio = false
} = {}) {
  const directories = [
    path.join(config.uploadRoot, session.id),
    path.join(config.workRoot, session.id)
  ];

  for (const directory of directories) {
    let files = [];
    try { files = await fs.readdir(directory); } catch { continue; }
    if (!keepOutput && !keepFace && !keepVoice && !keepVariants && !keepAudio) {
      await fs.rm(directory, { recursive: true, force: true });
      continue;
    }

    const keep = new Set();
    const addLocal = (value) => {
      if (value && !isObjectRef(value) && !/^https?:\/\//i.test(value)) keep.add(path.basename(value));
    };
    if (keepOutput) addLocal(session.output);
    if (keepFace) addLocal(session.face?.path);
    if (keepVoice) addLocal(session.voice?.path);
    if (keepAudio) {
      addLocal(session.whatsappAudioOutput);
      addLocal(session.videoAudioOutput);
    }
    if (keepVariants) for (const variant of session.variants || []) addLocal(variant);

    await Promise.all(files
      .filter((file) => !keep.has(file))
      .map((file) => fs.rm(path.join(directory, file), { recursive: true, force: true })));
  }
}

async function deleteSession(id, { cancelPredictions = true } = {}) {
  const session = await getSession(id);
  const redis = getRedisClient();

  if (session && !cancelPredictions) {
    const expiresAt = session.expiresAt;
    if (expiresAt === null || expiresAt === undefined || Number(expiresAt) > Date.now()) {
      return false;
    }
  }

  if (session && cancelPredictions) {
    const { cancelQueuedGeneration } = require('./queue');
    const { cancelSessionPredictions } = require('./services/replicate-prediction');
    await Promise.allSettled([
      cancelQueuedGeneration(session),
      cancelSessionPredictions(session)
    ]);
  }

  const pendingSave = saveChains.get(id);
  if (pendingSave) await pendingSave.catch(() => {});

  if (redis) await redis.del(sessionKey(id));
  sessions.delete(id);
  saveChains.delete(id);

  await deleteSessionPrefix(id).catch((error) => {
    console.warn(`[session-cleanup:${id}] ${error.message}`);
  });
  return true;
}

function startExpiryCleanup() {
  if (getRedisClient()) return null;

  const timer = setInterval(async () => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt !== null && session.expiresAt !== undefined && session.expiresAt <= now) {
        await deleteSession(id, { cancelPredictions: false }).catch(() => {});
      }
    }
  }, 60_000);
  timer.unref();
  return timer;
}

module.exports = {
  createSession,
  getSession,
  saveSession,
  recoverSessionsFromObjectStorage,
  sessionStateObjectKey,
  publicSession,
  updateStatus,
  updateProfileStatus,
  removeLocalSessionFiles,
  deleteSession,
  startExpiryCleanup
};
