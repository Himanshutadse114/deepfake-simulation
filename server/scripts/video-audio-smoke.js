const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createVideoAudioInput } = require('../services/video-audio');

const execFileAsync = promisify(execFile);

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'video-audio-'));
  const source = path.join(directory, 'full.wav');
  const output = path.join(directory, 'pruna.wav');

  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=21',
      source
    ]);
    await createVideoAudioInput(source, output, { maxSeconds: 10 });
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      output
    ]);
    const duration = Number(String(stdout).trim());
    assert.ok(duration >= 9.95 && duration <= 10.05, `Expected 10-second Pruna audio, received ${duration}s`);
    console.log(`Pruna input audio duration: ${duration.toFixed(3)}s`);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
