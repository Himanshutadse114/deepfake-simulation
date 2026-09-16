const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const settingsPath = path.join(os.tmpdir(), `deepfake-admin-settings-${process.pid}-${Date.now()}.json`);
process.env.ADMIN_SETTINGS_PATH = settingsPath;

const { getActiveScripts, saveActiveScripts } = require('../server/admin-settings');

test.after(async () => {
  await fs.rm(settingsPath, { force: true });
});

test('persists and reloads the exact administrator scripts', async () => {
  const scripts = {
    whatsapp: 'This exact admin voice script must be spoken.',
    video: 'This exact admin video script must be spoken.'
  };
  const saved = await saveActiveScripts(scripts);
  const loaded = await getActiveScripts();

  assert.deepEqual(saved.scripts, scripts);
  assert.deepEqual(loaded.scripts, scripts);
  const onDisk = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  assert.deepEqual(onDisk.scripts, scripts);
});
