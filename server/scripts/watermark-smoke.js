const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { runFfmpeg } = require('../services/watermark');

function execFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`)));
  });
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'innvikta-watermark-'));
  const input = path.join(directory, 'input.mp4');
  const output = path.join(directory, 'output.mp4');

  try {
    await execFfmpeg([
      '-f', 'lavfi',
      '-i', 'color=c=0x172033:s=640x360:d=1',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      input
    ]);
    await runFfmpeg(input, output);
    const stat = await fs.stat(output);
    if (!stat.isFile() || stat.size < 1000) throw new Error('Watermarked output was not created correctly.');
    console.log(`watermark smoke test passed (${stat.size} bytes)`);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
