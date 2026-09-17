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
  deleteKey,
  deleteSessionPrefix,
  isObjectRef
} = require('./storage');

const sessions = new Map();
const saveChains = new Map();
const deletedSessions = new Map();
const KEY_PREFIX = 'deepfake:session:';
const DELETED_KEY_PREFIX = 'deepfake:session-deleted:';
const DELETION_TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;

function sessionKey(id) {
  return `${KEY_PREFIX}${id}`;
}

function sessionStateObjectKey(id) {
  return `sessions/${id}/state/session.json`;
}

function deletionKey(id) {
  return `${DELETED_KEY_PREFIX}${id}`;
}

function deletionObjectKey(id) {
  return `control/deletions/${id}.json`;
}

function deletedSessionError(id) {
  const error = new Error(`Simulation session ${id} was deleted while work was still in progress.`);
  error.status = 410;
  error.code = 'SESSION_DELETED';
  error.nonRetryable = true;
  return error;
}

function pruneLocalTombstones(now = Date.now()) {
  for (const [id, expiresAt] of deletedSessions) {
    if (expiresAt <= now) deletedSessions.delete(id);
  }
}

function isLocallyDeleted(id) {
  const expiresAt = deletedSessions.get(id);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    deletedSessions.delete(id);
    return false;
  }
  return true;
}

async function markSessionDeleted(id) {
  const expiresAt = Date.now() + DELETION_TOMBSTONE_TTL_MS;
  deletedSessions.set(id, expiresAt);
  const redis = getRedisClient();
  if (redis) await redis.set(deletionKey(id), '1', 'PX', DELETION_TOMBSTONE_TTL_MS);
  if (objectStorageConfigured()) {
    await putJson(deletionObjectKey(id), {
      sessionId: id,
      deletedAt: new Date().toISOString(),
      expiresAt
    });
  }
}

async function isSessionDeleted(id) {
  if (isLocallyDeleted(id)) return true;
  const redis = getRedisClient();
  if (!redis) return false;
  return Boolean(await redis.exists(deletionKey(id)));
}

async function durableDeletionExpiry(id) {
  if (!objectStorageConfigured()) return 0;
  const tombstone = await getJson(deletionObjectKey(id));
  const expiresAt = Number(tombstone?.expiresAt || 0);
  if (expiresAt > Date.now()) return expiresAt;
  if (tombstone) await deleteKey(deletionObjectKey(id));
  return 0;
}

async function loadDurableDeletionTombstones() {
  if (!objectStorageConfigured()) return new Set();
  const keys = (await listKeys('control/deletions/')).filter((key) => key.endsWith('.json'));
  const active = new Set();

  for (let offset = 0; offset < keys.length; offset += 20) {
    const batch = keys.slice(offset, offset + 20);
    const results = await Promise.all(batch.map(async (key) => {
      // A listed marker that cannot be read is a fail-closed startup error.
      // Treating a transient R2 failure as "not deleted" could resurrect data.
      const marker = await getJson(key);
      return { key, marker };
    }));
    for (const { key, marker } of results) {
      const expiresAt = Number(marker?.expiresAt || 0);
      if (marker?.sessionId && expiresAt > Date.now()) {
        active.add(marker.sessionId);
        deletedSessions.set(marker.sessionId, expiresAt);
      } else {
        await deleteKey(key);
      }
    }
  }
  return active;
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
  const redis = getRedisClient();
  const updatedAt = Date.now();
  session.updatedAt = updatedAt;
  if (redis) {
    const key = sessionKey(session.id);
    const ttl = session.expiresAt === null || session.expiresAt === undefined
      ? 0
      : Math.max(1000, Number(session.expiresAt) - updatedAt);
    const script = `
      if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
      redis.call('SET', KEYS[2], ARGV[1])
      local ttl = tonumber(ARGV[2])
      if ttl > 0 then redis.call('PEXPIRE', KEYS[2], ttl) else redis.call('PERSIST', KEYS[2]) end
      return 1
    `;
    const written = await redis.eval(
      script,
      2,
      deletionKey(session.id),
      key,
      JSON.stringify(session),
      String(ttl)
    );
    if (Number(written) !== 1) throw deletedSessionError(session.id);
    return session;
  }

  if (isLocallyDeleted(session.id)) throw deletedSessionError(session.id);
  sessions.set(session.id, session);
  if (objectStorageConfigured()) {
    await putJson(sessionStateObjectKey(session.id), session);
  }
  return session;
}

async function saveSession(session) {
  if (!session?.id) throw new Error('Session id is required.');
  if (await isSessionDeleted(session.id)) throw deletedSessionError(session.id);

  // FLUX and the video provider can run in parallel. Serialize persistence for
  // the same session so an older R2 PUT can never overwrite a newer checkpoint.
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
    scriptAudit: null,
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
  if (await isSessionDeleted(id)) return undefined;
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
    const deletedUntil = await durableDeletionExpiry(id);
    if (deletedUntil) {
      deletedSessions.set(id, deletedUntil);
      return undefined;
    }
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

  const durableDeletions = await loadDurableDeletionTombstones();
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
        if (durableDeletions.has(session.id)) {
          await deleteSessionPrefix(session.id).catch(() => {});
          return null;
        }
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

  // Mark deletion before cancelling providers or removing files. Any active
  // worker that reaches its next checkpoint will fail closed instead of
  // recreating the session state or starting another paid stage.
  await markSessionDeleted(id);

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
    pruneLocalTombstones(now);
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
  startExpiryCleanup,
  isSessionDeleted,
  deletedSessionError,
  deletionObjectKey,
  loadDurableDeletionTombstones
};
