const fs = require('node:fs/promises');
const path = require('node:path');
const Replicate = require('replicate');
const config = require('../config');
const { runWithReplicateRetry } = require('./replicate-retry');

// These prompts are intentionally restricted to benign, consented awareness
// imagery. They create plausible social-photo variety without adding claims,
// documents, uniforms, brands, money, credentials or other deceptive props.
const VARIANT_PROMPTS = [
  'Using image 1 as the identity reference, preserve the same person and distinctive facial features. Create a realistic square social-media photo of the same person in a modern office or coworking space, three-quarter left camera angle, natural expression, soft daylight, casual-professional clothing, realistic smartphone photography. Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. No text, logos, badges, documents or other people.',
  'Using image 1 as the identity reference, preserve the same person and distinctive facial features. Create a realistic square social-media photo of the same person in a bright cafe setting, three-quarter right camera angle, natural expression, warm window light, everyday clothing, realistic smartphone photography. Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. No text, logos, badges, documents or other people.',
  'Using image 1 as the identity reference, preserve the same person and distinctive facial features. Create a realistic square travel-style social photo of the same person outdoors in a generic city promenade or public plaza, front-facing to slight angle, natural daylight, relaxed expression, realistic smartphone photography. Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. Do not depict a specific landmark. No text, logos, documents or other people.',
  'Using image 1 as the identity reference, preserve the same person and distinctive facial features. Create a realistic square lifestyle social photo of the same person in a green park or neutral outdoor setting, slightly wider waist-up framing, natural expression, soft late-afternoon light, realistic smartphone photography. Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. No text, logos, badges, documents or other people.'
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
  const count = VARIANT_PROMPTS.length;
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
      { label: `FLUX profile image ${index + 1}/${count}` }
    );

    const targetPath = path.join(directory, `variant-${index + 1}.jpg`);
    await saveOutput(output, targetPath);
    results.push(targetPath);
  }

  console.log(`Generated ${results.length} consented FLUX profile images for session ${sessionId.slice(0, 8)}.`);
  return results;
}

module.exports = { generateIdentityVariants, VARIANT_PROMPTS };
