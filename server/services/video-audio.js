const { runMediaProcess } = require('./media-process');

function buildVideoAudioArgs(inputPath, outputPath, maxSeconds = 10) {
  return [
    '-i', inputPath,
    '-af', `apad=whole_dur=${maxSeconds}`,
    '-t', String(maxSeconds),
    '-ar', '44100',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outputPath
  ];
}

async function createVideoAudioInput(inputPath, outputPath, { maxSeconds = 10 } = {}) {
  await runMediaProcess(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', ...buildVideoAudioArgs(inputPath, outputPath, maxSeconds)],
    { label: 'FFmpeg video-audio preparation', timeoutMs: 60_000 }
  );
  return outputPath;
}

module.exports = { createVideoAudioInput, buildVideoAudioArgs };
