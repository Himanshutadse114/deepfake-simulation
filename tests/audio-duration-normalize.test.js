const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { assertAudioDuration, probeAudioDuration } = require('../server/services/audio-duration');

const execFileAsync = promisify(execFile);

test('normalises generated WAV audio longer than ten seconds instead of failing', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deepfake-audio-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'generated.wav');

  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=12',
    '-acodec', 'pcm_s16le',
    '-ar', '24000',
    '-ac', '1',
    filePath
  ]);

  const before = await probeAudioDuration(filePath);
  assert.ok(before > 11.9);

  const after = await assertAudioDuration(filePath, {
    label: 'Generated video audio',
    maxSeconds: 10
  });

  assert.ok(after <= 10.05);
  assert.ok(after >= 9.8);
  assert.ok((await probeAudioDuration(filePath)) <= 10.05);
});
