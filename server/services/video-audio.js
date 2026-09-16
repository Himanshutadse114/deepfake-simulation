const { spawn } = require('node:child_process');

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

function createVideoAudioInput(inputPath, outputPath, { maxSeconds = 10 } = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', ...buildVideoAudioArgs(inputPath, outputPath, maxSeconds)],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    process.on('error', (error) => reject(new Error(`FFmpeg is required to prepare the 10-second video audio: ${error.message}`)));
    process.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(stderr.slice(-1200) || `FFmpeg video-audio preparation exited with code ${code}`));
    });
  });
}

module.exports = { createVideoAudioInput, buildVideoAudioArgs };
