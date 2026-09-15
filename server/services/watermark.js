const fs = require('node:fs/promises');
const { spawn, execFile } = require('node:child_process');

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

function probeVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { timeout: 15_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Video duration check failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      const seconds = Number(String(stdout).trim());
      if (!Number.isFinite(seconds) || seconds <= 0) {
        reject(new Error('Video duration could not be verified.'));
        return;
      }
      resolve(Number(seconds.toFixed(3)));
    });
  });
}

async function safeProbeVideoDuration(filePath) {
  try {
    return await probeVideoDuration(filePath);
  } catch (error) {
    console.warn(`[video-metrics] ${error.message}`);
    return null;
  }
}

async function runFfmpeg(inputPath, outputPath, { maxSeconds = 10 } = {}) {
  try {
    await spawnFfmpeg(buildFfmpegArgs(inputPath, outputPath, maxSeconds));
    return outputPath;
  } catch (error) {
    throw new Error(`Watermarking failed: ${error.message}`);
  }
}

async function createWatermarkedVideo(sourceUrl, rawPath, outputPath, options = {}) {
  const { maxSeconds = 10, onMetric } = options;
  await downloadVideo(sourceUrl, rawPath);
  const sourceDurationSeconds = await safeProbeVideoDuration(rawPath);
  await runFfmpeg(rawPath, outputPath, { maxSeconds });
  const finalDurationSeconds = await safeProbeVideoDuration(outputPath);

  const metric = {
    sourceDurationSeconds,
    finalDurationSeconds,
    maxSeconds
  };
  console.log(`[video-metrics] source=${sourceDurationSeconds ?? 'n/a'}s | final=${finalDurationSeconds ?? 'n/a'}s | configured_max=${maxSeconds}s`);
  if (typeof onMetric === 'function') onMetric(metric);

  return outputPath;
}

module.exports = {
  createWatermarkedVideo,
  runFfmpeg,
  buildFfmpegArgs,
  buildWatermarkFilter,
  probeVideoDuration,
  safeProbeVideoDuration,
  WATERMARK_TEXT
};
