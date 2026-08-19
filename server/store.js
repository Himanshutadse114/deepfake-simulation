const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');

const sessions = new Map();

function createSession(consents) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const session = {
    id,
    token: crypto.randomBytes(32).toString('hex'),
    consents,
    createdAt: now,
    expiresAt: now + config.retentionMs,
    status: 'collecting',
    detail: 'Waiting for participant media.',
    face: null,
    voice: null,
    output: null,
    variants: [],
    provider: {},
    profileStatus: 'idle',
    profileDetail: 'Profile impersonation demo has not started.',
    profileError: null
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

function publicSession(session) {
  return { id: session.id, token: session.token, expiresAt: session.expiresAt };
}

function updateStatus(session, status, detail = '') {
  session.status = status;
  session.detail = detail;
}

function updateProfileStatus(session, status, detail = '') {
  session.profileStatus = status;
  session.profileDetail = detail;
}

async function removeLocalSessionFiles(session, { keepOutput = false, keepFace = false, keepVariants = false } = {}) {
  const directory = path.join(config.uploadRoot, session.id);
  if (!keepOutput && !keepFace && !keepVariants) {
    await fs.rm(directory, { recursive: true, force: true });
    return;
  }

  const keep = new Set();
  if (keepOutput && session.output) keep.add(path.basename(session.output));
  if (keepFace && session.face?.path) keep.add(path.basename(session.face.path));
  if (keepVariants) {
    for (const variant of session.variants || []) keep.add(path.basename(variant));
  }

  let files = [];
  try { files = await fs.readdir(directory); } catch { return; }
  await Promise.all(files.filter((file) => !keep.has(file)).map((file) => fs.rm(path.join(directory, file), { force: true })));
}

async function deleteSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  await removeLocalSessionFiles(session);
}

function startExpiryCleanup() {
  const timer = setInterval(async () => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) await deleteSession(id).catch(() => {});
    }
  }, 60_000);
  timer.unref();
}

module.exports = {
  createSession,
  getSession,
  publicSession,
  updateStatus,
  updateProfileStatus,
  removeLocalSessionFiles,
  deleteSession,
  startExpiryCleanup
};
