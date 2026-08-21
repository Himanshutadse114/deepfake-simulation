const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Replicate = require('replicate');
const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');

function requireReplicate() {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return new Replicate({ auth: config.providers.replicateToken, fileEncodingStrategy: 'upload' });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg failed (${code}).`)));
  });
}

function splitScript(text, max = 280) {
  const sentences = String(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [String(text)];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (next.length <= max) current = next;
    else {
      if (current) chunks.push(current);
      current = sentence.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => chunk.length <= max ? [chunk] : chunk.match(new RegExp(`.{1,${max}}(?:\\s|$)`, 'g'))?.map((x) => x.trim()).filter(Boolean) || [chunk]);
}

async function normalizeReferenceAudio(inputPath, outputPath) {
  await runFfmpeg(['-i', inputPath, '-t', '12', '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', outputPath]);
  return outputPath;
}

async function saveReplicateOutput(output, targetPath) {
  if (!output) throw new Error('Replicate did not return audio output.');
  if (typeof output === 'string') {
    const response = await fetch(output, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Could not download Chatterbox output (${response.status}).`);
    await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    return;
  }
  await fs.writeFile(targetPath, output, { mode: 0o600 });
}

async function synthesizeFixedScript(voiceFile, outputPath, text = config.awarenessScript, options = {}) {
  const replicate = requireReplicate();
  const directory = path.dirname(outputPath);
  const referencePath = path.join(directory, `reference-${path.basename(outputPath)}.wav`);
  await normalizeReferenceAudio(voiceFile.path, referencePath);
  const reference = await fs.readFile(referencePath);
  const chunks = splitScript(text || config.awarenessScript);
  const partPaths = [];

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const output = await runWithReplicateRetry(
        () => replicate.run(config.providers.chatterboxModel, {
          input: {
            text: chunks[index],
            language: config.providers.chatterboxLanguage,
            reference_audio: reference,
            exaggeration: 0.5,
            cfg_weight: 0.5,
            temperature: 0.8,
            seed: 0
          }
        }),
        { label: `Chatterbox chunk ${index + 1}/${chunks.length}`, onRateLimit: options.onRateLimit }
      );
      const partPath = path.join(directory, `${path.basename(outputPath, path.extname(outputPath))}-part-${index}.wav`);
      await saveReplicateOutput(output, partPath);
      partPaths.push(partPath);
    }

    if (partPaths.length === 1) {
      await fs.rename(partPaths[0], outputPath);
    } else {
      const inputArgs = partPaths.flatMap((file) => ['-i', file]);
      const concat = partPaths.map((_, i) => `[${i}:a]`).join('') + `concat=n=${partPaths.length}:v=0:a=1[outa]`;
      await runFfmpeg([...inputArgs, '-filter_complex', concat, '-map', '[outa]', '-ar', '24000', outputPath]);
    }
    return outputPath;
  } finally {
    await Promise.allSettled([fs.rm(referencePath, { force: true }), ...partPaths.map((file) => fs.rm(file, { force: true }))]);
  }
}

module.exports = { synthesizeFixedScript, splitScript, normalizeReferenceAudio };
