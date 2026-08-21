const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const { validateScriptPair } = require('./script-policy');

const settingsPath = path.join(config.uploadRoot, 'admin-scripts.json');

const defaultScripts = () => validateScriptPair({
  whatsapp: process.env.WHATSAPP_AUDIO_SCRIPT || 'This is an AI voice-clone awareness demo. A familiar voice can be faked, so verify unusual requests through a trusted channel before you act.',
  video: process.env.VIDEO_AUDIO_SCRIPT || 'This is an AI-generated deepfake awareness demo. A familiar face and voice are not proof of identity, so verify sensitive requests independently.'
});

let cached = null;

async function readSaved() {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      scripts: validateScriptPair(parsed.scripts || parsed),
      updatedAt: parsed.updatedAt || null
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    console.warn(`[admin-settings] ${error.message}`);
    return null;
  }
}

async function getActiveScripts() {
  if (cached) return { scripts: { ...cached.scripts }, updatedAt: cached.updatedAt };
  const saved = await readSaved();
  cached = saved || { scripts: defaultScripts(), updatedAt: null };
  return { scripts: { ...cached.scripts }, updatedAt: cached.updatedAt };
}

async function saveActiveScripts(input) {
  const scripts = validateScriptPair(input || {});
  const payload = { scripts, updatedAt: new Date().toISOString() };
  await fs.mkdir(config.uploadRoot, { recursive: true });
  const temp = `${settingsPath}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temp, settingsPath);
  cached = payload;
  return { scripts: { ...scripts }, updatedAt: payload.updatedAt };
}

module.exports = { getActiveScripts, saveActiveScripts };
