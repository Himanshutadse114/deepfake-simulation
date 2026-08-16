const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');

const WATERMARK_TEXT = 'AI-GENERATED SECURITY AWARENESS SIMULATION';

async function downloadVideo(url, outputPath) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Generated video download failed (${response.status}).`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
}

function buildWatermarkFilter() {
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  // drawbox w/h refer to the box itself. Use iw/ih for the input video dimensions.
  return `drawbox=x=0:y=ih-72:w=iw:h=72:color=black@0.68:t=fill,drawtext=fontfile=${font}:text='${WATERMARK_TEXT}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-47`;
}

function spawnFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    process.on('error', (error) => reject(new Error(`FFmpeg is required to process the awareness video: ${error.message}`)));
    process.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-1200) || `ffmpeg exit ${code}`)));
  });
}

async function runFfmpeg(inputPath, outputPath) {
  try {
    await spawnFfmpeg([
      '-i', inputPath,
      '-vf', buildWatermarkFilter(),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath
    ]);
    return outputPath;
  } catch (error) {
    throw new Error(`Watermarking failed: ${error.message}`);
  }
}

async function createWatermarkedVideo(sourceUrl, rawPath, outputPath) {
  await downloadVideo(sourceUrl, rawPath);
  await runFfmpeg(rawPath, outputPath);
  return outputPath;
}

module.exports = { createWatermarkedVideo, runFfmpeg, buildWatermarkFilter, WATERMARK_TEXT };
