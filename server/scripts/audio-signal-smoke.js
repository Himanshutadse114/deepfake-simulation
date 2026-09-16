const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { assertAudibleAudio } = require('../services/audio-signal');

const execFileAsync = promisify(execFile);

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-signal-'));
  const silent = path.join(directory, 'silent.wav');
  const spoken = path.join(directory, 'spoken.wav');
  try {
    await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3', silent]);
    await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', spoken]);
    await assert.rejects(assertAudibleAudio(silent), (error) => error.code === 'NO_AUDIBLE_VOICE');
    const levels = await assertAudibleAudio(spoken);
    assert.ok(levels.peakDb > -45, `Expected audible signal, received ${levels.peakDb} dB`);
    console.log(`Silent audio rejected; audible audio accepted at ${levels.peakDb.toFixed(1)} dB peak.`);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
