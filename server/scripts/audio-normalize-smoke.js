const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { normalizeReferenceAudio } = require('../services/audio-normalize');
const { probeAudioDuration } = require('../services/audio-duration');

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).trim()));
      resolve(stdout);
    });
  });
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-normalize-'));
  const input = path.join(directory, 'input.wav');
  const output = path.join(directory, 'reference.wav');
  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-ac', '2', '-ar', '48000', input
    ]);
    await normalizeReferenceAudio(input, output, { maxSeconds: 15 });
    const wav = await fs.readFile(output);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(22), 1, 'normalized audio must be mono');
    assert.equal(wav.readUInt32LE(24), 24000, 'normalized audio must be 24 kHz');
    assert.equal(wav.readUInt16LE(34), 16, 'normalized audio must be 16-bit PCM');
    const duration = await probeAudioDuration(output);
    assert.ok(duration >= 4.5 && duration <= 5.1, `unexpected normalized duration: ${duration}`);
    console.log(`Voice normalization smoke test passed (${duration.toFixed(2)}s, mono, 24 kHz, PCM16).`);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
