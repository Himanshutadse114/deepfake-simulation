const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');

async function downloadVideo(url, outputPath) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Generated video download failed (${response.status}).`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
}

function runFfmpeg(inputPath, outputPath) {
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const filter = `drawbox=x=0:y=h-72:w=w:h=72:color=black@0.68:t=fill,drawtext=fontfile=${font}:text='AI-GENERATED SECURITY AWARENESS SIMULATION':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-47`;
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', outputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    process.on('error', (error) => reject(new Error(`FFmpeg is required to burn the AI-generated watermark: ${error.message}`)));
    process.on('close', (code) => code === 0 ? resolve(outputPath) : reject(new Error(`Watermarking failed: ${stderr.slice(-600) || `ffmpeg exit ${code}`}`)));
  });
}

async function createWatermarkedVideo(sourceUrl, rawPath, outputPath) {
  await downloadVideo(sourceUrl, rawPath);
  await runFfmpeg(rawPath, outputPath);
  return outputPath;
}

module.exports = { createWatermarkedVideo };
