const { downloadWithRetry } = require('./download');
const { runMediaProcess } = require('./media-process');

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
  return runMediaProcess(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    { label: 'Awareness video processing', timeoutMs: 4 * 60_000 }
  );
}

function buildFfmpegArgs(inputPath, outputPath, maxSeconds) {
  return [
    '-i', inputPath,
    '-t', String(maxSeconds),
    '-vf', buildWatermarkFilter(),
    '-c:v', 'libx264',
    // This is a short awareness clip rendered on a CPU-only Render service.
    // Ultrafast removes the long post-provider encoding tail while keeping the
    // permanent disclosure burned into every frame.
    '-preset', 'ultrafast',
    '-crf', '22',
    '-threads', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
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
