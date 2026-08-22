const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require('../config');
const {
  materialize,
  persistTemporaryProviderFile,
  toProviderUri,
  deleteRef
} = require('../storage');
const { downloadWithRetry } = require('./download');
const { withMediaProcessSlot } = require('./process-limit');
const { runOfficialPrediction } = require('./replicate-prediction');

const PROFILE_VARIANT_COUNT = 3;
const FLUX_PROFILE_RESOLUTION = '1 MP';

const PROFILE_VARIANT_PROMPTS = [
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority: preserve the same distinctive facial features, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance.',
    'Show a nearly front-facing head-and-shoulders portrait in a modern office or coworking space, eyes naturally toward the camera, relaxed expression, casual-professional clothing and soft daylight.',
    'The result should look like an ordinary smartphone photograph posted to a personal Instagram profile, with realistic skin texture, natural lighting and believable camera detail.',
    'Include exactly one person. Keep the background generic and free of readable text, logos, credentials, documents, money or recognisable landmarks.'
  ].join(' '),
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority: preserve the same distinctive facial features, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance.',
    'Place the person in a bright everyday cafe with a clear natural three-quarter-right head angle, both eyes reasonably visible, warm window light, relaxed expression and casual clothing.',
    'Use a slightly different crop and shoulder orientation from a straight portrait. Make it feel like a spontaneous smartphone photo rather than a studio portrait.',
    'Include exactly one person. Keep the scene free of readable text, logos, credentials, documents, money or recognisable brand marks.'
  ].join(' '),
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority: preserve the same distinctive facial features, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance.',
    'Place the person in a green park or generic outdoor public setting with a natural three-quarter-left or soft arm-length selfie angle, both eyes visible, relaxed expression and natural daylight.',
    'Use a slightly wider framing and a different camera height from the other profile photos so the post feels independently captured and believable.',
    'Include exactly one person. Keep the background generic with no readable text, credentials, money, logos or recognisable landmarks.'
  ].join(' ')
];

function runFfmpeg(args, label) {
  return withMediaProcessSlot(() => new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      windowsHide: true
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => reject(new Error(`${label} failed to start: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${label} failed${stderr ? `: ${stderr.trim()}` : ` with exit code ${code}`}`));
    });
  }));
}

async function createFluxReference(sourcePath, targetPath) {
  // FLUX.2 Pro bills reference images by megapixels. Keep the original portrait
  // for the video provider and create a dedicated reference bounded to 1024px
  // on both axes so every profile request stays in the 1 MP reference tier.
  await runFfmpeg([
    '-i', sourcePath,
    '-vf', 'scale=min(1024\\,iw):min(1024\\,ih):force_original_aspect_ratio=decrease',
    '-frames:v', '1',
    '-q:v', '3',
    targetPath
  ], 'FLUX reference resize');
  return targetPath;
}

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (typeof output?.url === 'string') return output.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

async function saveOutput(output, targetPath, label = 'FLUX profile image') {
  const url = outputUrl(output);
  if (!url) throw new Error('FLUX did not return an image URL.');
  return downloadWithRetry(url, targetPath, { label, timeoutMs: 90_000 });
}

// Kept exported for backwards-compatible tests/helpers. Production now creates
// three independent 1 MP photos rather than one composite contact sheet.
async function collectVariantResults(count, runVariant, onFailure = () => {}) {
  const results = [];
  for (let index = 0; index < count; index += 1) {
    try {
      results.push(await runVariant(index));
    } catch (error) {
      onFailure({ index, error });
    }
  }
  return results;
}

async function generateIdentityVariants(faceFile, sessionId, options = {}) {
  if (!config.providers.fluxEnabled) return { variants: [], predictionIds: [], providerOutputUrls: [] };
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  const directory = options.workspace || path.join(config.workRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const sourcePath = path.join(directory, 'flux-source-image');
  const referencePath = path.join(directory, 'flux-reference.jpg');
  let temporaryProviderRef = null;
  let providerReferenceUri = null;

  const ensureProviderReference = async () => {
    if (providerReferenceUri) return providerReferenceUri;
    await materialize(faceFile.path, sourcePath);
    await createFluxReference(sourcePath, referencePath);
    temporaryProviderRef = await persistTemporaryProviderFile(
      sessionId,
      'flux-reference.jpg',
      referencePath,
      'image/jpeg'
    );
    providerReferenceUri = await toProviderUri(temporaryProviderRef, 'image/jpeg');
    return providerReferenceUri;
  };

  try {
    const variants = [];
    const predictionIds = [];
    const providerOutputUrls = [];

    // Deliberately run the three image predictions sequentially. This keeps one
    // FLUX prediction active per simulation, reduces burst rate-limit pressure,
    // and lets the durable stage checkpoint represent exactly one paid creation
    // boundary at a time.
    for (let index = 0; index < PROFILE_VARIANT_COUNT; index += 1) {
      const callbacks = typeof options.itemCallbacks === 'function'
        ? options.itemCallbacks(index)
        : {};
      let input;

      if (!callbacks.predictionId) {
        input = {
          prompt: PROFILE_VARIANT_PROMPTS[index],
          input_images: [await ensureProviderReference()],
          resolution: FLUX_PROFILE_RESOLUTION,
          aspect_ratio: '1:1',
          output_format: 'jpg',
          output_quality: 90,
          safety_tolerance: 2,
          prompt_upsampling: false
        };
        await callbacks.onBeforePredictionCreate?.();
      }

      const result = await runOfficialPrediction({
        model: config.providers.fluxModel,
        input,
        predictionId: callbacks.predictionId,
        label: `FLUX profile image ${index + 1}`,
        cancelAfter: '5m',
        onPredictionCreated: callbacks.onPredictionCreated,
        onRateLimit: options.onRateLimit
      });

      const url = outputUrl(result.output);
      if (!url) throw new Error(`FLUX profile image ${index + 1} did not return an image URL.`);
      await callbacks.onProviderOutput?.({ predictionId: result.prediction.id, url, index });

      const target = path.join(directory, `variant-${index + 1}.jpg`);
      await saveOutput(result.output, target, `FLUX profile image ${index + 1}`);
      variants.push(target);
      predictionIds.push(result.prediction.id);
      providerOutputUrls.push(url);
    }

    console.log(`Generated ${variants.length} independent FLUX 1 MP profile images for session ${sessionId.slice(0, 8)}.`);
    return { variants, predictionIds, providerOutputUrls };
  } finally {
    await Promise.allSettled([
      fs.rm(sourcePath, { force: true }),
      fs.rm(referencePath, { force: true }),
      temporaryProviderRef ? deleteRef(temporaryProviderRef) : Promise.resolve()
    ]);
  }
}

module.exports = {
  generateIdentityVariants,
  collectVariantResults,
  createFluxReference,
  saveOutput,
  outputUrl,
  PROFILE_VARIANT_COUNT,
  FLUX_PROFILE_RESOLUTION,
  PROFILE_VARIANT_PROMPTS
};
