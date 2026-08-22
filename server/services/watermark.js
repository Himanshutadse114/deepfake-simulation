const { spawn } = require('node:child_process');
const { downloadWithRetry } = require('./download');
const { withMediaProcessSlot } = require('./process-limit');

const WATERMARK_TEXT = 'AI-GENERATED SECURITY AWARENESS SIMULATION';

async function downloadVideo(url, outputPath) {
  return downloadWithRetry(url, outputPath, {
    label: 'Generated Pruna video',
    attempts: 5,
    timeoutMs: 120_000
  });
}

function buildWatermarkFilter() {
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  return `drawbox=x=0:y=ih-72:w=iw:h=72:color=black@0.68:t=fill,drawtext=fontfile=${font}:text='${WATERMARK_TEXT}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-47`;
}

function spawnFfmpeg(args) {
  return withMediaProcessSlot(() => new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    process.on('error', (error) => reject(new Error(`FFmpeg is required to process the awareness video: ${error.message}`)));
    process.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-1200) || `ffmpeg exit ${code}`)));
  }));
}

function buildFfmpegArgs(inputPath, outputPath, maxSeconds) {
  return [
    '-i', inputPath,
    '-t', String(maxSeconds),
    '-vf', buildWatermarkFilter(),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputPath
  ];
}

async function runFfmpeg(inputPath, outputPath, { maxSeconds = 10 } = {}) {
  try {
    await spawnFfmpeg(buildFfmpegArgs(inputPath, outputPath, maxSeconds));
    return outputPath;
  } catch (error) {
    throw new Error(`Watermarking failed: ${error.message}`);
  }
}

async function createWatermarkedVideo(sourceUrl, rawPath, outputPath, options) {
  await downloadVideo(sourceUrl, rawPath);
  await runFfmpeg(rawPath, outputPath, options);
  return outputPath;
}

module.exports = {
  createWatermarkedVideo,
  runFfmpeg,
  downloadVideo,
  buildFfmpegArgs,
  buildWatermarkFilter,
  WATERMARK_TEXT
};
