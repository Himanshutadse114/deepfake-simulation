const fs = require('node:fs/promises');
const path = require('node:path');
const Replicate = require('replicate');
const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');

const VARIANT_PROMPTS = [
  'Preserve the exact identity and facial features of the person in image 1. Create a realistic three-quarter left portrait of the same person, eye-level camera, natural expression, clean modern office background, soft daylight, realistic smartphone photo. Do not change age, hairstyle, skin tone, facial structure, or distinctive features.',
  'Preserve the exact identity and facial features of the person in image 1. Create a realistic three-quarter right portrait of the same person, eye-level camera, natural expression, neutral indoor background, soft window light, realistic smartphone photo. Do not change age, hairstyle, skin tone, facial structure, or distinctive features.',
  'Preserve the exact identity and facial features of the person in image 1. Create a realistic front-facing casual social-media portrait of the same person in a bright cafe or coworking space, natural expression, realistic smartphone camera look. Do not change age, hairstyle, skin tone, facial structure, or distinctive features.',
  'Preserve the exact identity and facial features of the person in image 1. Create a realistic front-facing outdoor social-media portrait of the same person, subtle city or park background, natural daylight, natural expression, realistic smartphone camera look. Do not change age, hairstyle, skin tone, facial structure, or distinctive features.',
  'Preserve the exact identity and facial features of the person in image 1. Create a realistic slightly closer portrait of the same person, eye-level camera, simple professional background, soft balanced lighting, natural expression. Do not change age, hairstyle, skin tone, facial structure, or distinctive features.',
  'Preserve the exact identity and facial features of the person in image 1. Create a realistic waist-up social-media photograph of the same person, relaxed posture, neutral contemporary indoor background, natural light. Do not change age, hairstyle, skin tone, facial structure, or distinctive features.'
];

function requireReplicate() {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return new Replicate({ auth: config.providers.replicateToken, fileEncodingStrategy: 'upload' });
}

async function saveOutput(output, targetPath) {
  if (!output) throw new Error('FLUX did not return an image output.');
  let url;
  if (typeof output === 'string') url = output;
  else if (typeof output?.url === 'function') url = output.url();
  else if (typeof output?.url === 'string') url = output.url;

  if (url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`Could not download FLUX output (${response.status}).`);
    await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    return targetPath;
  }

  if (typeof output?.arrayBuffer === 'function') {
    await fs.writeFile(targetPath, Buffer.from(await output.arrayBuffer()), { mode: 0o600 });
    return targetPath;
  }

  if (Buffer.isBuffer(output) || output instanceof Uint8Array) {
    await fs.writeFile(targetPath, output, { mode: 0o600 });
    return targetPath;
  }

  throw new Error('FLUX returned an unsupported image output shape.');
}

async function generateIdentityVariants(faceFile, sessionId) {
  if (!config.providers.fluxEnabled) return [];
  const replicate = requireReplicate();
  const reference = await fs.readFile(faceFile.path);
  const directory = path.dirname(faceFile.path);
  const count = Math.min(Math.max(Number(config.providers.fluxGridImages) || 4, 1), VARIANT_PROMPTS.length);
  const results = [];

  for (let index = 0; index < count; index += 1) {
    const output = await runWithReplicateRetry(
      () => replicate.run(config.providers.fluxModel, {
        input: {
          prompt: VARIANT_PROMPTS[index],
          input_images: [reference],
          resolution: '1 MP',
          aspect_ratio: '1:1',
          output_format: 'jpg',
          output_quality: 85,
          safety_tolerance: 2,
          prompt_upsampling: false
        }
      }),
      { label: `FLUX identity variant ${index + 1}/${count}` }
    );

    const targetPath = path.join(directory, `variant-${index + 1}.jpg`);
    await saveOutput(output, targetPath);
    results.push(targetPath);
  }

  console.log(`Generated ${results.length} consented FLUX image variants for session ${sessionId.slice(0, 8)}.`);
  return results;
}

module.exports = { generateIdentityVariants, VARIANT_PROMPTS };
